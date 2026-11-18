package com.example.pbl6.service;

import com.example.pbl6.dto.maintenance.CompleteMaintenanceDto;
import com.example.pbl6.dto.maintenance.MaintenanceRequestResponse;
import com.example.pbl6.dto.maintenance.ReportMaintenanceDto;

import java.util.List;

public interface MaintenanceService {
    MaintenanceRequestResponse reportIssue(ReportMaintenanceDto dto, String username);
    List<MaintenanceRequestResponse> getAllRequests(String status, String priority, Integer roomId);
    /** Optional scoping: only requests assigned to / reported by the given username. */
    List<MaintenanceRequestResponse> getAllRequests(String status, String priority, Integer roomId, String assignedToUsername, String reportedByUsername);
    MaintenanceRequestResponse assignTechnician(Integer requestId, Integer technicianId);
    MaintenanceRequestResponse assignTechnician(Integer requestId, Integer technicianId, String actorUsername);
    MaintenanceRequestResponse completeWork(Integer requestId, CompleteMaintenanceDto dto, String technicianUsername);
    MaintenanceRequestResponse completeWork(Integer requestId, CompleteMaintenanceDto dto, String technicianUsername, boolean ownOnly);
    MaintenanceRequestResponse confirmCompletion(Integer requestId, String username);
}
