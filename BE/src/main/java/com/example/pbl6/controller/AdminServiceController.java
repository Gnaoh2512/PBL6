package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.adminservice.ServiceRequest;
import com.example.pbl6.entity.Service;
import com.example.pbl6.service.ServiceAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/services")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
public class AdminServiceController {

    private final ServiceAdminService serviceAdminService;

    @PostMapping
    public ApiResponse<Service> createService(@Valid @RequestBody ServiceRequest request) {
        return ApiResponse.ok("Service created successfully", serviceAdminService.createService(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<Service> updateService(@PathVariable Integer id, @Valid @RequestBody ServiceRequest request) {
        return ApiResponse.ok("Service updated successfully", serviceAdminService.updateService(id, request));
    }
}