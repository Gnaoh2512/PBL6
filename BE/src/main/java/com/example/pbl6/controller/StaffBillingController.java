package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.billing.CancellationRefundResponse;
import com.example.pbl6.dto.billing.LiveFolioResponse;
import com.example.pbl6.dto.billing.SettlementRequest;
import com.example.pbl6.dto.service.ServiceOrderRequest;
import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.example.pbl6.service.CustomerBillingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/staff/billing")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('RECEPTIONIST', 'CASHIER', 'MANAGER', 'ADMIN')")
public class StaffBillingController {

    private final CustomerBillingService billingService;

    /**
     * Lễ tân thực hiện Check-in nhận phòng cho khách
     */
    @PostMapping("/bookings/{bookingCode}/check-in")
    public ResponseEntity<ApiResponse<Void>> checkInGuest(
            @PathVariable String bookingCode,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String staffUsername = userDetails != null ? userDetails.getUsername() : "staff";
        billingService.checkInGuest(bookingCode, staffUsername);
        return ResponseEntity.ok(ApiResponse.ok("Check-in thành công cho khách. Phòng đã chuyển sang trạng thái OCCUPIED.", null));
    }

    /**
     * Nhân viên ghi nhận dịch vụ phát sinh vào phòng của khách
     */
    @PostMapping("/bookings/{bookingCode}/order-service")
    public ResponseEntity<ApiResponse<ServiceUsageResponse>> recordServiceUsage(
            @PathVariable String bookingCode,
            @Valid @RequestBody ServiceOrderRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String staffUsername = userDetails != null ? userDetails.getUsername() : "staff";
        request.setBookingCode(bookingCode);
        ServiceUsageResponse response = billingService.orderInStayService(request, staffUsername);
        return ResponseEntity.ok(ApiResponse.ok("Đã ghi nhận dịch vụ vào phòng khách thành công", response));
    }

    /**
     * Xem hóa đơn trực tiếp (Live Folio) của phòng
     */
    @GetMapping("/bookings/{bookingCode}/folio")
    public ResponseEntity<ApiResponse<LiveFolioResponse>> getLiveFolio(
            @PathVariable String bookingCode
    ) {
        LiveFolioResponse folio = billingService.getLiveFolio(bookingCode);
        return ResponseEntity.ok(ApiResponse.ok("Lấy hóa đơn chi tiết thành công", folio));
    }

    /**
     * Thu ngân / Lễ tân tất toán hóa đơn và Check-out (tiền mặt, thẻ, hoặc xác nhận chuyển khoản)
     */
    @PostMapping("/bookings/{bookingCode}/settle-and-checkout")
    public ResponseEntity<ApiResponse<LiveFolioResponse>> settleAndCheckout(
            @PathVariable String bookingCode,
            @RequestBody(required = false) SettlementRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String cashierUsername = userDetails != null ? userDetails.getUsername() : "cashier";
        if (request == null) {
            request = SettlementRequest.builder().paymentMethod("CASH").build();
        }
        LiveFolioResponse response = billingService.settleCheckout(bookingCode, request, cashierUsername);
        return ResponseEntity.ok(ApiResponse.ok("Tất toán hóa đơn và Check-out thành công. Phòng đã chuyển sang CLEANING để dọn dẹp.", response));
    }

    /**
     * Hủy đơn đặt phòng và áp dụng chính sách hoàn cọc tự động
     */
    @PostMapping("/bookings/{bookingCode}/cancel-with-refund")
    public ResponseEntity<ApiResponse<CancellationRefundResponse>> cancelWithRefund(
            @PathVariable String bookingCode,
            @RequestParam(defaultValue = "Khách yêu cầu hủy phòng") String reason,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String staffUsername = userDetails != null ? userDetails.getUsername() : "staff";
        CancellationRefundResponse response = billingService.cancelWithRefundPolicy(bookingCode, reason, staffUsername);
        return ResponseEntity.ok(ApiResponse.ok(response.getMessage(), response));
    }
}
