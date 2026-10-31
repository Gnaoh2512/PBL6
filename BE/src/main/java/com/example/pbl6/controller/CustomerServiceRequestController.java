package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.servicerequest.CreateServiceRequestDto;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.service.ServiceRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customer/service-requests")
@RequiredArgsConstructor
public class CustomerServiceRequestController {

    private final ServiceRequestService serviceRequestService;

    @PostMapping
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> createRequest(
            @Valid @RequestBody CreateServiceRequestDto dto,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.createRequest(dto, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Gửi yêu cầu dịch vụ phòng thành công", response));
    }

    @GetMapping("/my-requests")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ServiceRequestResponse>>> getMyRequests(Authentication authentication) {
        List<ServiceRequestResponse> list = serviceRequestService.getMyRequests(authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ServiceRequestResponse>> cancelRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        ServiceRequestResponse response = serviceRequestService.cancelRequest(id, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Đã hủy yêu cầu dịch vụ", response));
    }
}
