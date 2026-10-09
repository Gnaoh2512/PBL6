package com.example.pbl6.dto.adminservice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ServiceRequest {
    private Integer categoryId;

    @NotBlank(message = "Service name is required")
    @Size(max = 100, message = "Service name must not exceed 100 characters")
    private String serviceName;

    @NotNull(message = "Unit price is required")
    private BigDecimal unitPrice;

    @Size(max = 50, message = "Unit must not exceed 50 characters")
    private String unit;

    private Boolean isActive;
}