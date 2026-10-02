package com.example.pbl6.dto.cashier;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class OpenCashierShiftRequest {
    private Integer scheduleId;

    @NotNull(message = "Opening cash is required")
    private BigDecimal openingCash;
}