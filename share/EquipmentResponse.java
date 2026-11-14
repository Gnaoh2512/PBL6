package com.example.pbl6.dto.equipment;

import com.example.pbl6.entity.Equipment;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EquipmentResponse {
    private Integer equipmentId;
    private Integer roomId;
    private String roomNumber;
    private String equipmentName;
    private String serialNumber;
    private String status;
    private String note;

    public static EquipmentResponse fromEntity(Equipment entity) {
        if (entity == null) {
            return null;
        }
        return EquipmentResponse.builder()
                .equipmentId(entity.getEquipmentId())
                .roomId(entity.getRoom() != null ? entity.getRoom().getRoomId() : null)
                .roomNumber(entity.getRoom() != null ? entity.getRoom().getRoomNumber() : "Khu vực chung")
                .equipmentName(entity.getEquipmentName())
                .serialNumber(entity.getSerialNumber())
                .status(entity.getStatus())
                .note(entity.getNote())
                .build();
    }
}
