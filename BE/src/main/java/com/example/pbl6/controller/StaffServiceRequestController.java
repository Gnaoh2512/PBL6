package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.common.StaffScope;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.service.ServiceRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import com.example.pbl6.security.Roles;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/staff/service-requests")
@RequiredArgsConstructor
public class StaffServiceRequestController {

    private final ServiceRequestService serviceRequestService;

    @GetMapping
    @PreAuthorize(Roles.SERVICE_DESK)
    public ResponseEntity<ApiResponse<List<ServiceRequestResponse>>> getAllRequests(
            @RequestParam(required = false) String status,
            Authentication authentication
    ) {
        // Service staff only see the requests assigned to them
        List<ServiceRequestResponse> list = serviceRequestService.getAllRequests(
                status,
                authentication != null ? authentication.getName() : null,
                StaffScope.isOwnTasksOnly(authentication));
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize(Roles.SUPERVISORS)
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> assignRequest(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer staffId,
            @RequestParam(required = false) Integer assignedToId,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication
    ) {
        String actorUsername = authentication != null ? authentication.getName() : "staff";
        Integer targetStaffId = staffId != null ? staffId : assignedToId;
        if (targetStaffId == null && body != null) {
            Object val = body.getOrDefault("assignedToId", body.get("staffId"));
            if (val instanceof Number n) {
                targetStaffId = n.intValue();
            } else if (val != null) {
                try {
                    targetStaffId = Integer.parseInt(val.toString().trim());
                } catch (NumberFormatException ignored) {
                }
            }
        }

        ServiceRequestResponse response = serviceRequestService.assignRequestToStaff(id, targetStaffId, actorUsername);
        return ResponseEntity.ok(ApiResponse.ok("Đã phân công xử lý yêu cầu dịch vụ (Trạng thái: DELIVERING)", response));
    }

    // Service staff picks an unassigned request from the shared pool (must be on the current shift)
    @PostMapping("/{id}/claim")
    @PreAuthorize(Roles.SERVICE_STAFF_ONLY)
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> claimRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.claimRequest(id, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Đã nhận yêu cầu dịch vụ (Trạng thái: DELIVERING)", response));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize(Roles.SERVICE_DESK)
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> completeRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.completeRequest(
                id,
                authentication != null ? authentication.getName() : "staff",
                StaffScope.isOwnTasksOnly(authentication));
        return ResponseEntity.ok(ApiResponse.ok("Đã hoàn tất yêu cầu dịch vụ phòng (Trạng thái: COMPLETED)", response));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize(Roles.SUPERVISORS)
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> cancelRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.cancelRequest(id, authentication != null ? authentication.getName() : "staff");
        return ResponseEntity.ok(ApiResponse.ok("Đã hủy yêu cầu dịch vụ", response));
    }

}
