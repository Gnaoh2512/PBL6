package com.example.pbl6.dto.history;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerBookingHistorySummaryResponse {
    private String bookingCode;
    private String roomNumber;
    private String roomTypeName;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private long nights;
    private Integer guestCount;
    private String bookingStatus;

    @JsonProperty("status")
    public String getStatus() {
        return bookingStatus;
    }

    private BigDecimal depositRequired;
    private BigDecimal depositPaid;

    @JsonProperty("depositAmount")
    public BigDecimal getDepositAmount() {
        return depositPaid != null ? depositPaid : BigDecimal.ZERO;
    }

    @JsonProperty("depositApplied")
    public BigDecimal getDepositApplied() {
        return depositPaid != null ? depositPaid : BigDecimal.ZERO;
    }

    private BigDecimal totalAmount;

    @JsonProperty("isPaidFull")
    private boolean isPaidFull;

    private LocalDateTime createdAt;
}
