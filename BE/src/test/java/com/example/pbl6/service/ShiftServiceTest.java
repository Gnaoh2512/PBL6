package com.example.pbl6.service;

import com.example.pbl6.dto.shift.ShiftRequest;
import com.example.pbl6.dto.shift.ShiftResponse;
import com.example.pbl6.entity.Shift;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.ShiftRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShiftServiceTest {

    @Mock
    private ShiftRepository shiftRepository;

    @InjectMocks
    private ShiftServiceImpl shiftService;

    private Shift mockShift;

    @BeforeEach
    void setUp() {
        mockShift = Shift.builder()
                .shiftId(1)
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(16, 0))
                .build();
    }

    @Test
    void getAllShifts_Success() {
        when(shiftRepository.findAll()).thenReturn(List.of(mockShift));

        List<ShiftResponse> response = shiftService.getAllShifts();

        assertNotNull(response);
        assertEquals(1, response.size());
        assertEquals(LocalTime.of(8, 0), response.get(0).getStartTime());
    }

    @Test
    void createShift_Success() {
        ShiftRequest request = new ShiftRequest();
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(16, 0));

        when(shiftRepository.save(any(Shift.class))).thenReturn(mockShift);

        ShiftResponse response = shiftService.createShift(request);

        assertNotNull(response);
        assertEquals(1, response.getShiftId());
        verify(shiftRepository, times(1)).save(any(Shift.class));
    }

    @Test
    void deleteShift_NotFound_ThrowsException() {
        when(shiftRepository.existsById(99)).thenReturn(false);

        assertThrows(ResourceNotFoundException.class, () -> shiftService.deleteShift(99));
        verify(shiftRepository, never()).deleteById(anyInt());
    }
}