package com.example.pbl6.dto.schedule;

import com.example.pbl6.entity.Account;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Minimal staff info for the "who can I schedule" dropdown. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleStaffResponse {
    private Integer accountId;
    private String fullName;
    private String username;
    private String roleCode;
    private String roleName;

    public static ScheduleStaffResponse fromEntity(Account account) {
        if (account == null) return null;
        return ScheduleStaffResponse.builder()
                .accountId(account.getAccountId())
                .fullName(account.getFullName())
                .username(account.getUsername())
                .roleCode(account.getRole() != null ? account.getRole().getRoleCode() : null)
                .roleName(account.getRole() != null ? account.getRole().getRoleName() : null)
                .build();
    }
}
