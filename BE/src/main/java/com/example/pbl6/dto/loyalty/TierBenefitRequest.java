package com.example.pbl6.dto.loyalty;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TierBenefitRequest {

    private Integer tierId;

    private String tierCode; // Hỗ trợ truyền tierId hoặc tierCode

    private Integer serviceId;

    private Integer roomTypeId;

    @NotBlank(message = "Loại đặc quyền (benefitType) không được để trống (ROOM_DISCOUNT | FREE_SERVICE | FREE_NIGHT)")
    private String benefitType;

    @NotBlank(message = "Tên đặc quyền (benefitName) không được để trống")
    private String benefitName;

    private BigDecimal discountPercent;

    private Integer quota; // null = không giới hạn

    @Builder.Default
    private String periodType = "YEAR"; // DAY | MONTH | YEAR

    @Builder.Default
    private Boolean isActive = true;

    private String description;
}
