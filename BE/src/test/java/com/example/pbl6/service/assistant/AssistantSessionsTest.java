package com.example.pbl6.service.assistant;

import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class AssistantSessionsTest {
    static class TestClock extends Clock {
        long now;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return Instant.ofEpochMilli(now); }
    }
    @Test void ownerTtlAndResetRejectOldConversation() {
        TestClock clock = new TestClock(); var store = new AssistantSessions(clock);
        var a = store.resolve("", "account-a", null);
        assertThrows(AssistantFault.class, () -> store.resolve(a.cookie, "account-b", a.conversation));
        assertFalse(a.active);
        var b = store.resolve("", "guest", null);
        clock.now = 1800001;
        assertThrows(AssistantFault.class, () -> store.resolve(b.cookie, "guest", b.conversation));
        var c = store.resolve("", "guest", null);
        store.begin(c, "id", "hash"); store.invalidate(c.cookie);
        assertThrows(AssistantFault.class, () -> store.finish(c, "id", "hash", "question", Map.of("answer", "late")));
    }
    @Test void duplicateBusyConflictAndHistoryAreBounded() {
        var store = new AssistantSessions(); var s = store.resolve("", "guest", null);
        assertNull(store.begin(s, "id", "h"));
        assertEquals("TURN_IN_PROGRESS", assertThrows(AssistantFault.class, () -> store.begin(s, "id", "h")).code);
        assertEquals("MESSAGE_ID_CONFLICT", assertThrows(AssistantFault.class, () -> store.begin(s, "id", "other")).code);
        assertEquals("CONVERSATION_BUSY", assertThrows(AssistantFault.class, () -> store.begin(s, "other", "h")).code);
        store.finish(s, "id", "h", "q", Map.of("answer", "answer"));
        assertNotNull(store.begin(s, "id", "h").response());
        for (int i=0; i<10; i++) { store.begin(s, "id"+i, "h"); store.finish(s, "id"+i, "h", "q", Map.of("answer", "a")); }
        assertEquals(8, store.history(s).size());
    }
    @Test void capacityAndFailedTurnAreBoundedWithoutRetry() {
        var store = new AssistantSessions();
        var s = store.resolve("", "guest", null);
        store.begin(s, "failed", "hash");
        store.fail(s, "failed", new AssistantFault(504, "DEADLINE_EXCEEDED"));
        assertEquals(504, assertThrows(AssistantFault.class, () -> store.begin(s, "failed", "hash")).status);
        for (int i = 1; i < 1000; i++) store.resolve("", "guest", null);
        assertEquals(503, assertThrows(AssistantFault.class, () -> store.resolve("", "guest", null)).status);
    }
}
