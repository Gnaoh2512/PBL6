package com.example.pbl6.service.assistant;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.mock.env.MockEnvironment;
import java.net.InetSocketAddress;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class AssistantClientTest {
    HttpServer server;
    AssistantClient client;
    ObjectMapper mapper = new ObjectMapper();
    AtomicReference<String> mode = new AtomicReference<>("valid");
    Map<String,Object> payload = Map.of("requestId", "req", "conversationId", UUID.randomUUID().toString(), "turnId", UUID.randomUUID().toString());
    @BeforeEach void setup() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/assistant/turn", exchange -> {
            assertEquals("Bearer service-test", exchange.getRequestHeaders().getFirst("Authorization"));
            String incoming = new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            assertFalse(incoming.contains("customer-jwt"));
            var evidence = Map.of("citationId", "c1", "documentId", "d", "version", "1", "chunkId", "chunk", "sectionId", "faq", "title", "demo", "sourceRef", "synthetic:demo", "excerpt", "demo evidence", "corpusMode", "demo_synthetic");
            var citation = new HashMap<>(evidence); citation.remove("excerpt"); citation.remove("corpusMode");
            Map<String,Object> data = new HashMap<>(Map.of("status", "answered", "answer", "demo", "missingFields", List.of(), "citations", List.of(citation), "cards", List.of(), "actions", List.of(), "corpusMode", "demo_synthetic"));
            Map<String,Object> root = new HashMap<>(payload);
            root.put("kind", "final"); root.put("continuationId", null); root.put("toolCalls", List.of());
            root.put("final", data); root.put("evidence", List.of(evidence));
            root.put("usage", Map.of("toolCallsUsed", 1, "brokerBatchesUsed", 0, "inputTokensUsed", 10, "outputTokensUsed", 10));
            if (mode.get().equals("citation")) citation.put("citationId", "invented");
            if (mode.get().equals("identity")) root.put("username", "victim");
            if (mode.get().equals("mode")) data.put("corpusMode", "production");
            if (mode.get().equals("tool")) root.put("toolCalls", List.of(Map.of("name", "execute_sql")));
            if (mode.get().equals("id")) root.put("requestId", "other");
            byte[] body = mode.get().equals("large") ? new byte[262145] : mapper.writeValueAsBytes(root);
            int code = mode.get().equals("auth") ? 401 : mode.get().equals("dependency") ? 503 : 200;
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(code, body.length); exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        MockEnvironment env = new MockEnvironment(); env.setActiveProfiles("local");
        client = new AssistantClient(new AssistantConfig(true, "demo_synthetic", "service-test", "http://127.0.0.1:"+server.getAddress().getPort(), "http://localhost:3000", env));
    }
    @AfterEach void stop() { server.stop(0); }
    @Test void validatesRegistryAndRejectsUntrustedUpstream() {
        assertEquals("answered", client.turn(payload, "req").get("status"));
        for (String fault : List.of("citation", "identity", "mode", "tool", "id", "large")) {
            mode.set(fault);
            assertEquals(502, assertThrows(AssistantFault.class, () -> client.turn(payload, "req"), fault).status);
        }
    }
    @Test void serviceAuthIsNotCustomerAuthAndDependencyIsNotSuccess() {
        mode.set("auth"); assertEquals("AI_AUTH_FAILED", assertThrows(AssistantFault.class, () -> client.turn(payload, "req")).code);
        mode.set("dependency"); assertEquals(503, assertThrows(AssistantFault.class, () -> client.turn(payload, "req")).status);
    }
}
