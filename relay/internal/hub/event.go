package hub

import "time"

// EventType identifies the kind of event emitted by a RoomHub.
type EventType string

const (
	// EventAgentJoined is emitted when an agent subscribes to a room.
	EventAgentJoined EventType = "agent_joined"

	// EventAgentLeft is emitted when an agent unsubscribes from a room.
	EventAgentLeft EventType = "agent_left"

	// EventMessage is emitted when an agent broadcasts a message to a room.
	EventMessage EventType = "message"
)

// RoomEvent is emitted by the hub on agent join, leave, or message.
//
// Phase 3 consumes these via the Hub's Events() channel for SSE delivery to
// browser clients watching the room. The Payload field carries type-specific
// data: for agent_joined it is an *a2a.AgentCard; for message it is the raw
// A2A message; for agent_left it is nil.
type RoomEvent struct {
	Type      EventType `json:"type"`
	RoomID    RoomID    `json:"room_id"`
	AgentName string    `json:"agent_name,omitempty"`
	Payload   any       `json:"payload,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}
