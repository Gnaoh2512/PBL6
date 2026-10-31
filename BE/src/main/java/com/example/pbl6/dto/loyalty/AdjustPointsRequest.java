package com.example.pbl6.dto.loyalty;

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
public class AdjustPointsRequest {

    @NotNull(message = "Mã khách hàng không được để trống")
    private Integer customerId;

    @NotNull(message = "Số điểm điều chỉnh không được để trống")
    private BigDecimal points; // có thể dương (+) hoặc âm (-)

    private String note;
}
