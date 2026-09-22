package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.booking.BookingCreateRequest;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.booking.PaymentStatusResponse;
import com.example.pbl6.dto.booking.SePayWebhookPayload;
import com.example.pbl6.service.CustomerBookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/public/bookings")
@RequiredArgsConstructor
public class PublicBookingController {

    private final CustomerBookingService customerBookingService;

    /**
     * Khách hàng đặt phòng trực tuyến & nhận mã VietQR nộp cọc
     */
    @PostMapping
    public ResponseEntity<ApiResponse<BookingDetailResponse>> createBooking(
            @Valid @RequestBody BookingCreateRequest request,
            Authentication authentication) {

        String currentUsername = authentication != null && authentication.isAuthenticated()
                ? authentication.getName()
                : null;

        BookingDetailResponse response = customerBookingService.createBooking(request, currentUsername);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Khởi tạo đơn đặt phòng thành công. Vui lòng chuyển khoản tiền cọc để giữ phòng!", response));
    }

    /**
     * Tra cứu thông tin chi tiết đơn đặt phòng bằng mã booking
     */
    @GetMapping("/{bookingCode}")
    public ResponseEntity<ApiResponse<BookingDetailResponse>> getBookingByCode(@PathVariable String bookingCode) {
        BookingDetailResponse response = customerBookingService.getBookingByCode(bookingCode);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    /**
     * Kiểm tra trạng thái nộp cọc theo thời gian thực (Polling API mỗi 3 giây)
     */
    @GetMapping("/{bookingCode}/payment-status")
    public ResponseEntity<ApiResponse<PaymentStatusResponse>> getPaymentStatus(@PathVariable String bookingCode) {
        PaymentStatusResponse response = customerBookingService.getPaymentStatus(bookingCode);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    /**
     * Cổng tiếp nhận Webhook tự động từ dịch vụ SePay khi có tiền về
     */
    @PostMapping("/sepay-webhook")
    public ResponseEntity<Map<String, Object>> handleSePayWebhook(
            @RequestBody SePayWebhookPayload payload,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        boolean success = customerBookingService.processSePayWebhook(payload, authHeader);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "message", success ? "Xử lý webhook thành công" : "Bỏ qua hoặc không khớp giao dịch"
        ));
    }

    /**
     * Giả lập nộp tiền cọc thành công (Dành riêng cho dev / demo thuyết trình đồ án)
     */
    @PostMapping("/{bookingCode}/simulate-deposit")
    public ResponseEntity<ApiResponse<PaymentStatusResponse>> simulateDeposit(@PathVariable String bookingCode) {
        PaymentStatusResponse response = customerBookingService.simulateDeposit(bookingCode);
        return ResponseEntity.ok(ApiResponse.ok("Giả lập nộp cọc thành công!", response));
    }
}
