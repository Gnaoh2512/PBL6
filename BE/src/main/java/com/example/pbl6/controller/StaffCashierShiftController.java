package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.cashier.CashierShiftResponse;
import com.example.pbl6.dto.cashier.CloseCashierShiftRequest;
import com.example.pbl6.dto.cashier.OpenCashierShiftRequest;
import com.example.pbl6.security.CustomUserDetails;
import com.example.pbl6.service.CashierShiftService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/staff/cashier-shifts")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER')")
public class StaffCashierShiftController {

    private final CashierShiftService cashierShiftService;

    @PostMapping("/open")
    public ApiResponse<CashierShiftResponse> openShift(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody OpenCashierShiftRequest request) {
        return ApiResponse.ok("Cashier shift opened successfully", cashierShiftService.openShift(userDetails, request));
    }

    @PostMapping("/{id}/close")
    public ApiResponse<CashierShiftResponse> closeShift(
            @PathVariable Integer id,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CloseCashierShiftRequest request) {
        return ApiResponse.ok("Cashier shift closed successfully", cashierShiftService.closeShift(id, userDetails, request));
    }

    @GetMapping("/me")
    public ApiResponse<CashierShiftResponse> getActiveShift(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ApiResponse.ok(cashierShiftService.getActiveShift(userDetails));
    }
}