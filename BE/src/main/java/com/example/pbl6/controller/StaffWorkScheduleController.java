package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.schedule.AvailableStaffInShiftResponse;
import com.example.pbl6.dto.schedule.DayScheduleTableResponse;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
import com.example.pbl6.security.CustomUserDetails;
import com.example.pbl6.service.WorkScheduleService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.List;

/** Read-only calendar of the logged-in staff member's own shifts & available staff in shift. */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'MAINTENANCE', 'SERVICE_STAFF')")
public class StaffWorkScheduleController {

    private final WorkScheduleService workScheduleService;

    /** Defaults to the current month when from/to are omitted. */
    @GetMapping("/api/staff/schedules/me")
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

    /**
     * Xem bảng ca làm việc của 1 ngày (chỉ đọc dành cho nhân viên).
     */
    @GetMapping({"/api/staff/schedules/date/{workDate}", "/api/staff/schedules/day/{workDate}"})
    public ApiResponse<DayScheduleTableResponse> getDayScheduleTableForStaff(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workDate,
            @RequestParam(required = false) Integer shiftId,
            @RequestParam(required = false) String role) {
        return ApiResponse.ok(workScheduleService.getDayScheduleTable(workDate, shiftId, role));
    }

    /**
     * Strict Shift Validation API:
     * GET /api/v1/staff/available-in-shift?date=2026-11-13&time=10:30&roleCode=ROLE_HOUSEKEEPING
     * Trả về danh sách nhân viên có lịch làm việc (work_schedule) đang hoạt động đúng ca trực đó.
     */
    @GetMapping({"/api/v1/staff/available-in-shift", "/api/staff/available-in-shift", "/api/admin/schedules/available-in-shift"})
    public ApiResponse<List<AvailableStaffInShiftResponse>> getAvailableStaffInShift(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime time,
            @RequestParam(required = false) String roleCode) {
        List<AvailableStaffInShiftResponse> list = workScheduleService.getAvailableStaffInShift(date, time, roleCode);
        return ApiResponse.ok("Lấy danh sách nhân viên đang trong ca trực thành công", list);
    }
}
