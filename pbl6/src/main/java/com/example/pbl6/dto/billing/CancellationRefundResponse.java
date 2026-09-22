package com.example.pbl6.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CancellationRefundResponse {
    private String bookingCode;
    private BigDecimal depositPaid;
    private int refundPercentage;
    private BigDecimal refundAmount;
    private BigDecimal penaltyFee;
    private String status;
    private String message;
}
