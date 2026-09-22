package com.example.pbl6.dto.booking;

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
public class PaymentStatusResponse {
    private String bookingCode;
    private String bookingStatus; // PENDING_DEPOSIT, CONFIRMED, EXPIRED, CANCELED
    @com.fasterxml.jackson.annotation.JsonProperty("isPaid")
    private boolean isPaid;
    private BigDecimal depositAmount;
    private LocalDateTime paidAt;
    private String message;
}
