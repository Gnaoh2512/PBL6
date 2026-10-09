package com.example.pbl6.service;

import com.example.pbl6.dto.cashier.CashierShiftResponse;
import com.example.pbl6.dto.cashier.CloseCashierShiftRequest;
import com.example.pbl6.dto.cashier.OpenCashierShiftRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.CashierShift;
import com.example.pbl6.entity.WorkSchedule;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.CashierShiftRepository;
import com.example.pbl6.repository.WorkScheduleRepository;
import com.example.pbl6.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CashierShiftServiceTest {

    @Mock
    private CashierShiftRepository cashierShiftRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private WorkScheduleRepository workScheduleRepository;

    @InjectMocks
    private CashierShiftServiceImpl cashierShiftService;

    private Account mockAccount;
    private CustomUserDetails userDetails;
    private CashierShift mockCashierShift;

    @BeforeEach
    void setUp() {
        mockAccount = Account.builder()
                .accountId(1)
                .username("cashier1")
                .fullName("Cashier One")
                .role("CASHIER")
                .build();

        userDetails = new CustomUserDetails(mockAccount);

        mockCashierShift = CashierShift.builder()
                .cashierShiftId(100)
                .account(mockAccount)
                .startTime(LocalDateTime.now())
                .openingCash(new BigDecimal("500000.00"))
                .status("OPEN")
                .build();
    }

    @Test
    void openShift_Success() {
        OpenCashierShiftRequest request = new OpenCashierShiftRequest();
        request.setOpeningCash(new BigDecimal("500000.00"));

        when(cashierShiftRepository.findByAccount_AccountId(1)).thenReturn(Collections.emptyList());
        when(cashierShiftRepository.save(any(CashierShift.class))).thenReturn(mockCashierShift);

        CashierShiftResponse response = cashierShiftService.openShift(userDetails, request);

        assertNotNull(response);
        assertEquals(100, response.getCashierShiftId());
        assertEquals("OPEN", response.getStatus());
        verify(cashierShiftRepository, times(1)).save(any(CashierShift.class));
    }

    @Test
    void openShift_AlreadyHasOpenShift_ThrowsException() {
        OpenCashierShiftRequest request = new OpenCashierShiftRequest();
        request.setOpeningCash(new BigDecimal("500000.00"));

        when(cashierShiftRepository.findByAccount_AccountId(1)).thenReturn(List.of(mockCashierShift));

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                cashierShiftService.openShift(userDetails, request));

        assertTrue(exception.getMessage().contains("already have an active/open cashier shift"));
        verify(cashierShiftRepository, never()).save(any(CashierShift.class));
    }

    @Test
    void closeShift_Success() {
        CloseCashierShiftRequest request = new CloseCashierShiftRequest();
        request.setClosingCashActual(new BigDecimal("1200000.00"));
        request.setHandoverNote("Shift closed without issues.");

        when(cashierShiftRepository.findById(100)).thenReturn(Optional.of(mockCashierShift));
        when(cashierShiftRepository.save(any(CashierShift.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CashierShiftResponse response = cashierShiftService.closeShift(100, userDetails, request);

        assertNotNull(response);
        assertEquals("CLOSED", response.getStatus());
        assertEquals(new BigDecimal("1200000.00"), response.getClosingCashActual());
        verify(cashierShiftRepository, times(1)).save(mockCashierShift);
    }
}