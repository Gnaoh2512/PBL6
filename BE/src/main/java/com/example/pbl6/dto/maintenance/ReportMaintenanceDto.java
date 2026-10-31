package com.example.pbl6.dto.maintenance;

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
public class ReportMaintenanceDto {

    @NotNull(message = "Mã phòng (roomId) không được để trống")
    private Integer roomId;

    private Integer equipmentId;

    @NotBlank(message = "Tiêu đề sự cố không được để trống")
    private String title;

    private String description;

    @Builder.Default
    private String priority = "MEDIUM"; // LOW | MEDIUM | HIGH | URGENT
}
