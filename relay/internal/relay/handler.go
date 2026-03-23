package relay

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/a2aproject/a2a-go/a2a"
	"github.com/a2aproject/a2a-go/a2asrv"
	"github.com/go-chi/chi/v5"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
	"github.com/fcavalcanti/quorum/relay/internal/middleware"
)

// MountA2ARoutes registers the A2A JSON-RPC handler and room relay card on the chi router.
// Uses a single dynamic handler that resolves the room from the {slug} URL param per request,
// avoiding dynamic route registration (one handler handles all rooms).
func MountA2ARoutes(
	r chi.Router,
	hubMgr *hub.HubManager,
	registry *hub.PresenceRegistry,
	queries *db.Queries,
	baseURL string,
	logger *slog.Logger,
) {
	// Dynamic A2A JSON-RPC handler — resolves room per request.
	r.Route("/r/{slug}/a2a", func(r chi.Router) {
		r.Use(middleware.A2AVersionGuard) // A2A-05: reject non-1.0 A2A versions
		r.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {
			slug := chi.URLParam(r, "slug")

			// 1. Resolve room from DB.
			room, err := queries.GetRoomBySlug(r.Context(), slug)
			if err != nil {
				writeJSONRPCError(w, -32603, "room not found")
				return
			}
			roomID := hub.NewRoomID(room.ID.Bytes)

			// 2. Get or create hub for this room.
			roomHub := hubMgr.GetOrCreate(r.Context(), roomID)

			// 3. Create executor for this room.
			executor := &RoomExecutor{Hub: roomHub, Registry: registry, RoomID: roomID}

			// 4. Build a2asrv handler chain.
			var handlerOpts []a2asrv.RequestHandlerOption
			if logger != nil {
				handlerOpts = append(handlerOpts, a2asrv.WithLogger(logger))
			}
			requestHandler := a2asrv.NewHandler(executor, handlerOpts...)
			jsonrpcHandler := a2asrv.NewJSONRPCHandler(requestHandler)

			// 5. Delegate to SDK handler.
			jsonrpcHandler.ServeHTTP(w, r)
		})
	})

	// Room's relay Agent Card — DISC-05 (public, no auth required).
	r.Get("/r/{slug}/.well-known/agent-card.json", func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		room, err := queries.GetRoomBySlug(r.Context(), slug)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		card := BuildRoomRelayCard(slug, room.DisplayName, baseURL)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(card)
	})
}

// BuildRoomRelayCard creates the room's relay Agent Card per DISC-05.
// This describes the relay's A2A endpoint, NOT individual agent cards.
// Exported so tests can verify the card structure.
func BuildRoomRelayCard(slug, displayName, baseURL string) *a2a.AgentCard {
	return &a2a.AgentCard{
		Name:        "Quorum Relay - " + displayName,
		Description: "A2A relay for room " + slug,
		URL:         baseURL + "/r/" + slug + "/a2a",
		Version:     "1.0.0",
		Capabilities: a2a.AgentCapabilities{
			Streaming: true,
		},
		DefaultInputModes:  []string{"text/plain"},
		DefaultOutputModes: []string{"text/plain"},
		Skills: []a2a.AgentSkill{
			{
				ID:          "relay",
				Name:        "Message Relay",
				Description: "Relay messages between agents in room " + slug,
				Tags:        []string{"relay", "room"},
			},
		},
		SupportsAuthenticatedExtendedCard: true,
	}
}

// writeJSONRPCError writes a JSON-RPC 2.0 error response with the given code and message.
func writeJSONRPCError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(map[string]any{
		"jsonrpc": "2.0",
		"error":   map[string]any{"code": code, "message": msg},
		"id":      nil,
	})
}
