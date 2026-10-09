package com.example.pbl6.service;

import com.example.pbl6.dto.schedule.WorkScheduleRequest;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Shift;
import com.example.pbl6.entity.WorkSchedule;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.ShiftRepository;
import com.example.pbl6.repository.WorkScheduleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WorkScheduleServiceTest {

    @Mock
    private WorkScheduleRepository workScheduleRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private ShiftRepository shiftRepository;

    @InjectMocks
    private WorkScheduleServiceImpl workScheduleService;

    private Account mockAccount;
    private Shift mockShift;
    private WorkSchedule mockSchedule;

    @BeforeEach
    void setUp() {
        mockAccount = Account.builder().accountId(1).username("staff1").fullName("Staff One").build();
        mockShift = Shift.builder().shiftId(1).startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        mockSchedule = WorkSchedule.builder()
                .scheduleId(10)
                .account(mockAccount)
                .shift(mockShift)
                .workDate(LocalDate.of(2026, 10, 1))
                .build();
    }

    @Test
    void getSchedulesByDate_Success() {
        LocalDate date = LocalDate.of(2026, 10, 1);
        when(workScheduleRepository.findByWorkDate(date)).thenReturn(List.of(mockSchedule));

        List<WorkScheduleResponse> result = workScheduleService.getSchedulesByDate(date);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Staff One", result.get(0).getAccountFullName());
    }

    @Test
    void createSchedule_Success() {
        WorkScheduleRequest request = new WorkScheduleRequest();
        request.setAccountId(1);
        request.setShiftId(1);
        request.setWorkDate(LocalDate.of(2026, 10, 1));

        when(accountRepository.findById(1)).thenReturn(Optional.of(mockAccount));
        when(shiftRepository.findById(1)).thenReturn(Optional.of(mockShift));
        when(workScheduleRepository.save(any(WorkSchedule.class))).thenReturn(mockSchedule);

        WorkScheduleResponse result = workScheduleService.createSchedule(request);

        assertNotNull(result);
        assertEquals(10, result.getScheduleId());
        verify(workScheduleRepository, times(1)).save(any(WorkSchedule.class));
    }
}