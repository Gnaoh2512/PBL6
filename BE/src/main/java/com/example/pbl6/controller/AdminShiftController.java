package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.shift.ShiftRequest;
import com.example.pbl6.dto.shift.ShiftResponse;
import com.example.pbl6.service.ShiftService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/shifts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
public class AdminShiftController {

    private final ShiftService shiftService;

    @GetMapping
    public ApiResponse<List<ShiftResponse>> getAllShifts() {
        return ApiResponse.ok(shiftService.getAllShifts());
    }

    @PostMapping
    public ApiResponse<ShiftResponse> createShift(@Valid @RequestBody ShiftRequest request) {
        return ApiResponse.ok("Shift created successfully", shiftService.createShift(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<ShiftResponse> updateShift(@PathVariable Integer id, @Valid @RequestBody ShiftRequest request) {
        return ApiResponse.ok("Shift updated successfully", shiftService.updateShift(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteShift(@PathVariable Integer id) {
        shiftService.deleteShift(id);
        return ApiResponse.ok("Shift deleted successfully", null);
    }
}