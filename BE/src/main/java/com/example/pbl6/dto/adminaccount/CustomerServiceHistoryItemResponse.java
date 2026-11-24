package com.example.pbl6.dto.adminaccount;

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
public class CustomerServiceHistoryItemResponse {
    private Integer id;
    private Integer serviceId;
    private String serviceName;
    private String categoryName;
    private String bookingCode;
    private Integer bookingId;
    private String roomNumber;
    private Integer quantity;
    private String unit;
    private BigDecimal unitPrice;
    private BigDecimal discountAmount;
    private BigDecimal totalPrice;
    private String status;
    private LocalDateTime usedAt;
    private String recordedBy;
    private Boolean isLoyaltyBenefit;
    private String note;
}
