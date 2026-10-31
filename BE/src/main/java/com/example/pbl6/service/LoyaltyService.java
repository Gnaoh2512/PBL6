package com.example.pbl6.service;

import com.example.pbl6.dto.loyalty.*;
import com.example.pbl6.entity.Invoice;
import com.example.pbl6.entity.LoyaltyTier;

import java.util.List;

public interface LoyaltyService {
    LoyaltyProfileResponse getProfile(String username);
    List<LoyaltyTransactionResponse> getTransactions(String username);
    List<TierBenefitResponse> getAvailableBenefits(String username);
    void recordStayAndEarnPoints(Invoice invoice);
    LoyaltyProfileResponse adjustPoints(AdjustPointsRequest req, String adminUsername);
    List<LoyaltyTier> getAllTiers();
}
