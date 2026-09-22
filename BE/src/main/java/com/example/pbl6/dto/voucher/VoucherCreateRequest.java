package com.example.pbl6.dto.voucher;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoucherCreateRequest {

    @NotBlank(message = "Mã voucher không được để trống")
    private String code;

    @NotBlank(message = "Tên chương trình ưu đãi không được để trống")
    private String voucherName;

    /**
     * PERCENTAGE hoặc FIXED_AMOUNT
     */
    @NotBlank(message = "Loại giảm giá không được để trống (PERCENTAGE hoặc FIXED_AMOUNT)")
    private String discountType;

    @NotNull(message = "Giá trị giảm không được để trống")
    private BigDecimal discountValue;

    private BigDecimal maxDiscountAmount;
    private BigDecimal minOrderAmount;

    private LocalDate startDate;
    private LocalDate endDate;
    private Integer usageLimit;
}
