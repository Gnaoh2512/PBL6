package com.example.pbl6.dto.history;

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
public class PaymentHistoryResponse {
    private Integer paymentId;
    private String type;
    private String method;
    private BigDecimal amount;
    private String note;
    private LocalDateTime paidAt;
}
