package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/token"
)

var (
	ErrSlugTaken    = errors.New("room name is already taken")
	ErrSlugInvalid  = errors.New("slug must be 3-40 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphens")
	ErrNameRequired = errors.New("room name is required")
	ErrRoomNotFound = errors.New("room not found")
	ErrNotRoomOwner = errors.New("you are not the owner of this room")
)

// slugRegex requires at least 3 chars: first char alnum, middle chars alnum or hyphen, last char alnum.
var slugRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`)

type RoomService struct {
	q *db.Queries
}

func NewRoomService(q *db.Queries) *RoomService {
	return &RoomService{q: q}
}

// Slugify converts a display name to a URL-safe slug per D-02.
// Lowercase, replace spaces/underscores with hyphens, strip non-alnum, collapse multiple hyphens.
func Slugify(name string) string {
	s := strings.ToLower(name)
	var b strings.Builder
	for _, r := range s {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else if r == ' ' || r == '-' || r == '_' {
			b.WriteRune('-')
		}
		// skip non-ASCII and other special chars
	}
	slug := b.String()
	// Collapse multiple hyphens
	for strings.Contains(slug, "--") {
		slug = strings.ReplaceAll(slug, "--", "-")
	}
	// Trim leading/trailing hyphens
	slug = strings.Trim(slug, "-")
	return slug
}

// ValidateSlug checks that the slug matches the required format.
func ValidateSlug(slug string) error {
	if !slugRegex.MatchString(slug) {
		return ErrSlugInvalid
	}
	return nil
}

// CreatePublicRoom creates an anonymous public room (ROOM-01).
// Returns the created room and plaintext bearer token.
func (s *RoomService) CreatePublicRoom(ctx context.Context, displayName, anonSessionID string) (*db.Room, string, error) {
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		return nil, "", ErrNameRequired
	}

	slug := Slugify(displayName)
	if err := ValidateSlug(slug); err != nil {
		return nil, "", err
	}

	plainToken, tokenHash, err := token.GenerateRoomToken()
	if err != nil {
		return nil, "", fmt.Errorf("generate token: %w", err)
	}

	// Anonymous rooms expire after 3 days of inactivity (D-05)
	expiresAt := pgtype.Timestamptz{
		Time:  time.Now().Add(3 * 24 * time.Hour),
		Valid: true,
	}

	anonSID := pgtype.Text{}
	if anonSessionID != "" {
		anonSID = pgtype.Text{String: anonSessionID, Valid: true}
	}

	row, err := s.q.CreateRoom(ctx, db.CreateRoomParams{
		Slug:               slug,
		DisplayName:        displayName,
		TokenHash:          tokenHash,
		IsPrivate:          false,
		AnonymousSessionID: anonSID,
		ExpiresAt:          expiresAt,
		// Description, Tags, OwnerID left as zero values (NULL / empty)
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, "", ErrSlugTaken
		}
		return nil, "", fmt.Errorf("create room: %w", err)
	}

	return &row, plainToken, nil
}

// GetRoomBySlug retrieves a room by its slug.
func (s *RoomService) GetRoomBySlug(ctx context.Context, slug string) (*db.Room, error) {
	room, err := s.q.GetRoomBySlug(ctx, slug)
	if err != nil {
		return nil, ErrRoomNotFound
	}
	return &room, nil
}

// ListPublicRooms returns paginated public rooms.
func (s *RoomService) ListPublicRooms(ctx context.Context, limit, offset int32) ([]db.Room, error) {
	return s.q.ListPublicRooms(ctx, db.ListPublicRoomsParams{
		Limit:  limit,
		Offset: offset,
	})
}

// CreatePrivateRoom creates an authenticated, owned private room (ROOM-02).
// Private rooms are not listed publicly and do not expire.
// Returns the created room and plaintext bearer token.
func (s *RoomService) CreatePrivateRoom(ctx context.Context, displayName, description string, tags []string, ownerID pgtype.UUID) (*db.Room, string, error) {
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		return nil, "", ErrNameRequired
	}

	slug := Slugify(displayName)
	if err := ValidateSlug(slug); err != nil {
		return nil, "", err
	}

	plainToken, tokenHash, err := token.GenerateRoomToken()
	if err != nil {
		return nil, "", fmt.Errorf("generate token: %w", err)
	}

	descriptionPg := pgtype.Text{}
	if description != "" {
		descriptionPg = pgtype.Text{String: description, Valid: true}
	}

	if tags == nil {
		tags = []string{}
	}

	row, err := s.q.CreateRoom(ctx, db.CreateRoomParams{
		Slug:        slug,
		DisplayName: displayName,
		Description: descriptionPg,
		Tags:        tags,
		IsPrivate:   true,
		OwnerID:     ownerID,
		// AnonymousSessionID: zero value (NULL) — owned rooms have no anon session
		// ExpiresAt: zero value (NULL) — owned rooms do not expire (D-05)
		TokenHash: tokenHash,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, "", ErrSlugTaken
		}
		return nil, "", fmt.Errorf("create private room: %w", err)
	}

	return &row, plainToken, nil
}

// DeleteRoom deletes a room by slug. Only the room's owner may delete it.
// Returns ErrNotRoomOwner if the user does not own the room.
// Returns ErrRoomNotFound if the room does not exist.
func (s *RoomService) DeleteRoom(ctx context.Context, roomID pgtype.UUID, userID pgtype.UUID) error {
	room, err := s.q.GetRoomByID(ctx, roomID)
	if err != nil {
		return ErrRoomNotFound
	}

	// Owner check: OwnerID must be non-null and match the requesting user
	if !room.OwnerID.Valid || room.OwnerID.Bytes != userID.Bytes {
		return ErrNotRoomOwner
	}

	if err := s.q.DeleteRoom(ctx, roomID); err != nil {
		return fmt.Errorf("delete room: %w", err)
	}
	return nil
}

// UpdateRoom updates a room's display name, description, and tags.
// Only the room's owner may update it. Slug is immutable (ROOM-06).
func (s *RoomService) UpdateRoom(ctx context.Context, roomID pgtype.UUID, userID pgtype.UUID, displayName, description string, tags []string) (*db.Room, error) {
	room, err := s.q.GetRoomByID(ctx, roomID)
	if err != nil {
		return nil, ErrRoomNotFound
	}

	// Owner check
	if !room.OwnerID.Valid || room.OwnerID.Bytes != userID.Bytes {
		return nil, ErrNotRoomOwner
	}

	// Use existing values if not provided
	newDisplayName := room.DisplayName
	if displayName != "" {
		newDisplayName = strings.TrimSpace(displayName)
	}

	newDescription := room.Description
	if description != "" {
		newDescription = pgtype.Text{String: description, Valid: true}
	}

	newTags := room.Tags
	if tags != nil {
		newTags = tags
	}

	updated, err := s.q.UpdateRoom(ctx, db.UpdateRoomParams{
		ID:          roomID,
		DisplayName: newDisplayName,
		Description: newDescription,
		Tags:        newTags,
	})
	if err != nil {
		return nil, fmt.Errorf("update room: %w", err)
	}
	return &updated, nil
}

// ListRoomsByOwner returns all rooms owned by the given user.
func (s *RoomService) ListRoomsByOwner(ctx context.Context, ownerID pgtype.UUID) ([]db.Room, error) {
	return s.q.ListRoomsByOwner(ctx, ownerID)
}

// GetRoomByID retrieves a room by its UUID.
func (s *RoomService) GetRoomByID(ctx context.Context, roomID pgtype.UUID) (*db.Room, error) {
	room, err := s.q.GetRoomByID(ctx, roomID)
	if err != nil {
		return nil, ErrRoomNotFound
	}
	return &room, nil
}
