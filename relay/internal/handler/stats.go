package handler

import (
	"encoding/json"
	"net/http"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
)

// StatsHandler serves aggregate platform statistics.
type StatsHandler struct {
	queries  *db.Queries
	registry *hub.PresenceRegistry
}

// NewStatsHandler creates a new StatsHandler.
func NewStatsHandler(queries *db.Queries, registry *hub.PresenceRegistry) *StatsHandler {
	return &StatsHandler{queries: queries, registry: registry}
}

type statsResponse struct {
	ActiveRooms     int `json:"activeRooms"`
	AgentsOnline    int `json:"agentsOnline"`
	MessagesRelayed int `json:"messagesRelayed"`
}

// GetStats handles GET /stats — returns aggregate platform stats.
func (h *StatsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	rooms, err := h.queries.ListPublicRooms(r.Context(), db.ListPublicRoomsParams{
		Limit:  1000,
		Offset: 0,
	})
	activeRooms := 0
	if err == nil {
		activeRooms = len(rooms)
	}

	agentsOnline := h.registry.TotalAgentCount()

	resp := statsResponse{
		ActiveRooms:     activeRooms,
		AgentsOnline:    agentsOnline,
		MessagesRelayed: 0,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
