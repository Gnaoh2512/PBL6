package com.example.pbl6.dto.adminaccount;

import com.example.pbl6.entity.Account;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/** Safe projection of an account for admin screens (never exposes the password hash). */
@Data
@Builder
public class AccountAdminResponse {
    private Integer accountId;
    private String username;
    private String fullName;
    private String email;
    private String phone;
    private RoleInfo role;
    private String status;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    public static class RoleInfo {
        private Integer roleId;
        private String roleCode;
        private String roleName;
    }

    public static AccountAdminResponse fromEntity(Account a) {
        if (a == null) {
            return null;
        }
        return AccountAdminResponse.builder()
                .accountId(a.getAccountId())
                .username(a.getUsername())
                .fullName(a.getFullName())
                .email(a.getEmail())
                .phone(a.getPhone())
                .role(a.getRole() == null ? null : RoleInfo.builder()
                        .roleId(a.getRole().getRoleId())
                        .roleCode(a.getRole().getRoleCode())
                        .roleName(a.getRole().getRoleName())
                        .build())
                .status(a.getStatus())
                .lastLogin(a.getLastLogin())
                .createdAt(a.getCreatedAt())
                .updatedAt(a.getUpdatedAt())
                .build();
    }
}
