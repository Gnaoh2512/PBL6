package com.example.pbl6.service;

import com.example.pbl6.dto.adminaccount.AccountCreateRequest;
import com.example.pbl6.dto.adminaccount.AccountUpdateRequest;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;
import com.example.pbl6.entity.Role;
import com.example.pbl6.repository.AccountRepository;
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
    private final AuditLogService auditLogService;
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

        Account saved = accountRepository.save(account);

        auditLogService.log("QUẢN TRỊ TÀI KHOẢN", "CREATE", "account", Long.valueOf(saved.getAccountId()),
                "Tạo tài khoản mới: " + saved.getUsername() + " (Họ tên: " + saved.getFullName() + ", Vai trò: " + (role != null ? role.getRoleName() : roleCode) + ")");

        return saved;
    }

    @Override
    @Transactional
    public Account updateAccount(Integer accountId, AccountUpdateRequest request, String currentUsername) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", accountId));
        boolean isSelf = account.getUsername().equalsIgnoreCase(currentUsername);

        String email = request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail().trim() : null;
        if (email != null && !email.equalsIgnoreCase(account.getEmail()) && accountRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already exists: " + email);
        }

        if (request.getRole() != null && !request.getRole().isBlank()) {
            String roleCode = request.getRole().trim().toUpperCase();
            if (!roleCode.startsWith("ROLE_")) {
                roleCode = "ROLE_" + roleCode;
            }
            Role role = roleRepository.findByRoleCode(roleCode)
                    .orElseThrow(() -> new IllegalArgumentException("Role not found: " + request.getRole()));
            if (isSelf && account.getRole() != null && !account.getRole().getRoleCode().equals(role.getRoleCode())) {
                throw new IllegalArgumentException("Không thể tự đổi vai trò của chính mình");
            }
            account.setRole(role);
        }

        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            String status = request.getStatus().trim().toUpperCase();
            if (isSelf && !"ACTIVE".equals(status)) {
                throw new IllegalArgumentException("Không thể khóa/vô hiệu hóa tài khoản của chính mình");
            }
            account.setStatus(status);
        }

        account.setFullName(request.getFullName().trim());
        account.setEmail(email);
        account.setPhone(request.getPhone() != null && !request.getPhone().isBlank() ? request.getPhone().trim() : null);
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        Account saved = accountRepository.save(account);
        auditLogService.log("QUẢN TRỊ TÀI KHOẢN", "UPDATE", "account", Long.valueOf(saved.getAccountId()),
                "Cập nhật tài khoản: " + saved.getUsername() + " (Họ tên: " + saved.getFullName()
                        + ", Vai trò: " + (saved.getRole() != null ? saved.getRole().getRoleCode() : "—")
                        + ", Trạng thái: " + saved.getStatus() + ")");
        return saved;
    }

    /** Soft delete: accounts are referenced by audit logs, schedules, shifts and bookings, so we deactivate instead. */
    @Override
    @Transactional
    public Account deactivateAccount(Integer accountId, String currentUsername) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", accountId));
        if (account.getUsername().equalsIgnoreCase(currentUsername)) {
            throw new IllegalArgumentException("Không thể vô hiệu hóa tài khoản của chính mình");
        }
        account.setStatus("INACTIVE");
        Account saved = accountRepository.save(account);
        auditLogService.log("QUẢN TRỊ TÀI KHOẢN", "DEACTIVATE", "account", Long.valueOf(saved.getAccountId()),
                "Vô hiệu hóa tài khoản: " + saved.getUsername());
        return saved;
    }

    @Override
    public List<AuditLog> getAuditLogs() {
        return auditLogService.getAllAuditLogs();
    }
}
