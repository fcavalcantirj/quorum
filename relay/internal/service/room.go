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
