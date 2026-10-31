package com.example.pbl6.service;

import com.example.pbl6.dto.maintenance.CompleteMaintenanceDto;
import com.example.pbl6.dto.maintenance.MaintenanceRequestResponse;
import com.example.pbl6.dto.maintenance.ReportMaintenanceDto;

import java.util.List;

public interface MaintenanceService {
    MaintenanceRequestResponse reportIssue(ReportMaintenanceDto dto, String username);
    List<MaintenanceRequestResponse> getAllRequests(String status, String priority, Integer roomId);
    MaintenanceRequestResponse assignTechnician(Integer requestId, Integer technicianId);
    MaintenanceRequestResponse completeWork(Integer requestId, CompleteMaintenanceDto dto, String technicianUsername);
    MaintenanceRequestResponse confirmCompletion(Integer requestId, String username);
}
