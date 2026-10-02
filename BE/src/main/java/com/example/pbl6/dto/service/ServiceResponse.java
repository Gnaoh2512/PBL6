package com.example.pbl6.dto.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceResponse {
    private Integer serviceId;
    private String categoryName;
    private String serviceName;
    private BigDecimal unitPrice;
    private String unit;
    private Boolean isActive;
}
