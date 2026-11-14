package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.loyalty.LoyaltyProfileResponse;
import com.example.pbl6.dto.loyalty.LoyaltyTransactionResponse;
import com.example.pbl6.dto.loyalty.RedeemBenefitRequest;
import com.example.pbl6.dto.loyalty.TierBenefitResponse;
import com.example.pbl6.service.LoyaltyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customer/loyalty")
@RequiredArgsConstructor
public class CustomerLoyaltyController {

    private final LoyaltyService loyaltyService;

    @GetMapping("/profile")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ResponseEntity<ApiResponse<LoyaltyProfileResponse>> getProfile(Authentication authentication) {
        LoyaltyProfileResponse profile = loyaltyService.getProfile(authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok(profile));
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<LoyaltyTransactionResponse>>> getTransactions(Authentication authentication) {
        List<LoyaltyTransactionResponse> list = loyaltyService.getTransactions(authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/benefits")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TierBenefitResponse>>> getBenefits(Authentication authentication) {
        List<TierBenefitResponse> list = loyaltyService.getAvailableBenefits(authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/redeem")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ResponseEntity<ApiResponse<TierBenefitResponse>> redeemBenefit(
            @Valid @RequestBody RedeemBenefitRequest request,
            Authentication authentication) {
        TierBenefitResponse response = loyaltyService.redeemBenefit(request, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Áp dụng đặc quyền hội viên thành công!", response));
    }
}
