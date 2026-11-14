package com.example.pbl6.dto.equipment;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EquipmentRequest {

    private Integer roomId; // nullable, null = common area

    @NotBlank(message = "Tên thiết bị không được để trống")
    private String equipmentName;

    private String serialNumber;

    @Builder.Default
    private String status = "WORKING"; // WORKING | BROKEN | UNDER_REPAIR | RETIRED

    private String note;
}
