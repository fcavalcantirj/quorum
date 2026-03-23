package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/a2aproject/a2a-go/a2a"
	"github.com/go-chi/chi/v5"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
	"github.com/fcavalcanti/quorum/relay/internal/token"
)

// DiscoveryHandler handles the REST discovery endpoints for room agent management.
// It enforces bearer token authentication on join (AUTH-01) and provides
// presence listing, room info, and heartbeat endpoints.
type DiscoveryHandler struct {
	Queries  *db.Queries
	HubMgr   *hub.HubManager
	Registry *hub.PresenceRegistry
	Logger   *slog.Logger
}

// JoinRoom handles POST /r/{slug}/join per D-03 (explicit join handshake).
// Accepts an Agent Card JSON in request body.
// REQUIRES valid bearer token in Authorization header (AUTH-01).
// Registers presence in hub + DB. Updates room last_active_at.
func (h *DiscoveryHandler) JoinRoom(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	// 1. Resolve room from DB.
	room, err := h.Queries.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// 2. Verify bearer token from Authorization header (AUTH-01 security gate).
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "unauthorized: valid bearer token required",
		})
		return
	}
	bearerToken := strings.TrimPrefix(authHeader, "Bearer ")
	if !token.VerifyToken(bearerToken, room.TokenHash) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "unauthorized: invalid bearer token",
		})
		return
	}

	// 3. Decode Agent Card from request body.
	var card a2a.AgentCard
	if err := json.NewDecoder(r.Body).Decode(&card); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "invalid agent card JSON",
		})
		return
	}

	// 4. Validate card has a Name (required field per A2A spec).
	if card.Name == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "agent card must have a name",
		})
		return
	}

	// 5. Register agent in the presence registry (NOT as an SSE subscriber).
	// The hub subscription is for SSE streaming only. REST-based agents use
	// the /messages polling endpoint instead.
	roomID := hub.NewRoomID(room.ID.Bytes)
	h.Registry.Add(roomID, card.Name, &card)

	// 6. Persist to DB via UpsertAgentPresence.
	cardJSON, _ := json.Marshal(card)
	_, _ = h.Queries.UpsertAgentPresence(r.Context(), db.UpsertAgentPresenceParams{
		RoomID:     room.ID,
		AgentName:  card.Name,
		CardJson:   cardJSON,
		TtlSeconds: 1800, // 30 minute TTL
	})

	// 7. Update room last_active_at per D-05.
	_ = h.Queries.UpdateRoomLastActive(r.Context(), room.ID)

	// 8. Return 200 with join confirmation.
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":     "joined",
		"agent_name": card.Name,
		"room_slug":  slug,
	})
}

// ListAgents handles GET /r/{slug}/agents per DISC-02, DISC-03, DISC-06.
// Query params: ?skill= (matches AgentSkill.ID), ?tag= (matches AgentSkill.Tags).
// Returns public cards only (no auth required per DISC-06).
func (h *DiscoveryHandler) ListAgents(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	room, err := h.Queries.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	roomID := hub.NewRoomID(room.ID.Bytes)

	// Match on AgentSkill.ID (not Name) per research pitfall 6.
	skillFilter := r.URL.Query().Get("skill")
	tagFilter := r.URL.Query().Get("tag")

	var cards []*a2a.AgentCard
	if skillFilter != "" {
		cards = h.Registry.FilterBySkillID(roomID, skillFilter)
	} else if tagFilter != "" {
		cards = h.Registry.FilterByTag(roomID, tagFilter)
	} else {
		cards = h.Registry.ListPublicCards(roomID)
	}

	// Always return an array, never null.
	if cards == nil {
		cards = []*a2a.AgentCard{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cards)
}

// GetAgentCard handles GET /r/{slug}/agents/{name} per DISC-06, DISC-07.
// Without bearer: returns public card (name, description, skills only).
// With valid bearer: returns extended card (full capabilities, URL, securitySchemes).
func (h *DiscoveryHandler) GetAgentCard(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	name := chi.URLParam(r, "name")

	room, err := h.Queries.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	roomID := hub.NewRoomID(room.ID.Bytes)

	// Check if bearer token is present and valid for extended card (DISC-07).
	authHeader := r.Header.Get("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		bearerToken := authHeader[7:]
		if token.VerifyToken(bearerToken, room.TokenHash) {
			card, ok := h.Registry.ExtendedCard(roomID, name)
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(card)
			return
		}
	}

	// DISC-06: Public card without bearer.
	cards := h.Registry.ListPublicCards(roomID)
	for _, c := range cards {
		if c.Name == name {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(c)
			return
		}
	}
	http.NotFound(w, r)
}

// RoomInfo handles GET /r/{slug}/info per D-06.
// Returns full room state: connected agents, stats, metadata.
func (h *DiscoveryHandler) RoomInfo(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	room, err := h.Queries.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	roomID := hub.NewRoomID(room.ID.Bytes)
	agents := h.Registry.ListAll(roomID)

	info := map[string]any{
		"slug":         room.Slug,
		"display_name": room.DisplayName,
		"description":  room.Description,
		"tags":         room.Tags,
		"is_private":   room.IsPrivate,
		"created_at":   room.CreatedAt,
		"agent_count":  len(agents),
		"agents":       agents,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

// Heartbeat handles POST /r/{slug}/heartbeat per D-05.
// Extends agent's TTL by refreshing last_seen. Also updates room last_active_at.
// Requires agent_name in request body.
func (h *DiscoveryHandler) Heartbeat(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	room, err := h.Queries.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	var body struct {
		AgentName string `json:"agent_name"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	if body.AgentName == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "agent_name required",
		})
		return
	}

	roomID := hub.NewRoomID(room.ID.Bytes)

	// Update in-memory registry last_seen.
	h.Registry.UpdateLastSeen(roomID, body.AgentName)

	// Update DB last_seen.
	_ = h.Queries.UpdateAgentHeartbeat(r.Context(), db.UpdateAgentHeartbeatParams{
		RoomID:    room.ID,
		AgentName: body.AgentName,
	})

	// Update room activity per D-05.
	_ = h.Queries.UpdateRoomLastActive(r.Context(), room.ID)

	w.WriteHeader(http.StatusNoContent)
}
