package relay

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/a2aproject/a2a-go/a2a"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
	"github.com/fcavalcanti/quorum/relay/internal/middleware"
)

// jsonRPCRequest represents a JSON-RPC 2.0 request.
type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	ID      any             `json:"id"`
	Params  json.RawMessage `json:"params"`
}

// messageSendParams matches A2A message/send params.
type messageSendParams struct {
	Message struct {
		MessageID string `json:"messageId"`
		Role      string `json:"role"`
		Parts     []struct {
			Kind string `json:"kind"`
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"message"`
}

// MountA2ARoutes registers the A2A relay handler and agent card endpoint.
func MountA2ARoutes(
	r chi.Router,
	hubMgr *hub.HubManager,
	registry *hub.PresenceRegistry,
	queries *db.Queries,
	baseURL string,
	logger *slog.Logger,
) {
	a2aHandler := handleA2ARequest(hubMgr, queries, logger)
	wrappedHandler := middleware.A2AVersionGuard(a2aHandler)
	r.Post("/r/{slug}/a2a", wrappedHandler.ServeHTTP)

	// Room's relay Agent Card — DISC-05
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

func handleA2ARequest(
	hubMgr *hub.HubManager,
	queries *db.Queries,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")

		room, err := queries.GetRoomBySlug(r.Context(), slug)
		if err != nil {
			writeJSONRPCError(w, -32603, "room not found", nil)
			return
		}
		roomID := hub.NewRoomID(room.ID.Bytes)

		var req jsonRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			if logger != nil {
				logger.Error("JSON parse error", "error", err, "slug", slug)
			}
			writeJSONRPCError(w, -32700, "parse error: "+err.Error(), nil)
			return
		}

		switch req.Method {
		case "message/send":
			handleMessageSend(w, r, req, roomID, pgtype.UUID{Bytes: room.ID.Bytes, Valid: true}, hubMgr, queries, logger)
		default:
			writeJSONRPCError(w, -32601, "method not found: "+req.Method, req.ID)
		}
	}
}

func handleMessageSend(
	w http.ResponseWriter,
	r *http.Request,
	req jsonRPCRequest,
	roomID hub.RoomID,
	roomDBID pgtype.UUID,
	hubMgr *hub.HubManager,
	queries *db.Queries,
	logger *slog.Logger,
) {
	var params messageSendParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		writeJSONRPCError(w, -32602, "invalid params", req.ID)
		return
	}

	// Extract agent name: prefer X-Agent-Name header (set by agents that joined),
	// fall back to message role field.
	agentName := r.Header.Get("X-Agent-Name")
	if agentName == "" {
		agentName = params.Message.Role
	}
	if agentName == "" {
		agentName = "agent"
	}

	// Extract text content
	var textContent string
	for _, part := range params.Message.Parts {
		if part.Kind == "text" {
			textContent = part.Text
			break
		}
	}

	// Store message in database
	if queries != nil && textContent != "" {
		_, _ = queries.InsertMessage(r.Context(), db.InsertMessageParams{
			RoomID:    roomDBID,
			AgentName: agentName,
			Content:   textContent,
		})
	}

	// Broadcast to SSE subscribers if hub exists for this room.
	if h := hubMgr.Get(roomID); h != nil {
		h.Broadcast(hub.RoomEvent{
			Type:      hub.EventMessage,
			RoomID:    roomID,
			AgentName: agentName,
			Payload:   textContent,
			Timestamp: time.Now(),
		})
	}

	// Return immediately with A2A-compliant response
	taskID := uuid.New().String()
	resp := map[string]any{
		"jsonrpc": "2.0",
		"id":      req.ID,
		"result": map[string]any{
			"id":     taskID,
			"status": map[string]any{"state": "completed"},
			"messages": []map[string]any{
				{
					"role": "agent",
					"parts": []map[string]any{
						{"kind": "text", "text": "message relayed"},
					},
				},
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)

	if logger != nil {
		logger.Info("message relayed", "room", roomID.String(), "text_len", len(textContent))
	}
}

// BuildRoomRelayCard creates the room's relay Agent Card per DISC-05.
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

func writeJSONRPCError(w http.ResponseWriter, code int, msg string, id any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK) // JSON-RPC errors still return 200
	json.NewEncoder(w).Encode(map[string]any{
		"jsonrpc": "2.0",
		"error":   map[string]any{"code": code, "message": msg},
		"id":      id,
	})
}
