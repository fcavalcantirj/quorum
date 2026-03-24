-- Schema for sqlc code generation.
-- This is the DDL from 00001_init.sql without goose annotations.

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

CREATE TABLE agent_presence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    agent_name      TEXT NOT NULL,
    card_json       JSONB NOT NULL,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ttl_seconds     INT NOT NULL DEFAULT 300,
    UNIQUE (room_id, agent_name)
);

CREATE INDEX idx_agent_presence_room_id ON agent_presence (room_id);
CREATE INDEX idx_agent_presence_last_seen ON agent_presence (last_seen);

CREATE TABLE messages (
    id          BIGSERIAL PRIMARY KEY,
    room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    agent_name  TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
