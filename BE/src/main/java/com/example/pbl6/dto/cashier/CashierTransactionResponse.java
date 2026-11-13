package com.example.pbl6.dto.cashier;

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
public class CashierTransactionResponse {
    private Integer paymentId;
    private Integer bookingId;
    private String bookingCode;
    private String customerName;
    private String roomNumber;
    private String type; // DEPOSIT, SETTLEMENT, REFUND...
    private String method; // CASH, BANK_TRANSFER, CREDIT_CARD...
    private BigDecimal amount;
    private Integer receivedById;
    private String receivedByFullName;
    private String note;
    private LocalDateTime paidAt;
}

