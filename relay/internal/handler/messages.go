package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
)

// MessageHandler serves the polling endpoint for reading room messages.
type MessageHandler struct {
	Queries  *db.Queries
	Messages *hub.MessageStore
}

// GetMessages handles GET /r/{slug}/messages?after=N
// Returns messages with ID > after. Agents poll this to receive messages.
func (h *MessageHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	room, err := h.Queries.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	afterStr := r.URL.Query().Get("after")
	afterID := 0
	if afterStr != "" {
		if v, err := strconv.Atoi(afterStr); err == nil {
			afterID = v
		}
	}

	roomID := hub.NewRoomID(room.ID.Bytes)
	msgs := h.Messages.Since(roomID, afterID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msgs)
}
