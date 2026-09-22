package com.example.pbl6.dto.auth;

import com.example.pbl6.entity.Account;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountResponse {
    private Integer accountId;
    private String username;
    private String fullName;
    private String email;
    private String phone;
    private String role;
    private String status;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;

    public static AccountResponse fromEntity(Account account) {
        if (account == null) {
            return null;
        }
        return AccountResponse.builder()
                .accountId(account.getAccountId())
                .username(account.getUsername())
                .fullName(account.getFullName())
                .email(account.getEmail())
                .phone(account.getPhone())
                .role(account.getRole())
                .status(account.getStatus())
                .lastLogin(account.getLastLogin())
                .createdAt(account.getCreatedAt())
                .build();
    }
}
