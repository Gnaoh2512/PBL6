package com.example.pbl6.dto.service;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceOrderRequest {

    @NotBlank(message = "Mã đơn đặt phòng không được để trống")
    private String bookingCode;

    @NotNull(message = "Mã dịch vụ không được để trống")
    private Integer serviceId;

    @NotNull(message = "Số lượng không được để trống")
    @Min(value = 1, message = "Số lượng tối thiểu là 1")
    @Builder.Default
    private Integer quantity = 1;

    private String note;
}
