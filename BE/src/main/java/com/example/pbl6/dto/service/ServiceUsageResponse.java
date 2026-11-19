package com.example.pbl6.dto.service;

import com.fasterxml.jackson.annotation.JsonProperty;
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
public class ServiceUsageResponse {
    private Integer usageId;
    /** Set only for free loyalty-benefit lines, which come from a service request instead of a usage. */
    private Integer serviceRequestId;
    private Boolean loyaltyBenefit;
    private String benefitName;
    private Integer serviceId;
    private String serviceName;
    private String categoryName;
    private Integer quantity;
    private String unit;
    private BigDecimal unitPriceApplied;
    private BigDecimal discountAmount;
    private BigDecimal totalPrice;
    private String status;
    private LocalDateTime usedAt;

    @JsonProperty("unitPrice")
    public BigDecimal getUnitPrice() {
        return unitPriceApplied;
    }

    @JsonProperty("totalAmount")
    public BigDecimal getTotalAmount() {
        return totalPrice;
    }

    @JsonProperty("orderTime")
    public LocalDateTime getOrderTime() {
        return usedAt;
    }
}
