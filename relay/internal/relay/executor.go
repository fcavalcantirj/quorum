package relay

import (
	"context"
	"fmt"
	"time"

	"github.com/a2aproject/a2a-go/a2a"
	"github.com/a2aproject/a2a-go/a2asrv"
	"github.com/a2aproject/a2a-go/a2asrv/eventqueue"

	"github.com/fcavalcanti/quorum/relay/internal/hub"
)

// RoomExecutor implements a2asrv.AgentExecutor for the Quorum relay.
// One executor is created per request — it routes messages to the room's hub.
type RoomExecutor struct {
	Hub      *hub.RoomHub
	Registry *hub.PresenceRegistry
	RoomID   hub.RoomID
}

// Verify at compile time that RoomExecutor satisfies AgentExecutor.
var _ a2asrv.AgentExecutor = (*RoomExecutor)(nil)

// Execute relays the incoming A2A message to all agents in the room hub,
// then writes a completed status event to the queue.
//
// The broadcast is fire-and-forget within the hub goroutine — slow consumers
// have their events dropped rather than blocking this handler.
func (e *RoomExecutor) Execute(
	ctx context.Context,
	reqCtx *a2asrv.RequestContext,
	queue eventqueue.Queue,
) error {
	// 1. Extract the incoming message from the request context.
	msg := reqCtx.Message
	if msg == nil {
		return fmt.Errorf("no message in request context")
	}

	// 2. Route message to room hub via broadcast.
	evt := hub.RoomEvent{
		Type:      hub.EventMessage,
		RoomID:    e.RoomID,
		AgentName: "", // originator name not available from A2A context alone
		Payload:   msg,
		Timestamp: time.Now(),
	}
	e.Hub.Broadcast(evt)

	// 3. Build acknowledgment response message.
	ack := a2a.NewMessage(a2a.MessageRoleAgent, a2a.TextPart{Text: "message relayed"})

	// 4. Write completed status event — SDK serializes to JSON-RPC response.
	// CRITICAL: Complete all queue writes before returning.
	statusEvt := a2a.NewStatusUpdateEvent(reqCtx, a2a.TaskStateCompleted, ack)
	statusEvt.Final = true
	return queue.Write(ctx, statusEvt)
}

// Cancel writes a canceled status event to the queue, stopping task processing.
func (e *RoomExecutor) Cancel(
	ctx context.Context,
	reqCtx *a2asrv.RequestContext,
	queue eventqueue.Queue,
) error {
	statusEvt := a2a.NewStatusUpdateEvent(reqCtx, a2a.TaskStateCanceled, nil)
	statusEvt.Final = true
	return queue.Write(ctx, statusEvt)
}
