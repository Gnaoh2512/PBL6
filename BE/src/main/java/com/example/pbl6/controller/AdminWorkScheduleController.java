package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.schedule.BulkScheduleRequest;
import com.example.pbl6.dto.schedule.BulkScheduleResponse;
import com.example.pbl6.dto.schedule.CopyScheduleRequest;
import com.example.pbl6.dto.schedule.ScheduleStaffResponse;
import com.example.pbl6.dto.schedule.WorkScheduleRequest;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
import com.example.pbl6.dto.schedule.WorkScheduleUpdateRequest;
import com.example.pbl6.service.WorkScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/schedules")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
public class AdminWorkScheduleController {

    private final WorkScheduleService workScheduleService;

    /**
     * Calendar feed. Use ?from=2026-11-01&to=2026-11-30 (max 93 days) with optional
     * accountId, shiftId and role filters. ?workDate= returns a single day.
     * With no parameters it returns every schedule (kept for older callers).
     */
    @GetMapping
    public ApiResponse<List<WorkScheduleResponse>> getSchedules(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer accountId,
            @RequestParam(required = false) Integer shiftId,
            @RequestParam(required = false) String role) {
        if (workDate != null) {
            return ApiResponse.ok(workScheduleService.getSchedulesByDate(workDate));
        }
        if (from != null || to != null) {
            return ApiResponse.ok(workScheduleService.searchSchedules(from, to, accountId, shiftId, role));
        }
        return ApiResponse.ok(workScheduleService.getAllSchedules());
    }

    /** Staff who can be scheduled (active, non-customer accounts) for the assignment dropdown. */
    @GetMapping("/staff")
    public ApiResponse<List<ScheduleStaffResponse>> getSchedulableStaff() {
        return ApiResponse.ok(workScheduleService.getSchedulableStaff());
    }

    @PostMapping
    public ApiResponse<WorkScheduleResponse> createSchedule(@Valid @RequestBody WorkScheduleRequest request) {
        return ApiResponse.ok("Work schedule created successfully", workScheduleService.createSchedule(request));
    }

    /** Move, reassign, change shift, status or notes. Omitted fields stay unchanged. */
    @PutMapping("/{id}")
    public ApiResponse<WorkScheduleResponse> updateSchedule(@PathVariable Integer id,
                                                            @RequestBody WorkScheduleUpdateRequest request) {
        return ApiResponse.ok("Work schedule updated successfully", workScheduleService.updateSchedule(id, request));
    }

    /** One shift for several staff over a date range, optionally only on certain weekdays. */
    @PostMapping("/bulk")
    public ApiResponse<BulkScheduleResponse> bulkAssign(@Valid @RequestBody BulkScheduleRequest request) {
        BulkScheduleResponse result = workScheduleService.bulkAssign(request);
        return ApiResponse.ok(bulkMessage("Bulk assignment finished", result), result);
    }

    /** Copy a range of the schedule forward (or back), e.g. last week onto this week. */
    @PostMapping("/copy")
    public ApiResponse<BulkScheduleResponse> copySchedules(@Valid @RequestBody CopyScheduleRequest request) {
        BulkScheduleResponse result = workScheduleService.copySchedules(request);
        return ApiResponse.ok(bulkMessage("Schedule copy finished", result), result);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteSchedule(@PathVariable Integer id) {
        workScheduleService.deleteSchedule(id);
        return ApiResponse.ok("Work schedule deleted successfully", null);
    }

    private String bulkMessage(String prefix, BulkScheduleResponse r) {
        return prefix + ": " + r.getCreatedCount() + " created, " + r.getUpdatedCount()
                + " updated, " + r.getSkippedCount() + " skipped";
    }
}
