package com.example.pbl6.service;

import com.example.pbl6.dto.room.AvailableRoomResponse;
import com.example.pbl6.dto.room.RoomSearchRequest;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.RoomType;
import com.example.pbl6.repository.RoomRepository;
import com.example.pbl6.repository.RoomTypeRepository;
import com.example.pbl6.service.financial.FinancialCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomCatalogServiceTest {

    @Mock
    private RoomTypeRepository roomTypeRepository;

    @Mock
    private RoomRepository roomRepository;

    @Spy
    private FinancialCalculator financialCalculator = new FinancialCalculator();

    @InjectMocks
    private RoomCatalogServiceImpl roomCatalogService;

    private RoomType mockRoomType;
    private Room mockRoom;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(roomCatalogService, "depositPercentage", 30);

        mockRoomType = RoomType.builder()
                .roomTypeId(1)
                .typeName("Phòng Standard")
                .capacity(2)
                .basePrice(BigDecimal.valueOf(500000))
                .amenities("Wifi, TV, Nóng lạnh")
                .description("Phòng tiện nghi")
                .build();

        mockRoom = Room.builder()
                .roomId(101)
                .roomNumber("101")
                .roomType(mockRoomType)
                .floor(1)
                .status("AVAILABLE")
                .build();
    }

    @Test
    void getAllRoomTypes_ReturnsList() {
        when(roomTypeRepository.findAll()).thenReturn(List.of(mockRoomType));

        List<RoomTypeResponse> results = roomCatalogService.getAllRoomTypes();

        assertEquals(1, results.size());
        assertEquals("Phòng Standard", results.get(0).getTypeName());
        assertEquals(BigDecimal.valueOf(500000), results.get(0).getBasePrice());
    }

    @Test
    void getRoomTypeById_Found_ReturnsResponse() {
        when(roomTypeRepository.findById(1)).thenReturn(Optional.of(mockRoomType));

        RoomTypeResponse result = roomCatalogService.getRoomTypeById(1);

        assertNotNull(result);
        assertEquals(1, result.getRoomTypeId());
        assertEquals("Phòng Standard", result.getTypeName());
    }

    @Test
    void findAvailableRooms_ValidDates_CalculatesPriceAndDeposit() {
        LocalDate checkIn = LocalDate.of(2026, 11, 1);
        LocalDate checkOut = LocalDate.of(2026, 11, 3); // 2 nights

        RoomSearchRequest request = RoomSearchRequest.builder()
                .checkInDate(checkIn)
                .checkOutDate(checkOut)
                .guestCount(2)
                .build();

        when(roomRepository.findAvailableRooms(eq(checkIn), eq(checkOut), any(), eq(2), any(), any()))
                .thenReturn(List.of(mockRoom));

        List<AvailableRoomResponse> results = roomCatalogService.findAvailableRooms(request);

        assertEquals(1, results.size());
        AvailableRoomResponse roomResp = results.get(0);
        assertEquals("101", roomResp.getRoomNumber());
        assertEquals(2, roomResp.getNights());
        // 500,000 * 2 nights = 1,000,000
        assertEquals(new BigDecimal("1000000.00"), roomResp.getTotalRoomCharge());
        // 30% deposit = 300,000
        assertEquals(new BigDecimal("300000"), roomResp.getEstimatedDeposit());
    }

    @Test
    void findAvailableRooms_SortPriceDesc_ReturnsSortedDescending() {
        LocalDate checkIn = LocalDate.of(2026, 11, 1);
        LocalDate checkOut = LocalDate.of(2026, 11, 2);

        RoomType deluxeType = RoomType.builder()
                .roomTypeId(2)
                .typeName("Phòng Deluxe")
                .basePrice(BigDecimal.valueOf(850000))
                .build();

        Room deluxeRoom = Room.builder()
                .roomId(201)
                .roomNumber("201")
                .roomType(deluxeType)
                .status("AVAILABLE")
                .build();

        RoomSearchRequest request = RoomSearchRequest.builder()
                .checkInDate(checkIn)
                .checkOutDate(checkOut)
                .sortBy("PRICE_DESC")
                .build();

        when(roomRepository.findAvailableRooms(eq(checkIn), eq(checkOut), any(), any(), any(), any()))
                .thenReturn(List.of(mockRoom, deluxeRoom)); // Standard (500k), Deluxe (850k)

        List<AvailableRoomResponse> results = roomCatalogService.findAvailableRooms(request);

        assertEquals(2, results.size());
        // Deluxe (850k) should be first
        assertEquals("201", results.get(0).getRoomNumber());
        assertEquals(BigDecimal.valueOf(850000), results.get(0).getPricePerNight());
        // Standard (500k) should be second
        assertEquals("101", results.get(1).getRoomNumber());
    }

    @Test
    void findAvailableRooms_InvalidDates_ThrowsException() {
        LocalDate checkIn = LocalDate.of(2026, 11, 5);
        LocalDate checkOut = LocalDate.of(2026, 11, 3); // checkOut before checkIn

        RoomSearchRequest request = RoomSearchRequest.builder()
                .checkInDate(checkIn)
                .checkOutDate(checkOut)
                .build();

        assertThrows(IllegalArgumentException.class, () -> {
            roomCatalogService.findAvailableRooms(request);
        });
    }
}
