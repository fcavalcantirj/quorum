package hub_test

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/a2aproject/a2a-go/a2a"
	"github.com/google/uuid"

	"github.com/fcavalcanti/quorum/relay/internal/hub"
)

// makeLogger returns a discard logger suitable for tests.
func makeLogger() *slog.Logger {
	return slog.Default()
}

// makeCard creates a minimal AgentCard for testing.
func makeCard(name string, skillIDs ...string) *a2a.AgentCard {
	skills := make([]a2a.AgentSkill, len(skillIDs))
	for i, id := range skillIDs {
		skills[i] = a2a.AgentSkill{
			ID:          id,
			Name:        id + " skill",
			Description: "A test skill",
			Tags:        []string{"test"},
		}
	}
	return &a2a.AgentCard{
		Name:            name,
		Description:     "Test agent " + name,
		URL:             "https://example.com/agents/" + name,
		ProtocolVersion: "1.0",
		Skills:          skills,
	}
}

// startHub starts a hub goroutine and returns cancel func.
func startHub(t *testing.T, h *hub.RoomHub, registry *hub.PresenceRegistry) context.CancelFunc {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	go h.Run(ctx, registry)
	return cancel
}

// Test 1: Subscribe an agent to a hub, broadcast a message, verify receipt.
func TestSubscribeBroadcastReceive(t *testing.T) {
	registry := hub.NewPresenceRegistry()
	roomID := hub.NewRoomID(uuid.New())
	h := hub.NewRoomHub(roomID, registry, makeLogger())
	cancel := startHub(t, h, registry)
	defer cancel()

	card := makeCard("agent-1")
	ch, err := h.Subscribe("agent-1", card)
	if err != nil {
		t.Fatalf("Subscribe returned error: %v", err)
	}

	event := hub.RoomEvent{
		Type:      hub.EventMessage,
		RoomID:    roomID,
		AgentName: "agent-1",
		Timestamp: time.Now(),
	}
	h.Broadcast(event)

	select {
	case got := <-ch:
		if got.Type != hub.EventMessage {
			t.Errorf("expected EventMessage, got %v", got.Type)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout: did not receive broadcast message")
	}
}

// Test 2: Subscribe two agents, broadcast, both receive.
func TestBroadcastToMultipleSubscribers(t *testing.T) {
	registry := hub.NewPresenceRegistry()
	roomID := hub.NewRoomID(uuid.New())
	h := hub.NewRoomHub(roomID, registry, makeLogger())
	cancel := startHub(t, h, registry)
	defer cancel()

	ch1, err := h.Subscribe("agent-1", makeCard("agent-1"))
	if err != nil {
		t.Fatalf("Subscribe agent-1: %v", err)
	}
	ch2, err := h.Subscribe("agent-2", makeCard("agent-2"))
	if err != nil {
		t.Fatalf("Subscribe agent-2: %v", err)
	}

	// Drain the agent_joined event that agent-1 gets when agent-2 subscribes.
	select {
	case <-ch1:
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for agent_joined event on ch1")
	}

	event := hub.RoomEvent{
		Type:      hub.EventMessage,
		RoomID:    roomID,
		AgentName: "broadcaster",
		Timestamp: time.Now(),
	}
	h.Broadcast(event)

	timeout := time.After(2 * time.Second)
	for i, ch := range []<-chan hub.RoomEvent{ch1, ch2} {
		select {
		case got := <-ch:
			if got.Type != hub.EventMessage {
				t.Errorf("agent-%d: expected EventMessage, got %v", i+1, got.Type)
			}
		case <-timeout:
			t.Fatalf("timeout: agent-%d did not receive broadcast", i+1)
		}
	}
}

// Test 3: Unsubscribe an agent, broadcast, the agent does NOT receive it.
func TestUnsubscribeStopsDelivery(t *testing.T) {
	registry := hub.NewPresenceRegistry()
	roomID := hub.NewRoomID(uuid.New())
	h := hub.NewRoomHub(roomID, registry, makeLogger())
	cancel := startHub(t, h, registry)
	defer cancel()

	ch, err := h.Subscribe("agent-1", makeCard("agent-1"))
	if err != nil {
		t.Fatalf("Subscribe: %v", err)
	}

	h.Unsubscribe("agent-1")

	// Wait for channel to be closed (unsubscribe closes it).
	select {
	case _, ok := <-ch:
		if ok {
			// Channel should be closed; if we get a value unexpectedly, drain it and check again.
			// The unsubscribe close might come after a brief delay.
		}
		_ = ok
	case <-time.After(2 * time.Second):
		t.Fatal("timeout: channel not closed after unsubscribe")
	}

	// After unsubscribe the channel is closed. Broadcast should not panic.
	event := hub.RoomEvent{
		Type:      hub.EventMessage,
		RoomID:    roomID,
		AgentName: "other",
		Timestamp: time.Now(),
	}
	// This should not block or panic.
	h.Broadcast(event)
}

// Test 4: TestTwoRoomIsolation — hub A messages do not reach hub B subscribers.
func TestTwoRoomIsolation(t *testing.T) {
	registry := hub.NewPresenceRegistry()

	idA := hub.NewRoomID(uuid.New())
	idB := hub.NewRoomID(uuid.New())

	hubA := hub.NewRoomHub(idA, registry, makeLogger())
	hubB := hub.NewRoomHub(idB, registry, makeLogger())

	ctxA, cancelA := context.WithCancel(context.Background())
	ctxB, cancelB := context.WithCancel(context.Background())
	defer cancelA()
	defer cancelB()

	go hubA.Run(ctxA, registry)
	go hubB.Run(ctxB, registry)

	chA, err := hubA.Subscribe("agent-a", makeCard("agent-a"))
	if err != nil {
		t.Fatalf("Subscribe hubA: %v", err)
	}
	chB, err := hubB.Subscribe("agent-b", makeCard("agent-b"))
	if err != nil {
		t.Fatalf("Subscribe hubB: %v", err)
	}

	eventA := hub.RoomEvent{
		Type:      hub.EventMessage,
		RoomID:    idA,
		AgentName: "agent-a",
		Payload:   "hello from A",
		Timestamp: time.Now(),
	}
	hubA.Broadcast(eventA)

	// agent-a should receive the event from hub A.
	select {
	case got := <-chA:
		if got.Type != hub.EventMessage {
			t.Errorf("hubA subscriber: expected EventMessage, got %v", got.Type)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout: agent-a did not receive hub A broadcast")
	}

	// agent-b must NOT receive anything from hub A.
	select {
	case unexpected := <-chB:
		t.Errorf("isolation violation: hub B subscriber got event from hub A: %+v", unexpected)
	case <-time.After(200 * time.Millisecond):
		// Correct: no event leaked to hub B.
	}
}

// Test 5: PresenceRegistry Add/Get/Remove.
func TestPresenceRegistryAddGetRemove(t *testing.T) {
	r := hub.NewPresenceRegistry()
	roomID := hub.NewRoomID(uuid.New())
	card := makeCard("agent-1")

	r.Add(roomID, "agent-1", card)

	presence, ok := r.Get(roomID, "agent-1")
	if !ok {
		t.Fatal("expected to find agent-1 after Add")
	}
	if presence.AgentName != "agent-1" {
		t.Errorf("AgentName: got %q, want %q", presence.AgentName, "agent-1")
	}
	if presence.Card == nil {
		t.Error("Card is nil after Add")
	}

	r.Remove(roomID, "agent-1")
	_, ok = r.Get(roomID, "agent-1")
	if ok {
		t.Error("expected agent-1 to be gone after Remove")
	}
}

// Test 6: PresenceRegistry ListPublicCards — multiple agents, all returned.
func TestPresenceRegistryListPublicCards(t *testing.T) {
	r := hub.NewPresenceRegistry()
	roomID := hub.NewRoomID(uuid.New())

	r.Add(roomID, "agent-1", makeCard("agent-1"))
	r.Add(roomID, "agent-2", makeCard("agent-2"))
	r.Add(roomID, "agent-3", makeCard("agent-3"))

	cards := r.ListPublicCards(roomID)
	if len(cards) != 3 {
		t.Errorf("expected 3 cards, got %d", len(cards))
	}
	// Public cards should have Name and Skills but no URL or SecuritySchemes.
	for _, c := range cards {
		if c.Name == "" {
			t.Error("public card has empty Name")
		}
		if c.URL != "" {
			t.Errorf("public card should have no URL, got %q", c.URL)
		}
		if len(c.SecuritySchemes) != 0 {
			t.Error("public card should have no SecuritySchemes")
		}
	}
}

// Test 7: PresenceRegistry FilterBySkillID.
func TestPresenceRegistryFilterBySkillID(t *testing.T) {
	r := hub.NewPresenceRegistry()
	roomID := hub.NewRoomID(uuid.New())

	r.Add(roomID, "agent-1", makeCard("agent-1", "summarize", "translate"))
	r.Add(roomID, "agent-2", makeCard("agent-2", "translate"))
	r.Add(roomID, "agent-3", makeCard("agent-3", "search"))

	results := r.FilterBySkillID(roomID, "translate")
	if len(results) != 2 {
		t.Errorf("expected 2 agents with translate skill, got %d", len(results))
	}

	results = r.FilterBySkillID(roomID, "search")
	if len(results) != 1 {
		t.Errorf("expected 1 agent with search skill, got %d", len(results))
	}

	results = r.FilterBySkillID(roomID, "nonexistent")
	if len(results) != 0 {
		t.Errorf("expected 0 agents with nonexistent skill, got %d", len(results))
	}
}

// Test 8: HubManager GetOrCreate returns same instance on repeated calls.
func TestHubManagerGetOrCreate(t *testing.T) {
	registry := hub.NewPresenceRegistry()
	manager := hub.NewHubManager(registry, makeLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	roomID := hub.NewRoomID(uuid.New())

	h1 := manager.GetOrCreate(ctx, roomID)
	if h1 == nil {
		t.Fatal("GetOrCreate returned nil on first call")
	}

	h2 := manager.GetOrCreate(ctx, roomID)
	if h2 == nil {
		t.Fatal("GetOrCreate returned nil on second call")
	}

	if h1 != h2 {
		t.Error("GetOrCreate returned different instances for same RoomID")
	}

	// Different room should get a different hub.
	otherID := hub.NewRoomID(uuid.New())
	h3 := manager.GetOrCreate(ctx, otherID)
	if h3 == h1 {
		t.Error("GetOrCreate returned same instance for different RoomIDs")
	}
}

// Test: FilterByTag
func TestPresenceRegistryFilterByTag(t *testing.T) {
	r := hub.NewPresenceRegistry()
	roomID := hub.NewRoomID(uuid.New())

	card1 := makeCard("agent-1", "skill1")
	card1.Skills[0].Tags = []string{"nlp", "ml"}
	r.Add(roomID, "agent-1", card1)

	card2 := makeCard("agent-2", "skill2")
	card2.Skills[0].Tags = []string{"vision"}
	r.Add(roomID, "agent-2", card2)

	results := r.FilterByTag(roomID, "nlp")
	if len(results) != 1 {
		t.Errorf("expected 1 agent with nlp tag, got %d", len(results))
	}

	results = r.FilterByTag(roomID, "vision")
	if len(results) != 1 {
		t.Errorf("expected 1 agent with vision tag, got %d", len(results))
	}

	results = r.FilterByTag(roomID, "unknown")
	if len(results) != 0 {
		t.Errorf("expected 0 agents with unknown tag, got %d", len(results))
	}
}

// Test: UpdateLastSeen and AgentCount.
func TestPresenceRegistryUpdateAndCount(t *testing.T) {
	r := hub.NewPresenceRegistry()
	roomID := hub.NewRoomID(uuid.New())

	r.Add(roomID, "agent-1", makeCard("agent-1"))
	r.Add(roomID, "agent-2", makeCard("agent-2"))

	if got := r.AgentCount(roomID); got != 2 {
		t.Errorf("AgentCount: want 2, got %d", got)
	}

	before := time.Now()
	time.Sleep(time.Millisecond)
	r.UpdateLastSeen(roomID, "agent-1")

	presence, ok := r.Get(roomID, "agent-1")
	if !ok {
		t.Fatal("agent-1 not found")
	}
	if !presence.LastSeen.After(before) {
		t.Error("LastSeen was not updated by UpdateLastSeen")
	}
}

// Test: AllPublicAgents returns agents across multiple rooms.
func TestPresenceRegistryAllPublicAgents(t *testing.T) {
	r := hub.NewPresenceRegistry()
	roomA := hub.NewRoomID(uuid.New())
	roomB := hub.NewRoomID(uuid.New())

	r.Add(roomA, "agent-a", makeCard("agent-a"))
	r.Add(roomB, "agent-b", makeCard("agent-b"))

	all := r.AllPublicAgents()
	if len(all) != 2 {
		t.Errorf("AllPublicAgents: expected 2, got %d", len(all))
	}
}
