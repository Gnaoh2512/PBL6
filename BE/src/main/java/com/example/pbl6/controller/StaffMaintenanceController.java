package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.maintenance.CompleteMaintenanceDto;
import com.example.pbl6.dto.maintenance.MaintenanceRequestResponse;
import com.example.pbl6.dto.maintenance.ReportMaintenanceDto;
import com.example.pbl6.dto.equipment.EquipmentResponse;
import com.example.pbl6.service.EquipmentService;
import com.example.pbl6.service.MaintenanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/staff/maintenance")
@RequiredArgsConstructor
public class StaffMaintenanceController {

    private final MaintenanceService maintenanceService;
    private final EquipmentService equipmentService;

    @GetMapping("/equipment")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<EquipmentResponse>>> getEquipmentForReport(
            @RequestParam(required = false) Integer roomId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(equipmentService.getAllEquipment(roomId, null)));
    }

    @PostMapping("/report")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<MaintenanceRequestResponse>> reportIssue(
            @Valid @RequestBody ReportMaintenanceDto dto,
            Authentication authentication
    ) {
        MaintenanceRequestResponse response = maintenanceService.reportIssue(dto, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Báo hỏng phòng/thiết bị thành công", response));
    }

    @GetMapping("/requests")
    @PreAuthorize("hasAnyRole('MAINTENANCE', 'HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<MaintenanceRequestResponse>>> getAllRequests(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Integer roomId
    ) {
        List<MaintenanceRequestResponse> list = maintenanceService.getAllRequests(status, priority, roomId);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/requests/{id}/assign")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'MAINTENANCE')")
    public ResponseEntity<ApiResponse<MaintenanceRequestResponse>> assignTechnician(
            @PathVariable Integer id,
            @RequestParam Integer technicianId
    ) {
        MaintenanceRequestResponse response = maintenanceService.assignTechnician(id, technicianId);
        return ResponseEntity.ok(ApiResponse.ok("Đã phân công nhân viên xử lý bảo trì", response));
    }

    @PostMapping("/requests/{id}/complete")
    @PreAuthorize("hasAnyRole('MAINTENANCE', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<MaintenanceRequestResponse>> completeWork(
            @PathVariable Integer id,
            @RequestBody(required = false) CompleteMaintenanceDto dto,
            Authentication authentication
    ) {
        MaintenanceRequestResponse response = maintenanceService.completeWork(id, dto, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Đã báo cáo sửa chữa hoàn tất", response));
    }

    @PostMapping("/requests/{id}/confirm")
    @PreAuthorize("hasAnyRole('MANAGER', 'RECEPTIONIST', 'ADMIN')")
    public ResponseEntity<ApiResponse<MaintenanceRequestResponse>> confirmCompletion(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        MaintenanceRequestResponse response = maintenanceService.confirmCompletion(id, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Nghiệm thu bảo trì phòng thành công", response));
    }
}
