package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.loyalty.AdjustPointsRequest;
import com.example.pbl6.dto.loyalty.LoyaltyProfileResponse;
import com.example.pbl6.entity.LoyaltyTier;
import com.example.pbl6.service.LoyaltyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/loyalty")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class AdminLoyaltyController {

    private final LoyaltyService loyaltyService;

    @GetMapping("/tiers")
    public ResponseEntity<ApiResponse<List<LoyaltyTier>>> getAllTiers() {
        List<LoyaltyTier> tiers = loyaltyService.getAllTiers();
        return ResponseEntity.ok(ApiResponse.ok(tiers));
    }

    @PostMapping("/adjust-points")
    public ResponseEntity<ApiResponse<LoyaltyProfileResponse>> adjustPoints(
            @Valid @RequestBody AdjustPointsRequest req,
            Authentication authentication
    ) {
        LoyaltyProfileResponse response = loyaltyService.adjustPoints(req, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Điều chỉnh điểm thành viên thành công", response));
    }
}
