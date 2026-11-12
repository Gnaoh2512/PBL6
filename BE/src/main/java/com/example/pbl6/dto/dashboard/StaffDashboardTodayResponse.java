package com.example.pbl6.dto.dashboard;

import com.example.pbl6.dto.cleaning.RoomCleaningResponse;
import com.example.pbl6.dto.maintenance.MaintenanceRequestResponse;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffDashboardTodayResponse {
    private LocalDate date;
    private Integer staffAccountId;
    private String staffName;
    private String roleCode;
    private int totalUrgentOrPendingCount;
    private List<UnifiedTaskItem> priorityTasks;
    private List<MaintenanceRequestResponse> maintenanceRequests;
    private List<RoomCleaningResponse> roomCleaningRequests;
    private List<ServiceRequestResponse> serviceRequests;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UnifiedTaskItem {
        private String taskType; // MAINTENANCE | ROOM_CLEANING | SERVICE_REQUEST
        private Integer taskId;
        private Integer roomId;
        private String roomNumber;
        private String title;
        private String description;
        private String priority; // URGENT | HIGH | MEDIUM | LOW
        private int priorityRank; // 4 = URGENT, 3 = HIGH, 2 = MEDIUM, 1 = LOW
        private String status;
        private Integer assignedToId;
        private String assignedToName;
        private LocalDateTime createdAt;
    }
}
