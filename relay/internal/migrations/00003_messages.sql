-- +goose Up
CREATE TABLE messages (
    id          BIGSERIAL PRIMARY KEY,
    room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    agent_name  TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_room_created ON messages(room_id, id);

-- +goose Down
DROP TABLE IF EXISTS messages;
