package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
import com.example.pbl6.security.CustomUserDetails;
import com.example.pbl6.service.WorkScheduleService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/** Read-only calendar of the logged-in staff member's own shifts. */
@RestController
@RequestMapping("/api/staff/schedules")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'MAINTENANCE', 'SERVICE_STAFF')")
public class StaffWorkScheduleController {

    private final WorkScheduleService workScheduleService;

    /** Defaults to the current month when from/to are omitted. */
    @GetMapping("/me")
    public ApiResponse<List<WorkScheduleResponse>> getMySchedules(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        YearMonth thisMonth = YearMonth.now();
        LocalDate start = from != null ? from : thisMonth.atDay(1);
        LocalDate end = to != null ? to : thisMonth.atEndOfMonth();
        return ApiResponse.ok(workScheduleService.getMySchedules(
                userDetails.getAccount().getAccountId(), start, end));
    }
}
