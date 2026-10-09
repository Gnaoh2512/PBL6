package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.billing.LiveFolioResponse;
import com.example.pbl6.dto.billing.SettlementRequest;
import com.example.pbl6.dto.service.ServiceOrderRequest;
import com.example.pbl6.dto.service.ServiceResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.example.pbl6.service.CustomerBillingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicBillingController {

    private final CustomerBillingService billingService;

    /**
     * Lấy danh mục dịch vụ (Ẩm thực, Nước uống, Giặt ủi...)
     */
    @GetMapping("/services")
    public ResponseEntity<ApiResponse<List<ServiceResponse>>> getServices(
            @RequestParam(required = false) Integer categoryId
    ) {
        List<ServiceResponse> services = billingService.getActiveServices(categoryId);
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh mục dịch vụ thành công", services));
    }

    /**
     * Khách hàng gọi dịch vụ khi đang lưu trú theo mã đơn
     */
    @PostMapping("/services/order")
    public ResponseEntity<ApiResponse<ServiceUsageResponse>> orderInStayService(
            @Valid @RequestBody ServiceOrderRequest request
    ) {
        ServiceUsageResponse response = billingService.orderInStayService(request, "GUEST_ONLINE");
        return ResponseEntity.ok(ApiResponse.ok("Gọi dịch vụ phòng thành công! Dịch vụ đã được ghi nhận vào hóa đơn.", response));
    }

    /**
     * Tra cứu Hóa đơn trực tiếp theo thời gian thực (Real-time Live Folio)
     */
    @GetMapping("/bookings/{bookingCode}/folio")
    public ResponseEntity<ApiResponse<LiveFolioResponse>> getLiveFolio(
            @PathVariable String bookingCode
    ) {
        LiveFolioResponse folio = billingService.getLiveFolio(bookingCode);
        return ResponseEntity.ok(ApiResponse.ok("Tra cứu hóa đơn lưu trú thành công", folio));
    }

    /**
     * Giả lập thanh toán tất toán qua ngân hàng khi trả phòng (Dùng cho Demo/Kiểm thử)
     */
    @PostMapping("/bookings/{bookingCode}/simulate-settlement")
    public ResponseEntity<ApiResponse<LiveFolioResponse>> simulateSettlement(
            @PathVariable String bookingCode
    ) {
        SettlementRequest request = SettlementRequest.builder()
                .paymentMethod("BANK_TRANSFER")
                .note("Giả lập thanh toán tất toán qua VietQR Ngân hàng")
                .build();
        LiveFolioResponse response = billingService.settleCheckout(bookingCode, request, "SIMULATOR_BANK");
        return ResponseEntity.ok(ApiResponse.ok("Giả lập tất toán thành công! Hóa đơn đã hoàn tất và khách đã check-out.", response));
    }
}
