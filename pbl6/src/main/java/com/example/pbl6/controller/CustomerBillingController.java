package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.billing.LiveFolioResponse;
import com.example.pbl6.dto.service.ServiceOrderRequest;
import com.example.pbl6.dto.service.ServiceResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.example.pbl6.service.CustomerBillingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customer/billing")
@RequiredArgsConstructor
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerBillingController {

    private final CustomerBillingService billingService;

    @GetMapping("/services")
    public ResponseEntity<ApiResponse<List<ServiceResponse>>> getServices(
            @RequestParam(required = false) Integer categoryId
    ) {
        List<ServiceResponse> services = billingService.getActiveServices(categoryId);
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh mục dịch vụ thành công", services));
    }

    @PostMapping("/services/order")
    public ResponseEntity<ApiResponse<ServiceUsageResponse>> orderInStayService(
            @Valid @RequestBody ServiceOrderRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String username = userDetails != null ? userDetails.getUsername() : "customer";
        ServiceUsageResponse response = billingService.orderInStayService(request, username);
        return ResponseEntity.ok(ApiResponse.ok("Gọi món / dịch vụ thành công! Đã ghi nhận vào hóa đơn phòng.", response));
    }

    @GetMapping("/bookings/{bookingCode}/folio")
    public ResponseEntity<ApiResponse<LiveFolioResponse>> getLiveFolio(
            @PathVariable String bookingCode
    ) {
        LiveFolioResponse folio = billingService.getLiveFolio(bookingCode);
        return ResponseEntity.ok(ApiResponse.ok("Tra cứu hóa đơn lưu trú thành công", folio));
    }
}
