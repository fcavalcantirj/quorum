package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/a2aproject/a2a-go/a2a"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
)

// AgentHandler handles global agent directory endpoints.
type AgentHandler struct {
	Queries  *db.Queries
	Registry *hub.PresenceRegistry
	Logger   *slog.Logger
}

// GlobalDirectory handles GET /agents per D-07 and DISC-07.
// Returns agents from public rooms only — private room agents are hidden.
// Deserializes card_json from each DB presence row to build public AgentCard list.
// Supports ?skill= (matches AgentSkill.ID) and ?tag= (matches AgentSkill.Tags) filtering.
func (h *AgentHandler) GlobalDirectory(w http.ResponseWriter, r *http.Request) {
	// Fetch from DB using the query that JOINs rooms.is_private = FALSE
	// to ensure private room agents are excluded.
	presences, err := h.Queries.ListAllPublicAgentPresence(r.Context())
	if err != nil {
		h.Logger.Error("global directory query failed", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "failed to fetch agent directory",
		})
		return
	}

	// Deserialize card_json from each presence row into AgentCard structs.
	var allCards []*a2a.AgentCard
	for _, p := range presences {
		var card a2a.AgentCard
		if err := json.Unmarshal(p.CardJson, &card); err != nil {
			h.Logger.Warn("skipping agent with invalid card JSON",
				"agent", p.AgentName, "error", err)
			continue
		}
		allCards = append(allCards, &card)
	}

	// Apply optional query param filters.
	skillFilter := r.URL.Query().Get("skill")
	tagFilter := r.URL.Query().Get("tag")

	var filteredCards []*a2a.AgentCard
	if skillFilter != "" {
		// Filter by AgentSkill.ID (per research pitfall 6: match on ID not Name).
		for _, card := range allCards {
			for _, skill := range card.Skills {
				if skill.ID == skillFilter {
					filteredCards = append(filteredCards, card)
					break
				}
			}
		}
	} else if tagFilter != "" {
		// Filter by AgentSkill.Tags (case-insensitive per common convention).
		for _, card := range allCards {
			if cardHasTag(card, tagFilter) {
				filteredCards = append(filteredCards, card)
			}
		}
	} else {
		filteredCards = allCards
	}

	// Always return an array, never null.
	if filteredCards == nil {
		filteredCards = []*a2a.AgentCard{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(filteredCards)
}

// cardHasTag returns true if any skill in the card has the given tag (case-insensitive).
func cardHasTag(card *a2a.AgentCard, tag string) bool {
	for _, skill := range card.Skills {
		for _, t := range skill.Tags {
			if strings.EqualFold(t, tag) {
				return true
			}
		}
	}
	return false
}
