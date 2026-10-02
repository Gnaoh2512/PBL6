package com.example.pbl6.controller;

import com.example.pbl6.dto.room.AvailableRoomResponse;
import com.example.pbl6.dto.room.RoomSearchRequest;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.exception.GlobalExceptionHandler;
import com.example.pbl6.service.RoomCatalogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PublicRoomControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private RoomCatalogService roomCatalogService;

    @InjectMocks
    private PublicRoomController publicRoomController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(publicRoomController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getAllRoomTypes_ReturnsSuccess() throws Exception {
        RoomTypeResponse roomType = RoomTypeResponse.builder()
                .roomTypeId(1)
                .typeName("Phòng Deluxe")
                .basePrice(BigDecimal.valueOf(850000))
                .build();

        when(roomCatalogService.getAllRoomTypes()).thenReturn(List.of(roomType));

        mockMvc.perform(get("/api/public/rooms/room-types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].typeName").value("Phòng Deluxe"))
                .andExpect(jsonPath("$.data[0].basePrice").value(850000));
    }

    @Test
    void searchAvailableRoomsGet_ReturnsRoomsWithPricing() throws Exception {
        AvailableRoomResponse room = AvailableRoomResponse.builder()
                .roomId(101)
                .roomNumber("101")
                .nights(2)
                .pricePerNight(BigDecimal.valueOf(500000))
                .totalRoomCharge(BigDecimal.valueOf(1000000))
                .estimatedDeposit(BigDecimal.valueOf(300000))
                .depositPercentage(30)
                .build();

        when(roomCatalogService.findAvailableRooms(any(RoomSearchRequest.class)))
                .thenReturn(List.of(room));

        mockMvc.perform(get("/api/public/rooms/available")
                        .param("checkInDate", "2026-11-01")
                        .param("checkOutDate", "2026-11-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].roomNumber").value("101"))
                .andExpect(jsonPath("$.data[0].nights").value(2))
                .andExpect(jsonPath("$.data[0].totalRoomCharge").value(1000000))
                .andExpect(jsonPath("$.data[0].estimatedDeposit").value(300000));
    }

    @Test
    void searchAvailableRoomsPost_ReturnsRoomsWithPricing() throws Exception {
        RoomSearchRequest request = RoomSearchRequest.builder()
                .checkInDate(LocalDate.now().plusDays(1))
                .checkOutDate(LocalDate.now().plusDays(3))
                .build();

        AvailableRoomResponse room = AvailableRoomResponse.builder()
                .roomId(201)
                .roomNumber("201")
                .nights(2)
                .totalRoomCharge(BigDecimal.valueOf(1700000))
                .estimatedDeposit(BigDecimal.valueOf(510000))
                .build();

        when(roomCatalogService.findAvailableRooms(any(RoomSearchRequest.class)))
                .thenReturn(List.of(room));

        mockMvc.perform(post("/api/public/rooms/available")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].roomNumber").value("201"));
    }
}
