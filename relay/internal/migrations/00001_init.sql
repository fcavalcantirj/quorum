-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,
    provider        TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    provider_id     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_id)
);

CREATE TABLE rooms (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                 TEXT UNIQUE NOT NULL
                             CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
    display_name         TEXT NOT NULL,
    description          TEXT,
    tags                 TEXT[] NOT NULL DEFAULT '{}',
    is_private           BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    anonymous_session_id TEXT,
    token_hash           TEXT NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at           TIMESTAMPTZ
);

CREATE INDEX idx_rooms_slug ON rooms (slug);
CREATE INDEX idx_rooms_owner_id ON rooms (owner_id);
CREATE INDEX idx_rooms_anonymous_session_id ON rooms (anonymous_session_id)
    WHERE anonymous_session_id IS NOT NULL;
CREATE INDEX idx_rooms_expires_at ON rooms (expires_at)
    WHERE expires_at IS NOT NULL;

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

-- +goose Down
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS users;
DROP EXTENSION IF EXISTS "pgcrypto";
