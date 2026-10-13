package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.booking.WalkInBookingRequest;
import com.example.pbl6.service.StaffBookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.example.pbl6.entity.Booking;
import com.example.pbl6.repository.BookingRepository;
import com.example.pbl6.service.CustomerBookingService;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/staff/bookings")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('RECEPTIONIST', 'CASHIER', 'MANAGER', 'ADMIN')")
public class StaffBookingController {

    private final StaffBookingService staffBookingService;
    private final CustomerBookingService customerBookingService;
    private final BookingRepository bookingRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Booking>>> getAllBookings(
            @RequestParam(required = false) String status) {
        List<Booking> bookings = (status != null && !status.trim().isEmpty())
                ? bookingRepository.findByStatus(status.trim().toUpperCase())
                : bookingRepository.findAll();
        return ResponseEntity.ok(ApiResponse.ok(bookings));
    }

    @GetMapping("/{bookingCode}")
    public ResponseEntity<ApiResponse<BookingDetailResponse>> getBookingDetail(@PathVariable String bookingCode) {
        BookingDetailResponse response = customerBookingService.getBookingByCode(bookingCode);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    /**
     * Nhân viên Lễ tân tạo đơn đặt phòng trực tiếp tại quầy cho khách vãng lai (Walk-in Booking)
     */
    @PostMapping("/walk-in")
    public ResponseEntity<ApiResponse<BookingDetailResponse>> createWalkInBooking(
            @Valid @RequestBody WalkInBookingRequest request,
            Authentication authentication) {

        String staffUsername = authentication != null ? authentication.getName() : "staff";
        BookingDetailResponse response = staffBookingService.createWalkInBooking(request, staffUsername);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Tạo đơn đặt phòng tại quầy (Walk-in) thành công!", response));
    }

    /**
     * Nhân viên Lễ tân / Thu ngân bấm duyệt tiền cọc bằng tay
     */
    @PostMapping("/{bookingCode}/confirm-deposit")
    public ResponseEntity<ApiResponse<BookingDetailResponse>> confirmDepositManual(
            @PathVariable String bookingCode,
            Authentication authentication) {

        String staffUsername = authentication != null ? authentication.getName() : "staff";
        BookingDetailResponse response = staffBookingService.confirmDepositManual(bookingCode, staffUsername);
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

        staffBookingService.cancelBooking(bookingCode, reason, staffUsername);
        return ResponseEntity.ok(ApiResponse.ok("Đã hủy đơn đặt phòng thành công", null));
    }
}
