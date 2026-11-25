package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.adminaccount.AccountAdminResponse;
import com.example.pbl6.dto.adminaccount.AccountCreateRequest;
import com.example.pbl6.dto.adminaccount.AccountUpdateRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;
import com.example.pbl6.service.AccountAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.example.pbl6.security.Roles;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminAccountController {

    private final AccountAdminService accountAdminService;

    @GetMapping("/accounts")
    @PreAuthorize(Roles.ADMIN_MANAGER)
    public ApiResponse<List<AccountAdminResponse>> getAllAccounts() {
        return ApiResponse.ok(accountAdminService.getAllAccounts().stream().map(AccountAdminResponse::fromEntity).toList());
    }

    @PostMapping("/accounts")
    @PreAuthorize(Roles.ADMIN_ONLY)
    public ApiResponse<AccountAdminResponse> createAccount(@Valid @RequestBody AccountCreateRequest request) {
        return ApiResponse.ok("Account created successfully", AccountAdminResponse.fromEntity(accountAdminService.createAccount(request)));
    }

    @PutMapping("/accounts/{accountId}")
    @PreAuthorize(Roles.ADMIN_ONLY)
    public ApiResponse<AccountAdminResponse> updateAccount(@PathVariable Integer accountId,
                                              @Valid @RequestBody AccountUpdateRequest request,
                                              Authentication authentication) {
        return ApiResponse.ok("Account updated successfully",
                AccountAdminResponse.fromEntity(accountAdminService.updateAccount(accountId, request, authentication.getName())));
    }

    @DeleteMapping("/accounts/{accountId}")
    @PreAuthorize(Roles.ADMIN_ONLY)
    public ApiResponse<AccountAdminResponse> deactivateAccount(@PathVariable Integer accountId, Authentication authentication) {
        return ApiResponse.ok("Account deactivated successfully",
                AccountAdminResponse.fromEntity(accountAdminService.deactivateAccount(accountId, authentication.getName())));
    }

    @GetMapping("/audit-logs")
    @PreAuthorize(Roles.ADMIN_MANAGER)
    public ApiResponse<List<AuditLog>> getAuditLogs() {
        return ApiResponse.ok(accountAdminService.getAuditLogs());
    }

}
