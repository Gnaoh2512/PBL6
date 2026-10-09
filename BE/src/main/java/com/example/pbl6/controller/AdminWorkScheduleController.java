package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.schedule.WorkScheduleRequest;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
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

    @GetMapping
    public ApiResponse<List<WorkScheduleResponse>> getSchedules(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workDate) {
        if (workDate != null) {
            return ApiResponse.ok(workScheduleService.getSchedulesByDate(workDate));
        }
        return ApiResponse.ok(workScheduleService.getAllSchedules());
    }

    @PostMapping
    public ApiResponse<WorkScheduleResponse> createSchedule(@Valid @RequestBody WorkScheduleRequest request) {
        return ApiResponse.ok("Work schedule created successfully", workScheduleService.createSchedule(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteSchedule(@PathVariable Integer id) {
        workScheduleService.deleteSchedule(id);
        return ApiResponse.ok("Work schedule deleted successfully", null);
    }
}