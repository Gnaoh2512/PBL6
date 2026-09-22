package com.example.pbl6.dto.billing;

import com.example.pbl6.dto.booking.BankTransferQrResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiveFolioResponse {
    private String bookingCode;
    private String bookingStatus;
    private String customerName;
    private String customerPhone;
    private String roomNumber;
    private String roomTypeName;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private long nights;
    private BigDecimal pricePerNight;

    private BigDecimal roomCharge;
    private BigDecimal serviceCharge;
    private BigDecimal subtotal;

    private BigDecimal taxRate;
    private BigDecimal taxAmount;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;

    private BigDecimal depositPaid;
    private BigDecimal remainingBalance;

    @JsonProperty("isFullySettled")
    private boolean isFullySettled;

    @Builder.Default
    private List<ServiceUsageResponse> services = new ArrayList<>();

    private BankTransferQrResponse settlementQr;
}
