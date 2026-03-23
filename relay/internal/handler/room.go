package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
	mw "github.com/fcavalcanti/quorum/relay/internal/middleware"
	"github.com/fcavalcanti/quorum/relay/internal/service"
)

// parseUserUUID extracts and parses the user ID from JWT context.
// Returns the pgtype.UUID and true on success, or writes 401/500 and returns false.
func parseUserUUID(w http.ResponseWriter, r *http.Request) (pgtype.UUID, bool) {
	userIDStr, ok := mw.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "unauthorized",
			"message": "Authentication required.",
		})
		return pgtype.UUID{}, false
	}

	var pgUUID pgtype.UUID
	if err := pgUUID.Scan(userIDStr); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "invalid_token",
			"message": "Invalid user ID in token.",
		})
		return pgtype.UUID{}, false
	}
	return pgUUID, true
}

// RoomHandler handles HTTP requests for room operations.
type RoomHandler struct {
	svc      *service.RoomService
	registry *hub.PresenceRegistry
	baseURL  string
}

// NewRoomHandler creates a new RoomHandler wired to the provided service.
func NewRoomHandler(svc *service.RoomService, baseURL string, registry *hub.PresenceRegistry) *RoomHandler {
	return &RoomHandler{svc: svc, baseURL: baseURL, registry: registry}
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
	AgentCount  int      `json:"agent_count"`
	URL         string   `json:"url"`
	A2AURL      string   `json:"a2a_url"`
	CreatedAt   string   `json:"created_at"`
}

func (h *RoomHandler) buildRoomResponse(room *db.Room) roomResponse {
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
	if h.registry != nil && room.ID.Valid {
		roomID := hub.NewRoomID(room.ID.Bytes)
		resp.AgentCount = h.registry.AgentCount(roomID)
	}
	return resp
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

	// Check if user is authenticated — if so, assign ownership
	var ownerID pgtype.UUID
	if userIDStr, ok := mw.UserIDFromContext(r.Context()); ok {
		_ = ownerID.Scan(userIDStr)
	}

	room, plainToken, err := h.svc.CreatePublicRoom(r.Context(), req.Name, anonSID, ownerID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrSlugTaken):
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
			slog.Error("create public room failed", "error", err)
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

	writeJSON(w, http.StatusOK, h.buildRoomResponse(room))
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
		r := room
		resp = append(resp, h.buildRoomResponse(&r))
	}

	writeJSON(w, http.StatusOK, resp)
}

// CreatePrivateRoom handles POST /rooms/private — authenticated private room creation.
func (h *RoomHandler) CreatePrivateRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserUUID(w, r)
	if !ok {
		return
	}

	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description,omitempty"`
		Tags        []string `json:"tags,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request",
			"message": "Invalid JSON body.",
		})
		return
	}

	room, plainToken, err := h.svc.CreatePrivateRoom(r.Context(), req.Name, req.Description, req.Tags, userID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrSlugTaken):
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
		URL:         h.baseURL + "/r/" + room.Slug,
		A2AURL:      h.baseURL + "/r/" + room.Slug + "/a2a",
		BearerToken: plainToken,
	}

	writeJSON(w, http.StatusCreated, resp)
}

// DeleteRoom handles DELETE /rooms/{slug} — owner-only room deletion.
func (h *RoomHandler) DeleteRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserUUID(w, r)
	if !ok {
		return
	}

	slug := chi.URLParam(r, "slug")

	// Resolve slug to room
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

	if err := h.svc.DeleteRoom(r.Context(), room.ID, userID); err != nil {
		switch {
		case errors.Is(err, service.ErrNotRoomOwner):
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error":   "forbidden",
				"message": "You are not the owner of this room.",
			})
		case errors.Is(err, service.ErrRoomNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error":   "not_found",
				"message": "Room not found.",
			})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error":   "internal_error",
				"message": "Failed to delete room.",
			})
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateRoom handles PATCH /rooms/{slug} — owner-only room metadata update.
func (h *RoomHandler) UpdateRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserUUID(w, r)
	if !ok {
		return
	}

	slug := chi.URLParam(r, "slug")

	// Resolve slug to room
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

	var req struct {
		DisplayName *string  `json:"display_name,omitempty"`
		Description *string  `json:"description,omitempty"`
		Tags        []string `json:"tags,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request",
			"message": "Invalid JSON body.",
		})
		return
	}

	displayName := ""
	if req.DisplayName != nil {
		displayName = *req.DisplayName
	}
	description := ""
	if req.Description != nil {
		description = *req.Description
	}

	updated, err := h.svc.UpdateRoom(r.Context(), room.ID, userID, displayName, description, req.Tags)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotRoomOwner):
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error":   "forbidden",
				"message": "You are not the owner of this room.",
			})
		case errors.Is(err, service.ErrRoomNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error":   "not_found",
				"message": "Room not found.",
			})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error":   "internal_error",
				"message": "Failed to update room.",
			})
		}
		return
	}

	resp := h.buildRoomResponse(updated)

	writeJSON(w, http.StatusOK, resp)
}

// ListMyRooms handles GET /me/rooms — returns all rooms owned by the authenticated user.
func (h *RoomHandler) ListMyRooms(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserUUID(w, r)
	if !ok {
		return
	}

	rooms, err := h.svc.ListRoomsByOwner(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "internal_error",
			"message": "Failed to list rooms.",
		})
		return
	}

	resp := make([]roomResponse, 0, len(rooms))
	for _, room := range rooms {
		r := room
		resp = append(resp, h.buildRoomResponse(&r))
	}

	writeJSON(w, http.StatusOK, resp)
}

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
