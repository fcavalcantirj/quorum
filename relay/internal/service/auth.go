package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/token"
)

var (
	ErrInvalidRefreshToken = errors.New("invalid or expired refresh token")
	ErrRefreshTokenExpired = errors.New("refresh token has expired")
)

// AuthService handles JWT session management, refresh tokens, and OAuth user upsert.
type AuthService struct {
	queries   *db.Queries
	jwtSecret []byte
}

// NewAuthService creates a new AuthService.
func NewAuthService(q *db.Queries, jwtSecret string) *AuthService {
	return &AuthService{
		queries:   q,
		jwtSecret: []byte(jwtSecret),
	}
}

// UpsertOAuthUser creates or updates a user record from OAuth provider data.
func (s *AuthService) UpsertOAuthUser(ctx context.Context, email, displayName, avatarURL, provider, providerID string) (*db.User, error) {
	avatarPgText := pgtype.Text{}
	if avatarURL != "" {
		avatarPgText = pgtype.Text{String: avatarURL, Valid: true}
	}

	user, err := s.queries.UpsertUser(ctx, db.UpsertUserParams{
		Email:       email,
		DisplayName: displayName,
		AvatarUrl:   avatarPgText,
		Provider:    provider,
		ProviderID:  providerID,
	})
	if err != nil {
		return nil, fmt.Errorf("upsert user: %w", err)
	}
	return &user, nil
}

// CreateSession issues a signed HS256 JWT access token valid for 30 days.
// The token carries sub, email, name claims and is signed with s.jwtSecret.
func (s *AuthService) CreateSession(userID pgtype.UUID, email, name string) (string, error) {
	b := userID.Bytes
	userIDStr := fmt.Sprintf(
		"%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16],
	)

	now := time.Now()
	claims := jwt.MapClaims{
		"sub":   userIDStr,
		"email": email,
		"name":  name,
		"iat":   now.Unix(),
		"exp":   now.Add(30 * 24 * time.Hour).Unix(),
	}

	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := t.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("sign JWT: %w", err)
	}
	return signed, nil
}

// CreateRefreshToken generates a new opaque refresh token, stores its hash in the DB,
// and returns the plaintext token (given to the client once, never stored plaintext).
// Refresh tokens expire after 90 days.
func (s *AuthService) CreateRefreshToken(ctx context.Context, userID pgtype.UUID) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate refresh token: %w", err)
	}
	plaintext := "qrf_" + base64.RawURLEncoding.EncodeToString(b)
	hash := token.HashToken(plaintext)

	expiresAt := pgtype.Timestamptz{
		Time:  time.Now().Add(90 * 24 * time.Hour),
		Valid: true,
	}

	_, err := s.queries.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:    userID,
		TokenHash: hash,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return "", fmt.Errorf("store refresh token: %w", err)
	}
	return plaintext, nil
}

// RefreshSession validates the given refresh token plaintext, revokes it, and issues
// a new access token + refresh token pair (rotate-on-use per D-09).
func (s *AuthService) RefreshSession(ctx context.Context, refreshPlaintext string) (newAccessToken, newRefreshPlaintext string, err error) {
	hash := token.HashToken(refreshPlaintext)

	row, err := s.queries.GetRefreshToken(ctx, hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", ErrInvalidRefreshToken
		}
		return "", "", fmt.Errorf("get refresh token: %w", err)
	}

	// Check expiry (DB query already filters revoked tokens; check expiry separately)
	if row.ExpiresAt.Valid && time.Now().After(row.ExpiresAt.Time) {
		return "", "", ErrRefreshTokenExpired
	}

	// Revoke old token (rotate-on-use)
	if err := s.queries.RevokeRefreshToken(ctx, row.ID); err != nil {
		return "", "", fmt.Errorf("revoke refresh token: %w", err)
	}

	// Fetch user for JWT claims
	user, err := s.queries.GetUserByID(ctx, row.UserID)
	if err != nil {
		return "", "", fmt.Errorf("get user for refresh: %w", err)
	}

	// Issue new access token
	newAccessToken, err = s.CreateSession(row.UserID, user.Email, user.DisplayName)
	if err != nil {
		return "", "", fmt.Errorf("create session: %w", err)
	}

	// Issue new refresh token
	newRefreshPlaintext, err = s.CreateRefreshToken(ctx, row.UserID)
	if err != nil {
		return "", "", fmt.Errorf("create refresh token: %w", err)
	}

	return newAccessToken, newRefreshPlaintext, nil
}

// ClaimAnonymousRooms assigns any rooms created under anonSessionID to the given user.
// If anonSessionID is empty or no rooms match, this is a no-op (not an error).
func (s *AuthService) ClaimAnonymousRooms(ctx context.Context, userID pgtype.UUID, anonSessionID string) error {
	if anonSessionID == "" {
		return nil
	}

	err := s.queries.ClaimAnonymousRooms(ctx, db.ClaimAnonymousRoomsParams{
		OwnerID:            userID,
		AnonymousSessionID: pgtype.Text{String: anonSessionID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("claim anonymous rooms: %w", err)
	}

	slog.Info("anonymous rooms claimed", "user_id", userID, "anon_session_id", anonSessionID)
	return nil
}

// GetUserByID retrieves a user by their UUID string (from JWT sub claim).
func (s *AuthService) GetUserByID(ctx context.Context, userID pgtype.UUID) (*db.User, error) {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return &user, nil
}

// Logout revokes the given refresh token, invalidating that session.
func (s *AuthService) Logout(ctx context.Context, refreshPlaintext string) error {
	if refreshPlaintext == "" {
		return nil
	}

	hash := token.HashToken(refreshPlaintext)
	row, err := s.queries.GetRefreshToken(ctx, hash)
	if err != nil {
		// Token not found — already logged out or invalid; treat as success
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("get refresh token for logout: %w", err)
	}

	if err := s.queries.RevokeRefreshToken(ctx, row.ID); err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	return nil
}
