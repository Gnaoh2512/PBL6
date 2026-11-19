package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.billing.CancelBookingRequest;
import com.example.pbl6.dto.billing.CancellationRefundResponse;
import com.example.pbl6.service.CustomerBillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import com.example.pbl6.security.Roles;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/staff/billing")
@RequiredArgsConstructor
@PreAuthorize(Roles.SUPERVISORS)
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
     * Hủy đơn đặt phòng và áp dụng chính sách hoàn cọc tự động hoặc bảo lưu linh hoạt (Voucher / Điểm thưởng)
     */
    @PostMapping("/bookings/{bookingCode}/cancel-with-refund")
    public ResponseEntity<ApiResponse<CancellationRefundResponse>> cancelWithRefund(
            @PathVariable String bookingCode,
            @RequestParam(required = false) String reason,
            @RequestBody(required = false) CancelBookingRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String staffUsername = userDetails != null ? userDetails.getUsername() : "staff";
        if (request == null) {
            request = CancelBookingRequest.builder()
                    .reason(StringUtils.hasText(reason) ? reason : "Khách yêu cầu hủy phòng")
                    .refundOption("CASH_REFUND")
                    .build();
        } else if (StringUtils.hasText(reason) && !StringUtils.hasText(request.getReason())) {
            request.setReason(reason);
        }
        CancellationRefundResponse response = billingService.cancelWithFlexibleOptions(bookingCode, request, staffUsername);
        return ResponseEntity.ok(ApiResponse.ok(response.getMessage(), response));
    }
}
