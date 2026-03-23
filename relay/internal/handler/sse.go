package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
)

// SSEHandler serves Server-Sent Events for room activity.
type SSEHandler struct {
	Queries  *db.Queries
	HubMgr   *hub.HubManager
	Registry *hub.PresenceRegistry
	Logger   *slog.Logger
}

type sseEvent struct {
	Type      string `json:"type"`
	AgentName string `json:"agent_name,omitempty"`
	Content   string `json:"content,omitempty"`
	Timestamp string `json:"timestamp"`
}

// StreamEvents handles GET /r/{slug}/events — SSE stream of room activity.
func (h *SSEHandler) StreamEvents(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	room, err := h.Queries.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Subscribe to hub with a unique browser-subscriber name
	roomID := hub.NewRoomID(room.ID.Bytes)
	roomHub := h.HubMgr.GetOrCreate(r.Context(), roomID)
	subscriberName := "_browser_" + uuid.New().String()[:8]

	ch, err := roomHub.Subscribe(subscriberName, nil)
	if err != nil {
		http.Error(w, "room at capacity", http.StatusServiceUnavailable)
		return
	}
	defer roomHub.Unsubscribe(subscriberName)

	// Send initial connected event
	writeSSE(w, flusher, "connected", sseEvent{
		Type:      "connected",
		Timestamp: fmt.Sprintf("%d", room.CreatedAt.Time.Unix()),
	})
	h.Logger.Info("SSE client connected", "room", slug, "subscriber", subscriberName)

	// Stream events until client disconnects
	for {
		select {
		case evt, ok := <-ch:
			if !ok {
				return
			}

			var data sseEvent
			data.Timestamp = evt.Timestamp.Format("2006-01-02T15:04:05Z07:00")

			switch evt.Type {
			case hub.EventAgentJoined:
				data.Type = "agent_joined"
				data.AgentName = evt.AgentName
			case hub.EventAgentLeft:
				data.Type = "agent_left"
				data.AgentName = evt.AgentName
			case hub.EventMessage:
				data.Type = "message"
				data.AgentName = evt.AgentName
				if text, ok := evt.Payload.(string); ok {
					data.Content = text
				}
			default:
				continue
			}

			writeSSE(w, flusher, string(evt.Type), data)

		case <-r.Context().Done():
			h.Logger.Info("SSE client disconnected", "room", slug)
			return
		}
	}
}

func writeSSE(w http.ResponseWriter, flusher http.Flusher, eventType string, data any) {
	payload, err := json.Marshal(data)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, payload)
	flusher.Flush()
}
