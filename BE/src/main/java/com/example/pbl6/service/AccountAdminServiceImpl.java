package com.example.pbl6.service;

import com.example.pbl6.dto.adminaccount.AccountCreateRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;
import com.example.pbl6.entity.Role;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.AuditLogRepository;
import com.example.pbl6.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountAdminServiceImpl implements AccountAdminService {

    private final AccountRepository accountRepository;
    private final RoleRepository roleRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public List<Account> getAllAccounts() {
        return accountRepository.findAll();
    }

    @Override
    @Transactional
    public Account createAccount(AccountCreateRequest request) {
        if (accountRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists: " + request.getUsername());
        }
        if (request.getEmail() != null && !request.getEmail().isBlank() && accountRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists: " + request.getEmail());
        }

        String roleCode = request.getRole() != null ? request.getRole().trim().toUpperCase() : "ROLE_RECEPTIONIST";
        if (!roleCode.startsWith("ROLE_")) {
            roleCode = "ROLE_" + roleCode;
        }
        Role role = roleRepository.findByRoleCode(roleCode)
                .orElseGet(() -> roleRepository.findByRoleCode("ROLE_RECEPTIONIST").orElse(null));

        Account account = Account.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .role(role)
                .status(request.getStatus() != null ? request.getStatus() : "ACTIVE")
                .build();

        return accountRepository.save(account);
    }

    @Override
    public List<AuditLog> getAuditLogs() {
        return auditLogRepository.findAll();
    }
}