package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.adminaccount.AccountCreateRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;
import com.example.pbl6.service.AccountAdminService;
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
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<AuditLog>> getAuditLogs() {
        return ApiResponse.ok(accountAdminService.getAuditLogs());
    }
}
