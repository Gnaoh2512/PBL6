package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.servicerequest.CreateServiceRequestDto;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.service.ServiceRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import com.example.pbl6.security.Roles;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customer/service-requests")
@RequiredArgsConstructor
public class CustomerServiceRequestController {

    private final ServiceRequestService serviceRequestService;

    @GetMapping("/my-requests")
    @PreAuthorize(Roles.CUSTOMER_OR_ADMIN)
    public ResponseEntity<ApiResponse<List<ServiceRequestResponse>>> getMyRequests(Authentication authentication) {
        List<ServiceRequestResponse> list = serviceRequestService.getMyRequests(authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

}
