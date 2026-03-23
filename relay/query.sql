-- name: CreateRoom :one
INSERT INTO rooms (slug, display_name, description, tags, is_private, owner_id, anonymous_session_id, token_hash, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetRoomBySlug :one
SELECT * FROM rooms WHERE slug = $1;

-- name: GetRoomByID :one
SELECT * FROM rooms WHERE id = $1;

-- name: GetRoomByTokenHash :one
SELECT * FROM rooms WHERE token_hash = $1;

-- name: ListPublicRooms :many
SELECT * FROM rooms WHERE is_private = FALSE ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: ListRoomsByOwner :many
SELECT * FROM rooms WHERE owner_id = $1 ORDER BY created_at DESC;

-- name: UpdateRoom :one
UPDATE rooms SET display_name = $2, description = $3, tags = $4, last_active_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateRoomActivity :exec
UPDATE rooms SET last_active_at = NOW(), expires_at = NOW() + INTERVAL '3 days'
WHERE id = $1 AND expires_at IS NOT NULL;

-- name: DeleteRoom :exec
DELETE FROM rooms WHERE id = $1;

-- name: DeleteExpiredRooms :exec
DELETE FROM rooms WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- name: ClaimAnonymousRooms :exec
UPDATE rooms SET owner_id = $1, anonymous_session_id = NULL, expires_at = NULL
WHERE anonymous_session_id = $2 AND owner_id IS NULL;

-- name: UpsertUser :one
INSERT INTO users (email, display_name, avatar_url, provider, provider_id)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (provider, provider_id)
DO UPDATE SET display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetRefreshToken :one
SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1;

-- name: RevokeAllUserRefreshTokens :exec
UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL;

-- name: DeleteExpiredRefreshTokens :exec
DELETE FROM refresh_tokens WHERE expires_at < NOW();
