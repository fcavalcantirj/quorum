// Package presence manages agent presence lifecycle including TTL-based eviction.
package presence

import (
	"context"
	"log/slog"
	"time"

	"github.com/fcavalcanti/quorum/relay/internal/db"
	"github.com/fcavalcanti/quorum/relay/internal/hub"
)

// StartReaper launches a background goroutine that periodically evicts agents
// whose last_seen timestamp exceeds their configured TTL. Per DISC-04.
//
// The reaper runs every 60 seconds. On each cycle it:
//  1. Calls DeleteExpiredAgentPresence to atomically evict from the DB.
//  2. Removes each evicted agent from the in-memory PresenceRegistry.
//  3. Calls Unsubscribe on the room hub to emit an agent_left event.
//
// The reaper exits when ctx is canceled (on graceful shutdown).
func StartReaper(
	ctx context.Context,
	queries *db.Queries,
	registry *hub.PresenceRegistry,
	hubMgr *hub.HubManager,
	logger *slog.Logger,
) {
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		logger.Info("presence reaper started")

		for {
			select {
			case <-ticker.C:
				runReaperCycle(ctx, queries, registry, hubMgr, logger)
			case <-ctx.Done():
				logger.Info("presence reaper stopped")
				return
			}
		}
	}()
}

// runReaperCycle executes one eviction cycle.
// Separated for testability and clarity.
func runReaperCycle(
	ctx context.Context,
	queries *db.Queries,
	registry *hub.PresenceRegistry,
	hubMgr *hub.HubManager,
	logger *slog.Logger,
) {
	// 1. Delete expired from DB; returns the list of (room_id, agent_name) removed.
	removed, err := queries.DeleteExpiredAgentPresence(ctx)
	if err != nil {
		logger.Error("reaper: failed to delete expired agents", "error", err)
		return
	}

	if len(removed) == 0 {
		return
	}

	// 2. Remove each evicted agent from in-memory registry and hub.
	for _, row := range removed {
		roomID := hub.NewRoomID(row.RoomID.Bytes)

		// Remove from in-memory presence registry.
		registry.Remove(roomID, row.AgentName)

		// Unsubscribe from hub if the hub exists for this room.
		// Unsubscribe emits an agent_left event to remaining subscribers.
		if h := hubMgr.Get(roomID); h != nil {
			h.Unsubscribe(row.AgentName)
		}

		logger.Info("reaper: evicted agent",
			"room", roomID.String(),
			"agent", row.AgentName,
		)
	}
}
