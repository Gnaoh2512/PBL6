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
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ServiceRequestResponse>>> getAllRequests(
            @RequestParam(required = false) String status
    ) {
        List<ServiceRequestResponse> list = serviceRequestService.getAllRequests(status);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> assignRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.assignRequest(id, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Đã nhận xử lý yêu cầu dịch vụ", response));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> completeRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.completeRequest(id, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Đã hoàn tất yêu cầu dịch vụ phòng", response));
    }
}
