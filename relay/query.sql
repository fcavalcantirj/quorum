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

-- name: UpsertAgentPresence :one
INSERT INTO agent_presence (room_id, agent_name, card_json, ttl_seconds)
VALUES ($1, $2, $3, $4)
ON CONFLICT (room_id, agent_name)
DO UPDATE SET card_json = EXCLUDED.card_json, last_seen = NOW(), ttl_seconds = EXCLUDED.ttl_seconds
RETURNING *;

-- name: RemoveAgentPresence :exec
DELETE FROM agent_presence WHERE room_id = $1 AND agent_name = $2;

-- name: ListAgentPresenceByRoom :many
SELECT * FROM agent_presence
WHERE room_id = $1 AND last_seen > NOW() - (ttl_seconds || ' seconds')::interval
ORDER BY joined_at;

-- name: UpdateAgentHeartbeat :exec
UPDATE agent_presence SET last_seen = NOW() WHERE room_id = $1 AND agent_name = $2;

-- name: DeleteExpiredAgentPresence :many
DELETE FROM agent_presence
WHERE last_seen < NOW() - (ttl_seconds || ' seconds')::interval
RETURNING room_id, agent_name;

-- name: ListAllPublicAgentPresence :many
SELECT ap.* FROM agent_presence ap
JOIN rooms r ON r.id = ap.room_id
WHERE r.is_private = FALSE
AND ap.last_seen > NOW() - (ap.ttl_seconds || ' seconds')::interval
ORDER BY ap.last_seen DESC;

-- name: UpdateRoomLastActive :exec
UPDATE rooms SET last_active_at = NOW() WHERE id = $1;
