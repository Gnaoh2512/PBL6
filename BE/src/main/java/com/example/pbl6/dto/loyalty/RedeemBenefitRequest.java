package com.example.pbl6.dto.loyalty;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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

    private String bookingCode;

    private Integer serviceUsageId;

    private Integer serviceRequestId;

    @Size(max = 64, message = "Idempotency key tối đa 64 ký tự")
    private String idempotencyKey;

    private String note;
}
