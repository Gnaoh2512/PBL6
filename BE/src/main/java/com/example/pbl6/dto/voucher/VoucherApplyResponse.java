package com.example.pbl6.dto.voucher;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoucherApplyResponse {

    @JsonProperty("isValid")
    private boolean isValid;

    private String code;
    private String voucherName;
    private BigDecimal originalAmount;
    private BigDecimal discountAmount;
    private BigDecimal finalAmount;
    private BigDecimal newDepositRequired;
    private String message;
}
