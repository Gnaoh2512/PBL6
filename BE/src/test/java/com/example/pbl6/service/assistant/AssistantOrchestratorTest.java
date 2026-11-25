package com.example.pbl6.service.assistant;

import com.example.pbl6.dto.room.AvailableRoomResponse;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.dto.service.ServiceResponse;
import com.example.pbl6.service.CustomerBillingService;
import com.example.pbl6.service.RoomCatalogService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AssistantOrchestratorTest {
    private static final Clock FIXED_CLOCK = Clock.fixed(
            Instant.parse("2026-11-25T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")
    );

    private HttpServer server;
    private AssistantOrchestrator orchestrator;
    private RoomCatalogService roomCatalogService;
    private CustomerBillingService customerBillingService;
    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicReference<String> scenario = new AtomicReference<>("search_rooms");
    private final List<JsonNode> receivedRequests = new CopyOnWriteArrayList<>();

    @BeforeEach
    void setup() throws Exception {
        roomCatalogService = mock(RoomCatalogService.class);
        customerBillingService = mock(CustomerBillingService.class);

        when(roomCatalogService.findAvailableRooms(any())).thenReturn(List.of(
                AvailableRoomResponse.builder()
                        .roomId(101)
                        .roomNumber("P101")
                        .floor(1)
                        .status("AVAILABLE")
                        .note("Secret internal note")
                        .roomType(RoomTypeResponse.builder()
                                .roomTypeId(1)
                                .typeName("Deluxe Sea View")
                                .capacity(2)
                                .basePrice(new BigDecimal("1500000"))
                                .amenities("Wi-Fi, Ban công")
                                .description("Hướng biển")
                                .build())
                        .checkInDate(LocalDate.of(2026, 12, 1))
                        .checkOutDate(LocalDate.of(2026, 12, 3))
                        .nights(2)
                        .pricePerNight(new BigDecimal("1500000"))
                        .totalRoomCharge(new BigDecimal("3000000"))
                        .depositPercentage(30)
                        .estimatedDeposit(new BigDecimal("900000"))
                        .build()
        ));

        when(customerBillingService.getActiveServices(null)).thenReturn(List.of(
                ServiceResponse.builder()
                        .serviceId(5)
                        .categoryName("Spa")
                        .serviceName("Massage")
                        .unitPrice(new BigDecimal("450000"))
                        .unit("Lần")
                        .isActive(true)
                        .build()
        ));

        String contId = UUID.randomUUID().toString();
        String callId = UUID.randomUUID().toString();

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/assistant/turn", exchange -> {
            byte[] reqBytes = exchange.getRequestBody().readAllBytes();
            JsonNode req = mapper.readTree(new String(reqBytes, StandardCharsets.UTF_8));
            receivedRequests.add(req);

            String phase = req.path("phase").asText();
            String mode = scenario.get();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("requestId", req.path("requestId").asText());
            body.put("conversationId", req.path("conversationId").asText());
            body.put("turnId", req.path("turnId").asText());
            int statusCode = 200;

            if ("start".equals(phase)) {
                switch (mode) {
                    case "search_rooms", "forged_cards", "bad_action" -> {
                        body.put("kind", "tool_calls");
                        body.put("continuationId", contId);
                        body.put("toolCalls", List.of(Map.of(
                                "callId", callId,
                                "name", "search_rooms",
                                "arguments", Map.of(
                                        "checkInDate", "2026-12-01",
                                        "checkOutDate", "2026-12-03",
                                        "guestCount", 2
                                )
                        )));
                        body.put("evidence", List.of());
                        body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 25, "outputTokensUsed", 15));
                    }
                    case "list_services", "data_unavailable" -> {
                        body.put("kind", "tool_calls");
                        body.put("continuationId", contId);
                        body.put("toolCalls", List.of(Map.of(
                                "callId", callId,
                                "name", "list_services",
                                "arguments", Map.of("limit", 5)
                        )));
                        body.put("evidence", List.of());
                        body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 20, "outputTokensUsed", 10));
                    }
                    case "disallowed_tool" -> {
                        body.put("kind", "tool_calls");
                        body.put("continuationId", contId);
                        body.put("toolCalls", List.of(Map.of(
                                "callId", callId,
                                "name", "list_my_bookings",
                                "arguments", Map.of()
                        )));
                        body.put("evidence", List.of());
                        body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 10, "outputTokensUsed", 10));
                    }
                    case "clarify" -> {
                        body.put("kind", "final");
                        body.put("continuationId", null);
                        body.put("toolCalls", List.of());
                        body.put("evidence", List.of());
                        body.put("final", Map.of(
                                "status", "needs_clarification",
                                "answer", "Bạn vui lòng cung cấp ngày nhận/trả phòng và số khách.",
                                "missingFields", List.of("checkInDate", "checkOutDate", "guestCount"),
                                "citations", List.of(),
                                "cards", List.of(),
                                "actions", List.of(action("open_room_search", "Mở trang tìm phòng")),
                                "corpusMode", "demo_synthetic"
                        ));
                        body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 20, "outputTokensUsed", 15));
                    }
                    case "two_batch_error_final" -> {
                        body.put("kind", "tool_calls");
                        body.put("continuationId", contId);
                        body.put("toolCalls", List.of(Map.of(
                                "callId", callId,
                                "name", "search_rooms",
                                "arguments", Map.of(
                                        "checkInDate", "2020-01-01",
                                        "checkOutDate", "2020-01-02",
                                        "guestCount", 2
                                )
                        )));
                        body.put("evidence", List.of());
                        body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 10, "outputTokensUsed", 10));
                    }
                    case "ungrounded_answer" -> {
                        body.put("kind", "final");
                        body.put("continuationId", null);
                        body.put("toolCalls", List.of());
                        body.put("evidence", List.of());
                        body.put("final", Map.of(
                                "status", "answered",
                                "answer", "Giá phòng là 100k.",
                                "missingFields", List.of(),
                                "citations", List.of(),
                                "cards", List.of(),
                                "actions", List.of(),
                                "corpusMode", "demo_synthetic"
                        ));
                        body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 10, "outputTokensUsed", 10));
                    }
                }
            } else {
                // phase == resume
                if ("data_unavailable".equals(mode)) {
                    statusCode = 503;
                    body = Map.of(
                            "requestId", req.path("requestId").asText(),
                            "error", Map.of("code", "DATA_UNAVAILABLE", "message", "Missing price", "retryable", true)
                    );
                } else if ("two_batch_error_final".equals(mode) && req.path("budget").path("remainingBrokerBatches").asInt() > 0) {
                    body.put("kind", "tool_calls");
                    body.put("continuationId", UUID.randomUUID().toString());
                    body.put("toolCalls", List.of(Map.of(
                            "callId", UUID.randomUUID().toString(),
                            "name", "search_rooms",
                            "arguments", Map.of(
                                    "checkInDate", "2020-01-03",
                                    "checkOutDate", "2020-01-04",
                                    "guestCount", 2
                            )
                    )));
                    body.put("evidence", List.of());
                    body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 5, "outputTokensUsed", 5));
                } else if ("two_batch_error_final".equals(mode)) {
                    body.put("kind", "final");
                    body.put("continuationId", null);
                    body.put("toolCalls", List.of());
                    body.put("evidence", List.of());
                    body.put("final", Map.of(
                            "status", "needs_clarification",
                            "answer", "Ngày nhận phòng phải từ ngày hôm nay trở đi.",
                            "missingFields", List.of("checkInDate"),
                            "citations", List.of(),
                            "cards", List.of(),
                            "actions", List.of(action("open_room_search", "Mở trang tìm phòng")),
                            "corpusMode", "demo_synthetic"
                    ));
                    body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 0, "outputTokensUsed", 0));
                } else {
                    List<Map<String, Object>> cards = "forged_cards".equals(mode)
                            ? List.of(Map.of("type", "room", "data", Map.of("pricePerNight", "1"), "retrievedAt", "2026-11-25T10:00:00+07:00"))
                            : List.of();
                    List<Map<String, Object>> actions = switch (mode) {
                        case "list_services" -> List.of(action("open_services", "Xem dịch vụ"));
                        case "bad_action" -> List.of(action("execute_booking", "Đặt ngay"));
                        default -> List.of(action("open_room_search", "Mở trang tìm phòng"));
                    };
                    body.put("kind", "final");
                    body.put("continuationId", null);
                    body.put("toolCalls", List.of());
                    body.put("evidence", List.of());
                    body.put("final", Map.of(
                            "status", "answered",
                            "answer", "Tìm thấy kết quả phù hợp từ hệ thống.",
                            "missingFields", List.of(),
                            "citations", List.of(),
                            "cards", cards,
                            "actions", actions,
                            "corpusMode", "demo_synthetic"
                    ));
                    body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 0, "outputTokensUsed", 0));
                }
            }

            byte[] out = mapper.writeValueAsBytes(body);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(statusCode, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();

        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("local");
        var config = new AssistantConfig(
                true, true, "demo_synthetic", "service-test",
                "http://127.0.0.1:" + server.getAddress().getPort(),
                "http://localhost:3000", env
        );
        var client = new AssistantClient(config);
        var broker = new AssistantToolBroker(roomCatalogService, customerBillingService, FIXED_CLOCK);
        orchestrator = new AssistantOrchestrator(config, client, broker);
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private static Map<String, Object> action(String type, String label) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("type", type);
        map.put("label", label);
        map.put("targetId", null);
        return map;
    }

    @Test
    @SuppressWarnings("unchecked")
    void executesSearchRoomsRoundTripDecrementsBudgetAndAssemblesLedgerCards() {
        var result = orchestrator.executeTurn(
                "req-1", UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                "Tìm phòng 2 người 1/12-3/12", List.of(), false, System.nanoTime()
        );

        assertEquals("answered", result.get("status"));
        assertEquals(List.of(), result.get("citations"));
        var cards = (List<Map<String, Object>>) result.get("cards");
        assertEquals(1, cards.size());
        assertEquals("room", cards.get(0).get("type"));
        var cardData = (Map<String, Object>) cards.get(0).get("data");
        assertEquals(101, cardData.get("roomId"));
        assertEquals("1500000", cardData.get("pricePerNight"));
        assertFalse(cardData.containsKey("roomNumber"));
        assertFalse(cardData.containsKey("note"));

        var actions = (List<Map<String, Object>>) result.get("actions");
        assertEquals(1, actions.size());
        assertEquals("open_room_search", actions.get(0).get("type"));

        assertEquals(2, receivedRequests.size());
        JsonNode start = receivedRequests.get(0);
        assertEquals("start", start.path("phase").asText());
        assertEquals(4, start.path("budget").path("remainingToolCalls").asInt());
        assertEquals(2, start.path("budget").path("remainingBrokerBatches").asInt());

        JsonNode resume = receivedRequests.get(1);
        assertEquals("resume", resume.path("phase").asText());
        assertEquals(3, resume.path("budget").path("remainingToolCalls").asInt());
        assertEquals(1, resume.path("budget").path("remainingBrokerBatches").asInt());
        assertEquals(7975, resume.path("budget").path("remainingInputTokens").asInt());
        assertEquals(1985, resume.path("budget").path("remainingOutputTokens").asInt());
    }

    @Test
    @SuppressWarnings("unchecked")
    void filtersOpenServicesActionForAnonymousGuestButAllowsForCustomer() {
        scenario.set("list_services");

        var guestResult = orchestrator.executeTurn(
                "req-guest", UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                "Có dịch vụ gì?", List.of(), false, System.nanoTime()
        );
        assertEquals(1, ((List<?>) guestResult.get("cards")).size());
        assertTrue(((List<?>) guestResult.get("actions")).isEmpty());

        var customerResult = orchestrator.executeTurn(
                "req-cust", UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                "Có dịch vụ gì?", List.of(), true, System.nanoTime()
        );
        var actions = (List<Map<String, Object>>) customerResult.get("actions");
        assertEquals(1, actions.size());
        assertEquals("open_services", actions.get(0).get("type"));
    }

    @Test
    void returnsNeedsClarificationWithMissingFieldsWithoutExecutingBroker() {
        scenario.set("clarify");
        var result = orchestrator.executeTurn(
                "req-clarify", UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                "Giá phòng bao nhiêu?", List.of(), false, System.nanoTime()
        );
        assertEquals("needs_clarification", result.get("status"));
        assertEquals(List.of("checkInDate", "checkOutDate", "guestCount"), result.get("missingFields"));
        assertEquals(List.of(), result.get("cards"));
        verifyNoInteractions(roomCatalogService, customerBillingService);
    }

    @Test
    void rejectsForgedCardsBadActionDisallowedToolAndUngroundedAnswer() {
        for (String faultScenario : List.of("forged_cards", "bad_action", "disallowed_tool", "ungrounded_answer")) {
            scenario.set(faultScenario);
            AssistantFault fault = assertThrows(AssistantFault.class, () -> orchestrator.executeTurn(
                    "req-" + faultScenario, UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                    "test", List.of(), false, System.nanoTime()
            ), faultScenario);
            assertEquals(502, fault.status, faultScenario);
            assertEquals("AI_PROTOCOL_ERROR", fault.code, faultScenario);
        }
    }

    @Test
    void propagatesDataUnavailableAs503() {
        scenario.set("data_unavailable");
        when(customerBillingService.getActiveServices(null)).thenReturn(List.of(
                ServiceResponse.builder().serviceId(5).categoryName("Spa").serviceName("Massage")
                        .unitPrice(null).unit("Lần").isActive(true).build()
        ));
        AssistantFault fault = assertThrows(AssistantFault.class, () -> orchestrator.executeTurn(
                "req-data", UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                "Dịch vụ?", List.of(), false, System.nanoTime()
        ));
        assertEquals(503, fault.status);
        assertEquals("DATA_UNAVAILABLE", fault.code);
    }

    @Test
    @SuppressWarnings("unchecked")
    void acceptsD2StatusAndActionsOnFinalResumeAfterSecondFailedBatch() {
        scenario.set("two_batch_error_final");
        var result = orchestrator.executeTurn(
                "req-2batch", UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                "Tìm phòng ngày 1/1/2020", List.of(), false, System.nanoTime()
        );
        assertEquals("needs_clarification", result.get("status"));
        assertEquals(List.of("checkInDate"), result.get("missingFields"));
        assertEquals(List.of(), result.get("cards"));
        var actions = (List<Map<String, Object>>) result.get("actions");
        assertEquals(1, actions.size());
        assertEquals("open_room_search", actions.get(0).get("type"));
        assertEquals(3, receivedRequests.size());
        assertEquals(0, receivedRequests.get(2).path("budget").path("remainingBrokerBatches").asInt());
    }
}
