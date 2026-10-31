package com.example.pbl6.service;

import com.example.pbl6.dto.schedule.WorkScheduleRequest;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Shift;
import com.example.pbl6.entity.WorkSchedule;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.ShiftRepository;
import com.example.pbl6.repository.WorkScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkScheduleServiceImpl implements WorkScheduleService {

    private final WorkScheduleRepository workScheduleRepository;
    private final AccountRepository accountRepository;
    private final ShiftRepository shiftRepository;
    private final AuditLogService auditLogService;

    @Override
    public List<WorkScheduleResponse> getAllSchedules() {
        return workScheduleRepository.findAll().stream()
                .map(WorkScheduleResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    public List<WorkScheduleResponse> getSchedulesByDate(LocalDate workDate) {
        return workScheduleRepository.findByWorkDate(workDate).stream()
                .map(WorkScheduleResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public WorkScheduleResponse createSchedule(WorkScheduleRequest request) {
        Account account = accountRepository.findById(request.getAccountId())
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", request.getAccountId()));

        Shift shift = shiftRepository.findById(request.getShiftId())
                .orElseThrow(() -> new ResourceNotFoundException("Shift", "id", request.getShiftId()));

        WorkSchedule schedule = WorkSchedule.builder()
                .account(account)
                .shift(shift)
                .workDate(request.getWorkDate())
                .notes(request.getNotes())
                .build();

        WorkSchedule saved = workScheduleRepository.save(schedule);

        auditLogService.log("LỊCH LÀM VIỆC", "ASSIGN", "work_schedule", Long.valueOf(saved.getScheduleId()),
                "Phân ca " + shift.getShiftName() + " (" + shift.getStartTime() + " - " + shift.getEndTime() + ") cho nhân viên " +
                        account.getFullName() + " (" + account.getUsername() + ") vào ngày " + request.getWorkDate());

        return WorkScheduleResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public void deleteSchedule(Integer id) {
        WorkSchedule ws = workScheduleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkSchedule", "id", id));
        String desc = "Hủy phân ca trực ID #" + id + " của " +
                (ws.getAccount() != null ? ws.getAccount().getFullName() : "nhân viên") +
                " (ngày " + ws.getWorkDate() + ")";
        workScheduleRepository.deleteById(id);

        auditLogService.log("LỊCH LÀM VIỆC", "DELETE", "work_schedule", Long.valueOf(id), desc);
    }
}
