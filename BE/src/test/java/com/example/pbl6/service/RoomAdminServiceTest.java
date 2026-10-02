package com.example.pbl6.service;

import com.example.pbl6.dto.adminroom.RoomRequest;
import com.example.pbl6.dto.adminroom.RoomTypeRequest;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.RoomType;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.RoomRepository;
import com.example.pbl6.repository.RoomTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomAdminServiceTest {

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private RoomTypeRepository roomTypeRepository;

    @InjectMocks
    private RoomAdminServiceImpl roomAdminService;

    private RoomType mockRoomType;
    private Room mockRoom;

    @BeforeEach
    void setUp() {
        mockRoomType = RoomType.builder()
                .roomTypeId(1)
                .typeName("Deluxe Suite")
                .capacity(2)
                .basePrice(new BigDecimal("1000000.00"))
                .build();

        mockRoom = Room.builder()
                .roomId(10)
                .roomNumber("101")
                .roomType(mockRoomType)
                .floor(1)
                .status("AVAILABLE")
                .build();
    }

    @Test
    void createRoomType_Success() {
        RoomTypeRequest request = new RoomTypeRequest();
        request.setTypeName("Deluxe Suite");
        request.setCapacity(2);
        request.setBasePrice(new BigDecimal("1000000.00"));

        when(roomTypeRepository.save(any(RoomType.class))).thenReturn(mockRoomType);

        RoomType result = roomAdminService.createRoomType(request);

        assertNotNull(result);
        assertEquals("Deluxe Suite", result.getTypeName());
        verify(roomTypeRepository, times(1)).save(any(RoomType.class));
    }

    @Test
    void createRoom_Success() {
        RoomRequest request = new RoomRequest();
        request.setRoomNumber("101");
        request.setRoomTypeId(1);
        request.setFloor(1);

        when(roomRepository.existsByRoomNumber("101")).thenReturn(false);
        when(roomTypeRepository.findById(1)).thenReturn(Optional.of(mockRoomType));
        when(roomRepository.save(any(Room.class))).thenReturn(mockRoom);

        Room result = roomAdminService.createRoom(request);

        assertNotNull(result);
        assertEquals("101", result.getRoomNumber());
        verify(roomRepository, times(1)).save(any(Room.class));
    }

    @Test
    void createRoom_DuplicateRoomNumber_ThrowsException() {
        RoomRequest request = new RoomRequest();
        request.setRoomNumber("101");

        when(roomRepository.existsByRoomNumber("101")).thenReturn(true);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                roomAdminService.createRoom(request));

        assertTrue(exception.getMessage().contains("Room number already exists"));
        verify(roomRepository, never()).save(any(Room.class));
    }

    @Test
    void updateRoomStatus_Success() {
        when(roomRepository.findById(10)).thenReturn(Optional.of(mockRoom));
        when(roomRepository.save(any(Room.class))).thenReturn(mockRoom);

        Room result = roomAdminService.updateRoomStatus(10, "MAINTENANCE");

        assertNotNull(result);
        assertEquals("MAINTENANCE", result.getStatus());
        verify(roomRepository, times(1)).save(mockRoom);
    }
}