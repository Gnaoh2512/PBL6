package com.example.pbl6.dto.service;

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
}
