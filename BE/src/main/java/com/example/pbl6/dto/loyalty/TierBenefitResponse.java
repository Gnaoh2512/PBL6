package com.example.pbl6.dto.loyalty;

import com.example.pbl6.entity.TierBenefit;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TierBenefitResponse {
    private Integer tierBenefitId;
    private String tierCode;
    private String tierName;
    private String benefitType;
    private String benefitName;
    private BigDecimal discountPercent;
    private Integer quota;
    private Integer remainingQuota;
    private String periodType;
    private String description;

    public static TierBenefitResponse fromEntity(TierBenefit entity, Integer remainingQuota) {
        if (entity == null) {
            return null;
        }
        return TierBenefitResponse.builder()
                .tierBenefitId(entity.getTierBenefitId())
                .tierCode(entity.getTier() != null ? entity.getTier().getTierCode() : null)
                .tierName(entity.getTier() != null ? entity.getTier().getTierName() : null)
                .benefitType(entity.getBenefitType())
                .benefitName(entity.getBenefitName())
                .discountPercent(entity.getDiscountPercent())
                .quota(entity.getQuota())
                .remainingQuota(remainingQuota)
                .periodType(entity.getPeriodType())
                .description(entity.getDescription())
                .build();
    }
}
