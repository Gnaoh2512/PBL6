package com.example.pbl6.dto.voucher;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoucherApplyRequest {

    @JsonAlias({"voucherCode", "code"})
    @NotBlank(message = "Mã voucher không được để trống")
    private String code;

    @NotNull(message = "Tổng tiền phòng dự kiến không được để trống")
    private BigDecimal orderAmount;

    public String getCode() {
        return code != null ? code.trim().toUpperCase() : null;
    }
}
