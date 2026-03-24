package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/fcavalcanti/quorum/relay/internal/db"
)

// MessageHandler serves the polling endpoint for reading room messages from DB.
type MessageHandler struct {
	Queries *db.Queries
}

type messageResponse struct {
	ID        int64  `json:"id"`
	AgentName string `json:"agent_name"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

// GetMessages handles GET /r/{slug}/messages?after=N
func (h *MessageHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	room, err := h.Queries.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	afterStr := r.URL.Query().Get("after")
	afterID := int64(0)
	if afterStr != "" {
		if v, err := strconv.ParseInt(afterStr, 10, 64); err == nil {
			afterID = v
		}
	}

	var msgs []db.Message
	if afterID > 0 {
		msgs, err = h.Queries.ListMessagesSince(r.Context(), db.ListMessagesSinceParams{
			RoomID:  room.ID,
			AfterID: afterID,
		})
	} else {
		msgs, err = h.Queries.ListMessages(r.Context(), room.ID)
	}
	if err != nil {
		msgs = []db.Message{}
	}

	resp := make([]messageResponse, 0, len(msgs))
	for _, m := range msgs {
		resp = append(resp, messageResponse{
			ID:        m.ID,
			AgentName: m.AgentName,
			Content:   m.Content,
			Timestamp: m.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
