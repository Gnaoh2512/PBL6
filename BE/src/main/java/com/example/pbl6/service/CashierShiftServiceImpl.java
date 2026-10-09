package com.example.pbl6.service;

import com.example.pbl6.dto.cashier.CashierShiftResponse;
import com.example.pbl6.dto.cashier.CloseCashierShiftRequest;
import com.example.pbl6.dto.cashier.OpenCashierShiftRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.CashierShift;
import com.example.pbl6.entity.WorkSchedule;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.CashierShiftRepository;
import com.example.pbl6.repository.WorkScheduleRepository;
import com.example.pbl6.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CashierShiftServiceImpl implements CashierShiftService {

    private final CashierShiftRepository cashierShiftRepository;
    private final AccountRepository accountRepository;
    private final WorkScheduleRepository workScheduleRepository;

    @Override
    @Transactional
    public CashierShiftResponse openShift(CustomUserDetails userDetails, OpenCashierShiftRequest request) {
        Account account = userDetails.getAccount();

        List<CashierShift> userShifts = cashierShiftRepository.findByAccount_AccountId(account.getAccountId());
        boolean hasOpenShift = userShifts.stream().anyMatch(cs -> "OPEN".equalsIgnoreCase(cs.getStatus()));
        if (hasOpenShift) {
            throw new IllegalArgumentException("You already have an active/open cashier shift.");
        }

        WorkSchedule schedule = null;
        if (request.getScheduleId() != null) {
            schedule = workScheduleRepository.findById(request.getScheduleId())
                    .orElseThrow(() -> new ResourceNotFoundException("WorkSchedule", "id", request.getScheduleId()));
        }

        CashierShift shift = CashierShift.builder()
                .account(account)
                .workSchedule(schedule)
                .startTime(LocalDateTime.now())
                .openingCash(request.getOpeningCash())
                .status("OPEN")
                .build();

        return CashierShiftResponse.fromEntity(cashierShiftRepository.save(shift));
    }

    @Override
    @Transactional
    public CashierShiftResponse closeShift(Integer cashierShiftId, CustomUserDetails userDetails, CloseCashierShiftRequest request) {
        CashierShift shift = cashierShiftRepository.findById(cashierShiftId)
                .orElseThrow(() -> new ResourceNotFoundException("CashierShift", "id", cashierShiftId));

        if (!"OPEN".equalsIgnoreCase(shift.getStatus())) {
            throw new IllegalArgumentException("Cashier shift is not OPEN.");
        }

        Account receivedBy = null;
        if (request.getReceivedByAccountId() != null) {
            receivedBy = accountRepository.findById(request.getReceivedByAccountId())
                    .orElseThrow(() -> new ResourceNotFoundException("Account", "id", request.getReceivedByAccountId()));
        }

        shift.setEndTime(LocalDateTime.now());
        shift.setClosingCashActual(request.getClosingCashActual());
        shift.setStatus("CLOSED");
        shift.setReceivedBy(receivedBy);
        shift.setHandoverNote(request.getHandoverNote());

        return CashierShiftResponse.fromEntity(cashierShiftRepository.save(shift));
    }

    @Override
    public CashierShiftResponse getActiveShift(CustomUserDetails userDetails) {
        Account account = userDetails.getAccount();
        List<CashierShift> userShifts = cashierShiftRepository.findByAccount_AccountId(account.getAccountId());
        return userShifts.stream()
                .filter(cs -> "OPEN".equalsIgnoreCase(cs.getStatus()))
                .findFirst()
                .map(CashierShiftResponse::fromEntity)
                .orElseThrow(() -> new ResourceNotFoundException("Active CashierShift", "accountId", account.getAccountId()));
    }
}