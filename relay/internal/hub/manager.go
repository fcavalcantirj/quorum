package hub

import (
	"context"
	"log/slog"
	"sync"
)

// HubManager manages the lifecycle of per-room RoomHub instances.
// It lazily creates hubs on first access and can remove them when rooms become
// idle or are deleted. GetOrCreate is the primary entry point for the A2A
// endpoint handlers in Plan 02 to obtain the hub for a given room.
//
// HubManager is safe for concurrent use.
type HubManager struct {
	mu       sync.RWMutex
	hubs     map[RoomID]*RoomHub
	registry *PresenceRegistry
	logger   *slog.Logger
}

// NewHubManager creates an empty HubManager backed by the given PresenceRegistry.
func NewHubManager(registry *PresenceRegistry, logger *slog.Logger) *HubManager {
	return &HubManager{
		hubs:     make(map[RoomID]*RoomHub),
		registry: registry,
		logger:   logger,
	}
}

// GetOrCreate returns the RoomHub for the given room, creating and starting it
// if it does not yet exist. The hub goroutine is bound to the provided context —
// canceling ctx shuts down the hub (and all subscriber channels).
//
// The returned hub is guaranteed to have its Run goroutine already started.
func (m *HubManager) GetOrCreate(ctx context.Context, id RoomID) *RoomHub {
	// Fast path: hub already exists.
	m.mu.RLock()
	if h, ok := m.hubs[id]; ok {
		m.mu.RUnlock()
		return h
	}
	m.mu.RUnlock()

	// Slow path: create and register a new hub.
	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock (another goroutine may have beaten us).
	if h, ok := m.hubs[id]; ok {
		return h
	}

	h := NewRoomHub(id, m.registry, m.logger)
	m.hubs[id] = h
	go h.Run(ctx, m.registry)
	m.logger.Info("hub created", "room", id.String())
	return h
}

// Get returns the RoomHub for the given room, or nil if it has not been created.
// Does not create a hub — use GetOrCreate for that.
func (m *HubManager) Get(id RoomID) *RoomHub {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.hubs[id]
}

// Remove removes a hub from the manager's registry. The hub's goroutine is NOT
// stopped here — callers are responsible for canceling the hub's context before
// or after removing it. This method is used when a room is deleted or has been
// idle long enough to be garbage-collected.
func (m *HubManager) Remove(id RoomID) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.hubs[id]; ok {
		delete(m.hubs, id)
		m.logger.Info("hub removed", "room", id.String())
	}
}
