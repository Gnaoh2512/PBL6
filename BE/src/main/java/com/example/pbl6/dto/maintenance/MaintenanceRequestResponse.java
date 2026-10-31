package com.example.pbl6.dto.maintenance;

import com.example.pbl6.entity.MaintenanceRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaintenanceRequestResponse {
    private Integer requestId;
    private Integer roomId;
    private String roomNumber;
    private Integer equipmentId;
    private String equipmentName;
    private String reportedByStaff;
    private String assignedToStaff;
    private String confirmedByStaff;
    private String title;
    private String description;
    private String priority;
    private String status;
    private String resolutionNote;
    private LocalDateTime reportedAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private LocalDateTime confirmedAt;

    public static MaintenanceRequestResponse fromEntity(MaintenanceRequest entity) {
        if (entity == null) {
            return null;
        }
        return MaintenanceRequestResponse.builder()
                .requestId(entity.getRequestId())
                .roomId(entity.getRoom() != null ? entity.getRoom().getRoomId() : null)
                .roomNumber(entity.getRoom() != null ? entity.getRoom().getRoomNumber() : null)
                .equipmentId(entity.getEquipment() != null ? entity.getEquipment().getEquipmentId() : null)
                .equipmentName(entity.getEquipment() != null ? entity.getEquipment().getEquipmentName() : null)
                .reportedByStaff(entity.getReportedBy() != null ? entity.getReportedBy().getFullName() : null)
                .assignedToStaff(entity.getAssignedTo() != null ? entity.getAssignedTo().getFullName() : null)
                .confirmedByStaff(entity.getConfirmedBy() != null ? entity.getConfirmedBy().getFullName() : null)
                .title(entity.getTitle())
                .description(entity.getDescription())
                .priority(entity.getPriority())
                .status(entity.getStatus())
                .resolutionNote(entity.getResolutionNote())
                .reportedAt(entity.getReportedAt())
                .startedAt(entity.getStartedAt())
                .completedAt(entity.getCompletedAt())
                .confirmedAt(entity.getConfirmedAt())
                .build();
    }
}
