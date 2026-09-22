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
public class SettlementRequest {
    /**
     * Phương thức thanh toán: BANK_TRANSFER, CASH, CREDIT_CARD
     */
    @Builder.Default
    private String paymentMethod = "CASH";

    /**
     * Số tiền thanh toán (nếu null, hệ thống tự động thanh toán toàn bộ số dư còn lại)
     */
    private BigDecimal amount;

    private String note;
}
