package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;
import com.example.pbl6.service.CustomerBookingService;
import com.example.pbl6.service.CustomerHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customer/bookings")
@RequiredArgsConstructor
public class CustomerBookingController {

    private final CustomerBookingService customerBookingService;
    private final CustomerHistoryService customerHistoryService;

    /**
     * Khách hàng đã đăng nhập xem danh sách các đơn đặt phòng của mình
     */
    @GetMapping("/my-bookings")
    public ResponseEntity<ApiResponse<List<BookingDetailResponse>>> getMyBookings(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(ApiResponse.error("Vui lòng đăng nhập để xem lịch sử đặt phòng"));
        }
        List<BookingDetailResponse> bookings = customerBookingService.getMyBookings(authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok(bookings));
    }

    /**
     * Khách hàng xem danh sách lịch sử lưu trú & đặt phòng (hỗ trợ lọc status=CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELED)
     */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<CustomerBookingHistorySummaryResponse>>> getMemberHistory(
            @RequestParam(required = false) String status,
            Authentication authentication
    ) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(ApiResponse.error("Vui lòng đăng nhập để xem lịch sử đặt phòng"));
        }
        List<CustomerBookingHistorySummaryResponse> history = customerHistoryService.getMemberHistory(authentication.getName(), status);
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách lịch sử đặt phòng thành công", history));
    }

    /**
     * Khách hàng xem chi tiết toàn diện 1 kỳ lưu trú trong lịch sử (kèm hóa đơn, dịch vụ phòng, giao dịch tài chính)
     */
    @GetMapping("/history/{bookingCode}")
    public ResponseEntity<ApiResponse<CustomerBookingHistoryDetailResponse>> getMemberBookingDetail(
            @PathVariable String bookingCode,
            Authentication authentication
    ) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(ApiResponse.error("Vui lòng đăng nhập để xem chi tiết lịch sử"));
        }
        CustomerBookingHistoryDetailResponse detail = customerHistoryService.getMemberBookingDetail(authentication.getName(), bookingCode);
        return ResponseEntity.ok(ApiResponse.ok("Lấy chi tiết đơn lưu trú thành công", detail));
    }
}
