package com.example.pbl6.dto.loyalty;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RedeemBenefitRequest {

    @NotNull(message = "Mã đặc quyền không được để trống")
    private Integer tierBenefitId;

    private Integer bookingId;

    private String note;
}
