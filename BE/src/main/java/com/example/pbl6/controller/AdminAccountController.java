package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.adminaccount.AccountCreateRequest;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;
import com.example.pbl6.service.AccountAdminService;
import com.example.pbl6.service.ServiceRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminAccountController {

    private final AccountAdminService accountAdminService;
    private final ServiceRequestService serviceRequestService;

    @GetMapping("/accounts")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ApiResponse<List<Account>> getAllAccounts() {
        return ApiResponse.ok(accountAdminService.getAllAccounts());
    }

    @PostMapping("/accounts")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Account> createAccount(@Valid @RequestBody AccountCreateRequest request) {
        return ApiResponse.ok("Account created successfully", accountAdminService.createAccount(request));
    }

    @GetMapping("/audit-logs")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ApiResponse<List<AuditLog>> getAuditLogs() {
        return ApiResponse.ok(accountAdminService.getAuditLogs());
    }

    /**
     * Lịch sử Dịch vụ theo Khách hàng (Admin Portal) phục vụ xem chi tiết tại tab "Tài khoản và nhật ký"
     */
    @GetMapping({"/accounts/{accountId}/service-requests", "/accounts/{accountId}/services"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ApiResponse<List<ServiceRequestResponse>> getServiceRequestsByAccountId(@PathVariable Integer accountId) {
        return ApiResponse.ok("Lấy danh sách dịch vụ đã sử dụng của tài khoản thành công",
                serviceRequestService.getRequestsByAccountId(accountId));
    }

    @GetMapping({"/customers/{customerId}/service-requests", "/customers/{customerId}/services"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ApiResponse<List<ServiceRequestResponse>> getServiceRequestsByCustomerId(@PathVariable Integer customerId) {
        return ApiResponse.ok("Lấy danh sách dịch vụ đã sử dụng của khách hàng thành công",
                serviceRequestService.getRequestsByCustomerId(customerId));
    }
}
