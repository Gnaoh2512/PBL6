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
    private Integer tierId;
    private Integer tierLevel;
    private String tierCode;
    private String tierName;
    private Integer serviceId;
    private String serviceName;
    private Integer roomTypeId;
    private String roomTypeName;
    private String benefitType;
    private String benefitName;
    private BigDecimal discountPercent;
    private Integer quota;
    private Integer remainingQuota;
    private String periodType;
    private Boolean isActive;
    private String description;

    public static TierBenefitResponse fromEntity(TierBenefit entity, Integer remainingQuota) {
        if (entity == null) {
            return null;
        }
        return TierBenefitResponse.builder()
                .tierBenefitId(entity.getTierBenefitId())
                .tierId(entity.getTier() != null ? entity.getTier().getTierId() : null)
                .tierLevel(entity.getTier() != null ? entity.getTier().getTierLevel() : null)
                .tierCode(entity.getTier() != null ? entity.getTier().getTierCode() : null)
                .tierName(entity.getTier() != null ? entity.getTier().getTierName() : null)
                .serviceId(entity.getService() != null ? entity.getService().getServiceId() : null)
                .serviceName(entity.getService() != null ? entity.getService().getServiceName() : null)
                .roomTypeId(entity.getRoomType() != null ? entity.getRoomType().getRoomTypeId() : null)
                .roomTypeName(entity.getRoomType() != null ? entity.getRoomType().getTypeName() : null)
                .benefitType(entity.getBenefitType())
                .benefitName(entity.getBenefitName())
                .discountPercent(entity.getDiscountPercent())
                .quota(entity.getQuota())
                .remainingQuota(remainingQuota)
                .periodType(entity.getPeriodType())
                .isActive(entity.getIsActive())
                .description(entity.getDescription())
                .build();
    }
}
