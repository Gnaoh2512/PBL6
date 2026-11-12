package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.service.ServiceRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/staff/service-requests")
@RequiredArgsConstructor
public class StaffServiceRequestController {

    private final ServiceRequestService serviceRequestService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN', 'HOUSEKEEPING', 'MAINTENANCE') or hasAnyAuthority('ROLE_SERVICE_STAFF', 'ROLE_RECEPTIONIST', 'ROLE_MANAGER', 'ROLE_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ServiceRequestResponse>>> getAllRequests(
            @RequestParam(required = false) String status
    ) {
        List<ServiceRequestResponse> list = serviceRequestService.getAllRequests(status);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN', 'HOUSEKEEPING', 'MAINTENANCE') or hasAnyAuthority('ROLE_SERVICE_STAFF', 'ROLE_RECEPTIONIST', 'ROLE_MANAGER', 'ROLE_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> assignRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.assignRequest(id, authentication != null ? authentication.getName() : "staff");
        return ResponseEntity.ok(ApiResponse.ok("Đã nhận xử lý yêu cầu dịch vụ", response));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN', 'HOUSEKEEPING', 'MAINTENANCE') or hasAnyAuthority('ROLE_SERVICE_STAFF', 'ROLE_RECEPTIONIST', 'ROLE_MANAGER', 'ROLE_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> completeRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.completeRequest(id, authentication != null ? authentication.getName() : "staff");
        return ResponseEntity.ok(ApiResponse.ok("Đã hoàn tất yêu cầu dịch vụ phòng", response));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN', 'HOUSEKEEPING', 'MAINTENANCE') or hasAnyAuthority('ROLE_SERVICE_STAFF', 'ROLE_RECEPTIONIST', 'ROLE_MANAGER', 'ROLE_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> cancelRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.cancelRequest(id, authentication != null ? authentication.getName() : "staff");
        return ResponseEntity.ok(ApiResponse.ok("Đã hủy yêu cầu dịch vụ", response));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN', 'HOUSEKEEPING', 'MAINTENANCE') or hasAnyAuthority('ROLE_SERVICE_STAFF', 'ROLE_RECEPTIONIST', 'ROLE_MANAGER', 'ROLE_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> updateStatus(
            @PathVariable Integer id,
            @RequestParam String status,
            Authentication authentication
    ) {
        String staff = authentication != null ? authentication.getName() : "staff";
        ServiceRequestResponse response = serviceRequestService.updateStatus(id, status, staff);
        return ResponseEntity.ok(ApiResponse.ok("Đã cập nhật trạng thái yêu cầu dịch vụ", response));
    }

    @PostMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN', 'HOUSEKEEPING', 'MAINTENANCE') or hasAnyAuthority('ROLE_SERVICE_STAFF', 'ROLE_RECEPTIONIST', 'ROLE_MANAGER', 'ROLE_ADMIN', 'SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> updateStatusPost(
            @PathVariable Integer id,
            @RequestParam String status,
            Authentication authentication
    ) {
        String staff = authentication != null ? authentication.getName() : "staff";
        ServiceRequestResponse response = serviceRequestService.updateStatus(id, status, staff);
        return ResponseEntity.ok(ApiResponse.ok("Đã cập nhật trạng thái yêu cầu dịch vụ", response));
    }
}
