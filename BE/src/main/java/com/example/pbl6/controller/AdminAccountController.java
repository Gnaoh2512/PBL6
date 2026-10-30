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
@PreAuthorize("hasRole('ADMIN')")
public class AdminAccountController {

    private final AccountAdminService accountAdminService;

    @GetMapping("/accounts")
    public ApiResponse<List<Account>> getAllAccounts() {
        return ApiResponse.ok(accountAdminService.getAllAccounts());
    }

    @PostMapping("/accounts")
    public ApiResponse<Account> createAccount(@Valid @RequestBody AccountCreateRequest request) {
        return ApiResponse.ok("Account created successfully", accountAdminService.createAccount(request));
    }

    @GetMapping("/audit-logs")
    public ApiResponse<List<AuditLog>> getAuditLogs() {
        return ApiResponse.ok(accountAdminService.getAuditLogs());
    }
}