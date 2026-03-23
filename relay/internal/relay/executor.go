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
type RoomExecutor struct {
	Hub      *hub.RoomHub
	Registry *hub.PresenceRegistry
	RoomID   hub.RoomID
	Messages *hub.MessageStore
}

var _ a2asrv.AgentExecutor = (*RoomExecutor)(nil)

func (e *RoomExecutor) Execute(
	ctx context.Context,
	reqCtx *a2asrv.RequestContext,
	queue eventqueue.Queue,
) error {
	msg := reqCtx.Message
	if msg == nil {
		return fmt.Errorf("no message in request context")
	}

	// Store message for polling
	if e.Messages != nil {
		agentName := ""
		// Extract text from message parts for storage
		for _, part := range msg.Parts {
			if tp, ok := part.(a2a.TextPart); ok {
				e.Messages.Append(e.RoomID, agentName, tp.Text)
				break
			}
		}
	}

	// Broadcast to SSE subscribers
	evt := hub.RoomEvent{
		Type:      hub.EventMessage,
		RoomID:    e.RoomID,
		AgentName: "",
		Payload:   msg,
		Timestamp: time.Now(),
	}
	e.Hub.Broadcast(evt)

	ack := a2a.NewMessage(a2a.MessageRoleAgent, a2a.TextPart{Text: "message relayed"})

	statusEvt := a2a.NewStatusUpdateEvent(reqCtx, a2a.TaskStateCompleted, ack)
	statusEvt.Final = true
	return queue.Write(ctx, statusEvt)
}

func (e *RoomExecutor) Cancel(
	ctx context.Context,
	reqCtx *a2asrv.RequestContext,
	queue eventqueue.Queue,
) error {
	statusEvt := a2a.NewStatusUpdateEvent(reqCtx, a2a.TaskStateCanceled, nil)
	statusEvt.Final = true
	return queue.Write(ctx, statusEvt)
}
