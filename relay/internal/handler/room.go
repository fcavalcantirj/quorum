package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	mw "github.com/fcavalcanti/quorum/relay/internal/middleware"
	"github.com/fcavalcanti/quorum/relay/internal/service"
)

// RoomHandler handles HTTP requests for room operations.
type RoomHandler struct {
	svc     *service.RoomService
	baseURL string
}

// NewRoomHandler creates a new RoomHandler wired to the provided service.
func NewRoomHandler(svc *service.RoomService, baseURL string) *RoomHandler {
	return &RoomHandler{svc: svc, baseURL: baseURL}
}

type createRoomRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type createRoomResponse struct {
	Slug        string `json:"slug"`
	DisplayName string `json:"display_name"`
	URL         string `json:"url"`
	A2AURL      string `json:"a2a_url"`
	BearerToken string `json:"bearer_token"`
	ExpiresAt   string `json:"expires_at,omitempty"`
}

type roomResponse struct {
	Slug        string   `json:"slug"`
	DisplayName string   `json:"display_name"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags"`
	IsPrivate   bool     `json:"is_private"`
	URL         string   `json:"url"`
	A2AURL      string   `json:"a2a_url"`
	CreatedAt   string   `json:"created_at"`
}

// CreateRoom handles POST /rooms — anonymous public room creation.
func (h *RoomHandler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	var req createRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request",
			"message": "Invalid JSON body.",
		})
		return
	}

	anonSID := mw.GetAnonSessionID(r.Context())

	room, plainToken, err := h.svc.CreatePublicRoom(r.Context(), req.Name, anonSID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrSlugTaken):
			// D-03: "This name is taken" — user picks another name
			writeJSON(w, http.StatusConflict, map[string]string{
				"error":   "slug_taken",
				"message": "This name is taken. Please choose another name.",
			})
		case errors.Is(err, service.ErrSlugInvalid):
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "invalid_slug",
				"message": "Room name must produce a valid slug: 3-40 chars, lowercase letters, numbers, and hyphens.",
			})
		case errors.Is(err, service.ErrNameRequired):
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "name_required",
				"message": "Room name is required.",
			})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error":   "internal_error",
				"message": "Failed to create room.",
			})
		}
		return
	}

	resp := createRoomResponse{
		Slug:        room.Slug,
		DisplayName: room.DisplayName,
		URL:         h.baseURL + "/r/" + room.Slug,       // D-01: /r/ prefix
		A2AURL:      h.baseURL + "/r/" + room.Slug + "/a2a", // D-04
		BearerToken: plainToken,
	}
	if room.ExpiresAt.Valid {
		resp.ExpiresAt = room.ExpiresAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}

	writeJSON(w, http.StatusCreated, resp)
}

// GetRoom handles GET /rooms/{slug}.
func (h *RoomHandler) GetRoom(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	room, err := h.svc.GetRoomBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, service.ErrRoomNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error":   "not_found",
				"message": "Room not found.",
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "internal_error",
			"message": "Failed to retrieve room.",
		})
		return
	}

	resp := roomResponse{
		Slug:        room.Slug,
		DisplayName: room.DisplayName,
		Tags:        room.Tags,
		IsPrivate:   room.IsPrivate,
		URL:         h.baseURL + "/r/" + room.Slug,
		A2AURL:      h.baseURL + "/r/" + room.Slug + "/a2a",
		CreatedAt:   room.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	}
	if room.Description.Valid {
		resp.Description = room.Description.String
	}

	writeJSON(w, http.StatusOK, resp)
}

// ListPublicRooms handles GET /rooms with optional limit/offset pagination.
func (h *RoomHandler) ListPublicRooms(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := int32(20)
	offset := int32(0)

	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 && v <= 100 {
			limit = int32(v)
		}
	}
	if offsetStr != "" {
		if v, err := strconv.Atoi(offsetStr); err == nil && v >= 0 {
			offset = int32(v)
		}
	}

	rooms, err := h.svc.ListPublicRooms(r.Context(), limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "internal_error",
			"message": "Failed to list rooms.",
		})
		return
	}

	resp := make([]roomResponse, 0, len(rooms))
	for _, room := range rooms {
		rr := roomResponse{
			Slug:        room.Slug,
			DisplayName: room.DisplayName,
			Tags:        room.Tags,
			IsPrivate:   room.IsPrivate,
			URL:         h.baseURL + "/r/" + room.Slug,
			A2AURL:      h.baseURL + "/r/" + room.Slug + "/a2a",
			CreatedAt:   room.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		}
		if room.Description.Valid {
			rr.Description = room.Description.String
		}
		resp = append(resp, rr)
	}

	writeJSON(w, http.StatusOK, resp)
}

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
