package com.example.pbl6.service;

import com.example.pbl6.common.ApiResponse;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecommendationAiClientTest {

    private HttpServer server;
    private ExecutorService executor;
    private final AtomicInteger calls = new AtomicInteger();
    private final AtomicReference<String> path = new AtomicReference<>();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> requestId = new AtomicReference<>();
    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private volatile int upstreamStatus = 200;
    private volatile String upstreamBody = "";
    private volatile long delayMs;
    private volatile boolean dropConnection;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newSingleThreadExecutor();
        server.setExecutor(executor);
        server.createContext("/", exchange -> {
            calls.incrementAndGet();
            path.set(exchange.getRequestURI().getPath());
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            requestId.set(exchange.getRequestHeaders().getFirst("X-Request-ID"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            if (dropConnection) {
                exchange.close();
                return;
            }
            try {
                if (delayMs > 0) {
                    Thread.sleep(delayMs);
                }
                byte[] bytes = upstreamBody.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(upstreamStatus, bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            } catch (IOException ignored) {
                // A timed-out client may close its connection before the mock responds.
            } finally {
                exchange.close();
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
        executor.shutdownNow();
    }

    private RecommendationAiClient client(long timeoutMs) {
        return new RecommendationAiClient(
                "http://127.0.0.1:" + server.getAddress().getPort(), "service-only-token",
                timeoutMs);
    }

    @Test
    void structuredSuccessForwardsOnlyServiceCredentialsAndPreservesJson() {
        upstreamBody = "{\"status\":\"OK\",\"requestId\":\"req-1\",\"recommendations\":[{\"score\":0.75}]}";
        String body = "{\"checkInDate\":\"2026-11-10\",\"maxPrice\":1000000.25}";

        ResponseEntity<ApiResponse<Map<String, Object>>> response = client(1000).post(
                "/api/v1/ai/recommendations", body, "req-1");

        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        assertEquals("OK", response.getBody().getData().get("status"));
        Map<?, ?> firstRoom = (Map<?, ?>) ((java.util.List<?>) response.getBody()
                .getData().get("recommendations")).get(0);
        assertEquals(new BigDecimal("0.75"), firstRoom.get("score"));
        assertEquals("/api/v1/ai/recommendations", path.get());
        assertEquals("Bearer service-only-token", authorization.get());
        assertEquals("req-1", requestId.get());
        assertEquals(body, requestBody.get());
        assertEquals(1, calls.get());
    }

    @Test
    void conversationSuccessPreservesState() {
        upstreamBody = "{\"status\":\"NEEDS_CLARIFICATION\",\"requestId\":\"req-2\","
                + "\"state\":{\"pending\":[{\"kind\":\"budget\",\"amount\":1200000}]}}";
        ResponseEntity<ApiResponse<Map<String, Object>>> response = client(1000).post(
                "/api/v1/ai/recommendations/conversation", "{\"message\":\"Xin chào\",\"state\":{}}", "req-2");

        assertEquals(200, response.getStatusCode().value());
        assertEquals("/api/v1/ai/recommendations/conversation", path.get());
        Map<?, ?> state = (Map<?, ?>) response.getBody().getData().get("state");
        Map<?, ?> pending = (Map<?, ?>) ((java.util.List<?>) state.get("pending")).get(0);
        assertEquals(1200000, pending.get("amount"));
    }

    @Test
    void validationDetailsAndUpstreamErrorsAreMapped() {
        upstreamStatus = 422;
        upstreamBody = "{\"error\":{\"code\":\"VALIDATION_ERROR\","
                + "\"details\":[{\"field\":\"body.maxPrice\",\"type\":\"value_error\"}]}}";
        ResponseEntity<ApiResponse<Map<String, Object>>> validation = client(1000).post(
                "/api/v1/ai/recommendations", "{}", "req-3");
        assertEquals(422, validation.getStatusCode().value());
        assertFalse(validation.getBody().isSuccess());
        assertEquals("VALIDATION_ERROR", validation.getBody().getData().get("code"));
        Map<?, ?> detail = (Map<?, ?>) ((java.util.List<?>) validation.getBody()
                .getData().get("details")).get(0);
        assertEquals("body.maxPrice", detail.get("field"));

        upstreamStatus = 502;
        upstreamBody = "{\"error\":{\"code\":\"LLM_UNAVAILABLE\",\"details\":null}}";
        ResponseEntity<ApiResponse<Map<String, Object>>> failure = client(1000).post(
                "/api/v1/ai/recommendations/conversation", "{}", "req-4");
        assertEquals(502, failure.getStatusCode().value());
        assertEquals("LLM_UNAVAILABLE", failure.getBody().getData().get("code"));

        upstreamStatus = 401;
        upstreamBody = "{\"error\":{\"code\":\"SERVICE_UNAUTHORIZED\",\"details\":null}}";
        ResponseEntity<ApiResponse<Map<String, Object>>> rejectedToken = client(1000).post(
                "/api/v1/ai/recommendations", "{}", "req-5");
        assertEquals(502, rejectedToken.getStatusCode().value());
        assertNull(rejectedToken.getBody().getData());
        assertEquals(3, calls.get());
    }

    @Test
    void timeoutDoesNotBecomeNoMatch() {
        upstreamBody = "{\"status\":\"NO_MATCH\",\"requestId\":\"req-5\"}";
        delayMs = 400;
        ResponseEntity<ApiResponse<Map<String, Object>>> timeout = client(100).post(
                "/api/v1/ai/recommendations", "{}", "req-5");
        assertEquals(504, timeout.getStatusCode().value());
        assertFalse(timeout.getBody().isSuccess());
    }

    @Test
    void invalidUpstreamResponseDoesNotBecomeNoMatch() {
        upstreamBody = "not-json";
        ResponseEntity<ApiResponse<Map<String, Object>>> invalid = client(1000).post(
                "/api/v1/ai/recommendations", "{}", "req-6");
        assertEquals(502, invalid.getStatusCode().value());
        assertEquals(1, calls.get());
    }

    @Test
    void missingServiceTokenDoesNotCallUpstream() {
        RecommendationAiClient unconfigured = new RecommendationAiClient(
                "http://127.0.0.1:" + server.getAddress().getPort(), "", 1000);
        ResponseEntity<ApiResponse<Map<String, Object>>> response = unconfigured.post(
                "/api/v1/ai/recommendations", "{}", "req-7");
        assertEquals(503, response.getStatusCode().value());
        assertEquals(0, calls.get());
    }

    @Test
    void droppedConnectionDoesNotRetryPost() {
        dropConnection = true;
        ResponseEntity<ApiResponse<Map<String, Object>>> response = client(1000).post(
                "/api/v1/ai/recommendations", "{}", "req-8");
        assertEquals(502, response.getStatusCode().value());
        assertEquals(1, calls.get());
    }
}
