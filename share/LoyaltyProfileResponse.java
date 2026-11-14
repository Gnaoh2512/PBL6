package com.example.pbl6.dto.loyalty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoyaltyProfileResponse {
    private Integer customerId;
    private String fullName;
    private String email;
    private String phone;
    private String tierCode;
    private String tierName;
    private Integer tierLevel;
    private BigDecimal currentScore;
    private Integer totalStayDays;
    private BigDecimal totalSpent;
    private LocalDateTime tierUpdatedAt;
    private LocalDateTime memberSince;
    private String nextTierCode;
    private String nextTierName;
    private BigDecimal pointsToNextTier;
}
