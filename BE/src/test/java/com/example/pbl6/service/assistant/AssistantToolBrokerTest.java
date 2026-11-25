package com.example.pbl6.service.assistant;

import com.example.pbl6.dto.room.AvailableRoomResponse;
import com.example.pbl6.dto.room.RoomSearchRequest;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.dto.service.ServiceResponse;
import com.example.pbl6.service.CustomerBillingService;
import com.example.pbl6.service.RoomCatalogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AssistantToolBrokerTest {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-11-25T03:00:00Z"), ZONE);
    private static final Set<String> D2_TOOLS = Set.of("search_knowledge", "search_rooms", "list_services");

    private RoomCatalogService roomCatalogService;
    private CustomerBillingService customerBillingService;
    private AssistantToolBroker broker;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String callId = UUID.randomUUID().toString();

    @BeforeEach
    void setup() {
        roomCatalogService = mock(RoomCatalogService.class);
        customerBillingService = mock(CustomerBillingService.class);
        broker = new AssistantToolBroker(roomCatalogService, customerBillingService, FIXED_CLOCK);
    }

    private AvailableRoomResponse room(
            int roomId, int roomTypeId, String typeName, int capacity,
            BigDecimal basePrice, BigDecimal pricePerNight, BigDecimal total, BigDecimal deposit
    ) {
        return AvailableRoomResponse.builder()
                .roomId(roomId)
                .roomNumber("P" + roomId)
                .floor(3)
                .status("AVAILABLE")
                .note("Internal maintenance note")
                .roomType(RoomTypeResponse.builder()
                        .roomTypeId(roomTypeId)
                        .typeName(typeName)
                        .capacity(capacity)
                        .basePrice(basePrice)
                        .amenities("Wi-Fi, Ban công")
                        .description("Phòng hướng biển")
                        .build())
                .checkInDate(LocalDate.of(2026, 12, 1))
                .checkOutDate(LocalDate.of(2026, 12, 3))
                .nights(2)
                .pricePerNight(pricePerNight)
                .totalRoomCharge(total)
                .depositPercentage(30)
                .estimatedDeposit(deposit)
                .build();
    }

    @Test
    @SuppressWarnings("unchecked")
    void searchRoomsSortsDeterministicallyStripsInternalFieldsAndSetsHasMore() throws Exception {
        when(roomCatalogService.findAvailableRooms(any())).thenReturn(List.of(
                room(105, 2, "Deluxe", 2, new BigDecimal("1500000.00"), new BigDecimal("1500000.00"), new BigDecimal("3000000.00"), new BigDecimal("900000")),
                room(102, 1, "Standard", 2, new BigDecimal("1000000.00"), new BigDecimal("1000000.00"), new BigDecimal("2000000.00"), new BigDecimal("600000")),
                room(101, 1, "Standard", 2, new BigDecimal("1000000.00"), new BigDecimal("1000000.00"), new BigDecimal("2000000.00"), new BigDecimal("600000"))
        ));

        var args = mapper.readTree("""
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":2,"minPrice":"900000","maxPrice":"2000000","sortBy":"PRICE_ASC","limit":2}
                """);
        var exec = broker.execute(callId, "search_rooms", args, D2_TOOLS);

        assertTrue(exec.isOk());
        assertTrue(exec.hasMore());
        assertEquals("2026-11-25T10:00:00+07:00", exec.retrievedAt());

        var data = (Map<String, Object>) exec.toolResult().get("data");
        assertEquals(true, data.get("hasMore"));
        var items = (List<Map<String, Object>>) data.get("items");
        assertEquals(2, items.size());
        assertEquals(101, items.get(0).get("roomId"));
        assertEquals(102, items.get(1).get("roomId"));

        Map<String, Object> first = items.get(0);
        assertEquals("1000000", first.get("pricePerNight"));
        assertEquals("2000000", first.get("totalRoomCharge"));
        assertEquals("600000", first.get("estimatedDeposit"));
        assertEquals("VND", first.get("currency"));
        assertEquals("room_charge_estimate", first.get("priceScope"));
        assertFalse(first.containsKey("roomNumber"));
        assertFalse(first.containsKey("floor"));
        assertFalse(first.containsKey("note"));
        assertFalse(first.containsKey("status"));

        assertEquals(2, exec.cards().size());
        assertEquals("room", exec.cards().get(0).get("type"));
        assertEquals(first, exec.cards().get(0).get("data"));
        assertEquals("2026-11-25T10:00:00+07:00", exec.cards().get(0).get("retrievedAt"));

        ArgumentCaptor<RoomSearchRequest> captor = ArgumentCaptor.forClass(RoomSearchRequest.class);
        verify(roomCatalogService).findAvailableRooms(captor.capture());
        assertEquals(LocalDate.of(2026, 12, 1), captor.getValue().getCheckInDate());
        assertEquals(LocalDate.of(2026, 12, 3), captor.getValue().getCheckOutDate());
        assertEquals(2, captor.getValue().getGuestCount());
        assertEquals(new BigDecimal("900000"), captor.getValue().getMinPrice());
        assertEquals(new BigDecimal("2000000"), captor.getValue().getMaxPrice());
    }

    @Test
    @SuppressWarnings("unchecked")
    void searchRoomsSupportsPriceDescWithRoomIdTieBreaker() throws Exception {
        when(roomCatalogService.findAvailableRooms(any())).thenReturn(List.of(
                room(202, 2, "Suite", 4, new BigDecimal("3000000"), new BigDecimal("3000000"), new BigDecimal("6000000"), new BigDecimal("1800000")),
                room(201, 2, "Suite", 4, new BigDecimal("3000000"), new BigDecimal("3000000"), new BigDecimal("6000000"), new BigDecimal("1800000")),
                room(100, 1, "Standard", 2, new BigDecimal("1000000"), new BigDecimal("1000000"), new BigDecimal("2000000"), new BigDecimal("600000"))
        ));

        var args = mapper.readTree("""
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":2,"sortBy":"PRICE_DESC"}
                """);
        var exec = broker.execute(callId, "search_rooms", args, D2_TOOLS);
        assertTrue(exec.isOk());
        var items = (List<Map<String, Object>>) ((Map<String, Object>) exec.toolResult().get("data")).get("items");
        assertEquals(List.of(201, 202, 100), items.stream().map(i -> i.get("roomId")).toList());
        assertFalse(exec.hasMore());
    }

    @Test
    void searchRoomsRejectsInvalidArgumentsWithoutCallingService() throws Exception {
        List<String> invalidInputs = List.of(
                """
                {"checkInDate":"2026-11-24","checkOutDate":"2026-11-26","guestCount":2}
                """, // before server today 2026-11-25
                """
                {"checkInDate":"2026-12-03","checkOutDate":"2026-12-03","guestCount":2}
                """, // checkOut <= checkIn
                """
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":0}
                """, // guestCount <= 0
                """
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":2,"unknown":1}
                """, // unknown key
                """
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":2,"minPrice":"2000000","maxPrice":"1000000"}
                """, // min > max
                """
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":2,"minPrice":1000000}
                """, // numeric instead of decimal string
                """
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":2,"sortBy":"CHEAPEST"}
                """, // invalid sortBy
                """
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":2,"limit":11}
                """ // limit > 10
        );
        for (String json : invalidInputs) {
            var exec = broker.execute(callId, "search_rooms", mapper.readTree(json), D2_TOOLS);
            assertFalse(exec.isOk(), json);
            assertEquals("VALIDATION_ERROR", exec.errorCode(), json);
            assertNull(exec.toolResult().get("data"));
            assertTrue(exec.cards().isEmpty());
        }
        verifyNoInteractions(roomCatalogService);
    }

    @Test
    void searchRoomsReturnsDataUnavailableWhenSourceBasePriceIsNullEvenIfCoercedToZero() throws Exception {
        // Simulates RoomCatalogServiceImpl coercing null basePrice to BigDecimal.ZERO
        when(roomCatalogService.findAvailableRooms(any())).thenReturn(List.of(
                room(101, 1, "Standard", 2, null, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO)
        ));
        var args = mapper.readTree("""
                {"checkInDate":"2026-12-01","checkOutDate":"2026-12-03","guestCount":2}
                """);
        var exec = broker.execute(callId, "search_rooms", args, D2_TOOLS);
        assertFalse(exec.isOk());
        assertEquals("DATA_UNAVAILABLE", exec.errorCode());
        assertTrue(exec.cards().isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void listServicesFiltersActiveSortsByIdAndPaginates() throws Exception {
        when(customerBillingService.getActiveServices(2)).thenReturn(List.of(
                ServiceResponse.builder().serviceId(8).categoryName("Spa").serviceName("Massage").unitPrice(new BigDecimal("450000.00")).unit("Lần").isActive(true).build(),
                ServiceResponse.builder().serviceId(3).categoryName("Spa").serviceName("Xông hơi").unitPrice(new BigDecimal("200000.50")).unit("Giờ").isActive(true).build(),
                ServiceResponse.builder().serviceId(1).categoryName("Spa").serviceName("Ngừng phục vụ").unitPrice(new BigDecimal("100000")).unit("Lần").isActive(false).build()
        ));

        var args = mapper.readTree("""
                {"categoryId":2,"limit":1}
                """);
        var exec = broker.execute(callId, "list_services", args, D2_TOOLS);
        assertTrue(exec.isOk());
        assertTrue(exec.hasMore());

        var items = (List<Map<String, Object>>) ((Map<String, Object>) exec.toolResult().get("data")).get("items");
        assertEquals(1, items.size());
        assertEquals(3, items.get(0).get("serviceId"));
        assertEquals("200000.5", items.get(0).get("unitPrice"));
        assertEquals(true, items.get(0).get("isActive"));
        assertEquals("VND", items.get(0).get("currency"));
        assertEquals(1, exec.cards().size());
        assertEquals("service", exec.cards().get(0).get("type"));
    }

    @Test
    void listServicesReturnsDataUnavailableOnNullUnitPrice() throws Exception {
        when(customerBillingService.getActiveServices(null)).thenReturn(List.of(
                ServiceResponse.builder().serviceId(5).categoryName("F&B").serviceName("Bữa sáng").unitPrice(null).unit("Suất").isActive(true).build()
        ));
        var exec = broker.execute(callId, "list_services", mapper.readTree("{}"), D2_TOOLS);
        assertFalse(exec.isOk());
        assertEquals("DATA_UNAVAILABLE", exec.errorCode());
    }

    @Test
    void rejectsDisallowedOrUnknownToolWithProtocolError() throws Exception {
        var empty = mapper.readTree("{}");
        assertEquals(502, assertThrows(AssistantFault.class,
                () -> broker.execute(callId, "execute_sql", empty, D2_TOOLS)).status);
        assertEquals(502, assertThrows(AssistantFault.class,
                () -> broker.execute(callId, "list_my_bookings", empty, D2_TOOLS)).status);
        assertEquals(502, assertThrows(AssistantFault.class,
                () -> broker.execute(callId, "list_services", empty, Set.of("search_knowledge"))).status);
        verifyNoInteractions(roomCatalogService, customerBillingService);
    }

    @Test
    void sanitizesUnexpectedServiceFailureIntoDependencyUnavailable() throws Exception {
        when(customerBillingService.getActiveServices(null))
                .thenThrow(new RuntimeException("SQLSyntaxErrorException: table secret_tbl"));
        var exec = broker.execute(callId, "list_services", mapper.readTree("{}"), D2_TOOLS);
        assertFalse(exec.isOk());
        assertEquals("DEPENDENCY_UNAVAILABLE", exec.errorCode());
        var error = (Map<?, ?>) exec.toolResult().get("error");
        assertFalse(error.get("message").toString().contains("SQL"));
    }
}
