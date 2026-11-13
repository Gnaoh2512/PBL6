package com.example.pbl6.service.assistant;

import org.springframework.stereotype.Component;
import java.time.Clock;
import java.util.*;

/** Bounded, ephemeral chat state. No booking data or raw JWT is stored here. */
@Component
public class AssistantSessions {
    private final Map<String, Session> sessions = new HashMap<>();
    private final Clock clock;
    public AssistantSessions() { this(Clock.systemUTC()); }
    AssistantSessions(Clock clock) { this.clock = clock; }
    public static final class Session {
        public final String cookie = UUID.randomUUID().toString();
        public final String conversation = UUID.randomUUID().toString();
        public final String owner;
        public long lastUsed;
        public boolean active = true, busy;
        public final List<Map<String, String>> history = new ArrayList<>();
        public final Map<String, Cached> requests = new HashMap<>();
        Session(String owner, long now) { this.owner = owner; this.lastUsed = now; }
    }
    public record Cached(String hash, Map<String, Object> response, AssistantFault error) {}
    private void expire() {
        sessions.values().removeIf(s -> {
            if (clock.millis() - s.lastUsed >= 1800000) { s.active = false; return true; }
            return false;
        });
    }
    public synchronized Session resolve(String cookie, String owner, String conversation) {
        expire();
        Session session = sessions.get(cookie);
        if (session != null && !session.owner.equals(owner)) { invalidate(cookie); session = null; }
        if (conversation != null && (session == null || !session.conversation.equals(conversation)))
            throw new AssistantFault(404, "CONVERSATION_NOT_FOUND");
        if (session == null) {
            if (sessions.size() >= 1000) throw new AssistantFault(503, "CAPACITY_UNAVAILABLE");
            session = new Session(owner, clock.millis()); sessions.put(session.cookie, session);
        }
        session.lastUsed = clock.millis();
        return session;
    }
    public synchronized void invalidate(String cookie) {
        Session session = sessions.remove(cookie);
        if (session != null) session.active = false;
    }
    public synchronized Cached begin(Session session, String id, String hash) {
        expire();
        if (!session.active) throw new AssistantFault(404, "CONVERSATION_NOT_FOUND");
        Cached cached = session.requests.get(id);
        if (cached != null) {
            if (!cached.hash.equals(hash)) throw new AssistantFault(409, "MESSAGE_ID_CONFLICT");
            if (cached.error != null) throw cached.error;
            if (cached.response == null) throw new AssistantFault(409, "TURN_IN_PROGRESS");
            return cached;
        }
        if (session.busy) throw new AssistantFault(409, "CONVERSATION_BUSY");
        if (session.requests.size() >= 128) throw new AssistantFault(503, "CAPACITY_UNAVAILABLE");
        session.requests.put(id, new Cached(hash, null, null)); session.busy = true;
        return null;
    }
    public synchronized List<Map<String, String>> history(Session session) { return List.copyOf(session.history); }
    public synchronized void finish(Session session, String id, String hash, String message, Map<String, Object> result) {
        expire();
        if (!session.active) throw new AssistantFault(404, "CONVERSATION_NOT_FOUND");
        session.requests.put(id, new Cached(hash, result, null)); session.busy = false;
        session.history.add(Map.of("role", "user", "content", message));
        String answer = (String) result.get("answer");
        if (answer.length() <= 2000) session.history.add(Map.of("role", "assistant", "content", answer));
        while (session.history.size() > 8) session.history.removeFirst();
    }
    public synchronized void fail(Session session, String id, AssistantFault error) {
        session.busy = false;
        Cached previous = session.requests.get(id);
        if (previous != null) session.requests.put(id, new Cached(previous.hash, null, error));
        // Failed turns are not automatically retried, including by an identical message ID.
        // Client presents the error and creates a new message ID for an explicit new attempt.
    }
}
