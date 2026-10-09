package com.example.pbl6.dto.cashier;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CloseCashierShiftRequest {
    @NotNull(message = "Closing cash actual is required")
    private BigDecimal closingCashActual;

    private Integer receivedByAccountId;

    private String handoverNote;
}