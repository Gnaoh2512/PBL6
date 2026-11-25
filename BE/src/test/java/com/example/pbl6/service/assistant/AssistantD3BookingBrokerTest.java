package com.example.pbl6.service.assistant;

import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.service.CustomerBillingService;
import com.example.pbl6.service.CustomerHistoryService;
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
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AssistantD3BookingBrokerTest {
    private static final Clock FIXED_CLOCK = Clock.fixed(
            Instant.parse("2026-11-25T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")
    );
    private static final Set<String> ALL_D3_TOOLS = Set.of(
            "search_knowledge", "search_rooms", "list_services", "list_my_bookings", "get_my_booking"
    );

    private RoomCatalogService roomCatalogService;
    private CustomerBillingService customerBillingService;
    private CustomerHistoryService customerHistoryService;
    private AssistantToolBroker broker;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String callId = UUID.randomUUID().toString();

    private HttpServer server;
    private AssistantOrchestrator orchestrator;
    private final AtomicReference<String> scenario = new AtomicReference<>("list_ok");
    private final List<JsonNode> receivedRequests = new CopyOnWriteArrayList<>();

    @BeforeEach
    void setup() throws Exception {
        roomCatalogService = mock(RoomCatalogService.class);
        customerBillingService = mock(CustomerBillingService.class);
        customerHistoryService = mock(CustomerHistoryService.class);
        broker = new AssistantToolBroker(roomCatalogService, customerBillingService, customerHistoryService, FIXED_CLOCK);

        String contId = UUID.randomUUID().toString();
        String toolCallId = UUID.randomUUID().toString();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/assistant/turn", exchange -> {
            JsonNode req = mapper.readTree(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            receivedRequests.add(req);
            String phase = req.path("phase").asText();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("requestId", req.path("requestId").asText());
            body.put("conversationId", req.path("conversationId").asText());
            body.put("turnId", req.path("turnId").asText());

            if ("start".equals(phase)) {
                if ("requires_login".equals(scenario.get())) {
                    body.put("kind", "final");
                    body.put("continuationId", null);
                    body.put("toolCalls", List.of());
                    body.put("evidence", List.of());
                    Map<String, Object> loginAction = new LinkedHashMap<>();
                    loginAction.put("type", "open_login");
                    loginAction.put("label", "Đăng nhập để xem đơn đặt phòng");
                    loginAction.put("targetId", null);
                    body.put("final", Map.of(
                            "status", "requires_login",
                            "answer", "Vui lòng đăng nhập tài khoản khách hàng để xem đơn đặt phòng của bạn.",
                            "missingFields", List.of(),
                            "citations", List.of(),
                            "cards", List.of(),
                            "actions", List.of(loginAction),
                            "corpusMode", "demo_synthetic"
                    ));
                    body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 15, "outputTokensUsed", 10));
                } else {
                    body.put("kind", "tool_calls");
                    body.put("continuationId", contId);
                    body.put("toolCalls", List.of(Map.of(
                            "callId", toolCallId,
                            "name", "list_my_bookings",
                            "arguments", Map.of("limit", 5)
                    )));
                    body.put("evidence", List.of());
                    body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 20, "outputTokensUsed", 10));
                }
            } else {
                body.put("kind", "final");
                body.put("continuationId", null);
                body.put("toolCalls", List.of());
                body.put("evidence", List.of());
                body.put("final", Map.of(
                        "status", "answered",
                        "answer", "Bạn hiện có 1 đơn đặt phòng.",
                        "missingFields", List.of(),
                        "citations", List.of(),
                        "cards", List.of(),
                        "actions", List.of(),
                        "corpusMode", "demo_synthetic"
                ));
                body.put("usage", Map.of("toolCallsUsed", 0, "brokerBatchesUsed", 0, "inputTokensUsed", 0, "outputTokensUsed", 0));
            }

            byte[] out = mapper.writeValueAsBytes(body);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();

        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("local");
        var config = new AssistantConfig(
                true, true, true, "demo_synthetic", "service-test",
                "http://127.0.0.1:" + server.getAddress().getPort(),
                "http://localhost:3000", env
        );
        orchestrator = new AssistantOrchestrator(config, new AssistantClient(config), broker);
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    @SuppressWarnings("unchecked")
    void listMyBookingsSortsDeterministicallyStripsPiiAndUsesSpringPrincipalOnly() throws Exception {
        LocalDateTime t1 = LocalDateTime.of(2026, 11, 20, 10, 0);
        LocalDateTime t2 = LocalDateTime.of(2026, 11, 22, 10, 0);
        when(customerHistoryService.getMemberHistory("customer1", "CONFIRMED")).thenReturn(List.of(
                CustomerBookingHistorySummaryResponse.builder()
                        .bookingCode("BK-20261120-AAAA").bookingStatus("CONFIRMED")
                        .roomNumber("201").roomTypeName("Deluxe")
                        .checkInDate(LocalDate.of(2026, 12, 1)).checkOutDate(LocalDate.of(2026, 12, 3))
                        .nights(2).guestCount(2).createdAt(t1).build(),
                CustomerBookingHistorySummaryResponse.builder()
                        .bookingCode("BK-20261122-BBBB").bookingStatus("CONFIRMED")
                        .roomNumber("301").roomTypeName("Suite")
                        .checkInDate(LocalDate.of(2026, 12, 5)).checkOutDate(LocalDate.of(2026, 12, 7))
                        .nights(2).guestCount(4).createdAt(t2).build()
        ));

        var args = mapper.readTree("{\"status\":\"CONFIRMED\",\"limit\":1}");
        var exec = broker.execute(callId, "list_my_bookings", args, ALL_D3_TOOLS, "customer1", true);

        assertTrue(exec.isOk());
        assertTrue(exec.hasMore());
        var items = (List<Map<String, Object>>) ((Map<String, Object>) exec.toolResult().get("data")).get("items");
        assertEquals(1, items.size());
        Map<String, Object> first = items.get(0);
        assertEquals("BK-20261122-BBBB", first.get("bookingCode"));
        assertEquals("CONFIRMED", first.get("bookingStatus"));
        assertEquals("Suite", first.get("roomTypeName"));
        assertFalse(first.containsKey("roomNumber"));
        assertFalse(first.containsKey("createdAt"));
        assertFalse(first.containsKey("totalAmount"));
        assertEquals("booking", exec.cards().get(0).get("type"));
    }

    @Test
    void listMyBookingsRejectsSpoofedIdentityArgsGuestAndStaff() throws Exception {
        var spoofed = mapper.readTree("{\"username\":\"victim\"}");
        var resSpoof = broker.execute(callId, "list_my_bookings", spoofed, ALL_D3_TOOLS, "customer1", true);
        assertEquals("VALIDATION_ERROR", resSpoof.errorCode());

        var empty = mapper.readTree("{}");
        var resGuest = broker.execute(callId, "list_my_bookings", empty, ALL_D3_TOOLS, null, false);
        assertEquals("AUTH_REQUIRED", resGuest.errorCode());

        var resStaff = broker.execute(callId, "list_my_bookings", empty, ALL_D3_TOOLS, "receptionist", false);
        assertEquals("FORBIDDEN", resStaff.errorCode());

        verifyNoInteractions(customerHistoryService);
    }

    @Test
    @SuppressWarnings("unchecked")
    void getMyBookingStripsPiiAndOnlyIncludesFinancialsWhenRequested() throws Exception {
        var detail = CustomerBookingHistoryDetailResponse.builder()
                .bookingId(100)
                .bookingCode("BK-CUSTOMER1-DEMO")
                .bookingStatus("CHECKED_IN")
                .customerName("Nguyễn Văn Khách")
                .customerPhone("0901234567")
                .customerEmail("customer1@gmail.com")
                .roomNumber("101")
                .floor(1)
                .roomTypeName("Phòng Standard")
                .checkInDate(LocalDate.of(2026, 11, 24))
                .checkOutDate(LocalDate.of(2026, 11, 27))
                .nights(3)
                .guestCount(2)
                .note("Secret note")
                .depositRequired(new BigDecimal("450000.00"))
                .depositPaid(new BigDecimal("450000.00"))
                .totalAmount(new BigDecimal("1650000.00"))
                .remainingBalance(new BigDecimal("1200000.00"))
                .build();
        when(customerHistoryService.getMemberBookingDetail("customer1", "BK-CUSTOMER1-DEMO")).thenReturn(detail);

        var basicExec = broker.execute(
                callId, "get_my_booking",
                mapper.readTree("{\"bookingCode\":\"BK-CUSTOMER1-DEMO\"}"),
                ALL_D3_TOOLS, "customer1", true
        );
        assertTrue(basicExec.isOk());
        var basic = (Map<String, Object>) basicExec.toolResult().get("data");
        assertEquals("BK-CUSTOMER1-DEMO", basic.get("bookingCode"));
        assertFalse(basic.containsKey("depositRequired"));
        assertFalse(basic.containsKey("customerName"));
        assertFalse(basic.containsKey("customerPhone"));
        assertFalse(basic.containsKey("customerEmail"));
        assertFalse(basic.containsKey("roomNumber"));
        assertFalse(basic.containsKey("note"));
        assertFalse(basic.containsKey("qrCode"));

        var finExec = broker.execute(
                callId, "get_my_booking",
                mapper.readTree("{\"bookingCode\":\"BK-CUSTOMER1-DEMO\",\"includeFinancials\":true}"),
                ALL_D3_TOOLS, "customer1", true
        );
        assertTrue(finExec.isOk());
        var fin = (Map<String, Object>) finExec.toolResult().get("data");
        assertEquals("450000", fin.get("depositRequired"));
        assertEquals("450000", fin.get("depositPaid"));
        assertEquals("1650000", fin.get("totalAmount"));
        assertEquals("1200000", fin.get("remainingBalance"));
        assertEquals("VND", fin.get("currency"));
        assertFalse(fin.containsKey("customerPhone"));
        assertFalse(fin.containsKey("roomNumber"));
    }

    @Test
    void getMyBookingReturnsUnifiedNotFoundForForeignOrMissingBooking() throws Exception {
        when(customerHistoryService.getMemberBookingDetail("customer2", "BK-CUSTOMER1-DEMO"))
                .thenThrow(new ResourceNotFoundException("Not found"));

        var exec = broker.execute(
                callId, "get_my_booking",
                mapper.readTree("{\"bookingCode\":\"BK-CUSTOMER1-DEMO\"}"),
                ALL_D3_TOOLS, "customer2", true
        );
        assertFalse(exec.isOk());
        assertEquals("NOT_FOUND", exec.errorCode());
        assertTrue(exec.cards().isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void orchestratorGrantsBookingToolsOnlyToAuthenticatedCustomerAndSupportsRequiresLogin() {
        // 1) Guest -> no booking tools in allowedTools, receives requires_login + open_login
        scenario.set("requires_login");
        var guestRes = orchestrator.executeTurn(
                "req-guest", UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                "Xem booking của tôi", List.of(), null, false, System.nanoTime()
        );
        assertEquals("requires_login", guestRes.get("status"));
        assertEquals(List.of(), guestRes.get("cards"));
        var actions = (List<Map<String, Object>>) guestRes.get("actions");
        assertEquals("open_login", actions.get(0).get("type"));
        JsonNode guestStart = receivedRequests.get(0);
        List<String> guestTools = new ArrayList<>();
        guestStart.path("allowedTools").forEach(n -> guestTools.add(n.asText()));
        assertFalse(guestTools.contains("list_my_bookings"));
        assertFalse(guestTools.contains("get_my_booking"));

        // 2) Authenticated CUSTOMER -> receives booking tools and ledger booking card
        scenario.set("list_ok");
        when(customerHistoryService.getMemberHistory("customer1", null)).thenReturn(List.of(
                CustomerBookingHistorySummaryResponse.builder()
                        .bookingCode("BK-CUSTOMER1-DEMO").bookingStatus("CHECKED_IN")
                        .roomTypeName("Phòng Standard")
                        .checkInDate(LocalDate.of(2026, 11, 24)).checkOutDate(LocalDate.of(2026, 11, 27))
                        .nights(3).guestCount(2).createdAt(LocalDateTime.now()).build()
        ));
        var custRes = orchestrator.executeTurn(
                "req-cust", UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                "Xem booking của tôi", List.of(), "customer1", true, System.nanoTime()
        );
        assertEquals("answered", custRes.get("status"));
        var cards = (List<Map<String, Object>>) custRes.get("cards");
        assertEquals(1, cards.size());
        assertEquals("booking", cards.get(0).get("type"));
        assertEquals("BK-CUSTOMER1-DEMO", ((Map<?, ?>) cards.get(0).get("data")).get("bookingCode"));
        JsonNode custStart = receivedRequests.get(1);
        List<String> custTools = new ArrayList<>();
        custStart.path("allowedTools").forEach(n -> custTools.add(n.asText()));
        assertTrue(custTools.contains("list_my_bookings"));
        assertTrue(custTools.contains("get_my_booking"));
    }
}
