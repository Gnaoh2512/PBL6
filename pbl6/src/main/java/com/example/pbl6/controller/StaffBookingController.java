package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.service.CustomerBookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/staff/bookings")
@RequiredArgsConstructor
public class StaffBookingController {

    private final CustomerBookingService customerBookingService;

    /**
     * Nhân viên Lễ tân / Thu ngân bấm duyệt tiền cọc bằng tay
     */
    @PostMapping("/{bookingCode}/confirm-deposit")
    public ResponseEntity<ApiResponse<BookingDetailResponse>> confirmDepositManual(
            @PathVariable String bookingCode,
            Authentication authentication) {

        String staffUsername = authentication != null ? authentication.getName() : "staff";
        BookingDetailResponse response = customerBookingService.confirmDepositManual(bookingCode, staffUsername);
        return ResponseEntity.ok(ApiResponse.ok("Đã xác nhận tiền cọc thành công cho đơn " + bookingCode, response));
    }

    /**
     * Nhân viên hủy đơn đặt phòng
     */
    @PostMapping("/{bookingCode}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancelBooking(
            @PathVariable String bookingCode,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {

        String staffUsername = authentication != null ? authentication.getName() : "staff";
        String reason = body != null ? body.getOrDefault("reason", "Nhân viên hủy đơn") : "Nhân viên hủy đơn";

        customerBookingService.cancelBooking(bookingCode, reason, staffUsername);
        return ResponseEntity.ok(ApiResponse.ok("Đã hủy đơn đặt phòng thành công", null));
    }
}
