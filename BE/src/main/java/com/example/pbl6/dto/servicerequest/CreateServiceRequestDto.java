package com.example.pbl6.dto.servicerequest;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateServiceRequestDto {

    @NotNull(message = "Mã đặt phòng (bookingId) không được để trống")
    private Integer bookingId;

    @NotNull(message = "Mã phòng (roomId) không được để trống")
    private Integer roomId;

    @NotNull(message = "Mã dịch vụ (serviceId) không được để trống")
    private Integer serviceId;

    @Builder.Default
    private Integer quantity = 1;

    private String note;
}
