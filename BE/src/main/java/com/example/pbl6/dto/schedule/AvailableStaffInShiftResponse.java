package com.example.pbl6.dto.schedule;

import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Shift;
import com.example.pbl6.entity.WorkSchedule;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvailableStaffInShiftResponse {
    private Integer accountId;
    private String username;
    private String fullName;
    private String phone;
    private String email;
    private String roleCode;
    private String roleName;
    private Integer scheduleId;
    private LocalDate workDate;
    private String scheduleStatus;
    private Integer shiftId;
    private String shiftName;
    private LocalTime shiftStartTime;
    private LocalTime shiftEndTime;

    public static AvailableStaffInShiftResponse fromWorkSchedule(WorkSchedule ws) {
        if (ws == null || ws.getAccount() == null) {
            return null;
        }
        Account a = ws.getAccount();
        Shift s = ws.getShift();
        return AvailableStaffInShiftResponse.builder()
                .accountId(a.getAccountId())
                .username(a.getUsername())
                .fullName(a.getFullName())
                .phone(a.getPhone())
                .email(a.getEmail())
                .roleCode(a.getRole() != null ? a.getRole().getRoleCode() : null)
                .roleName(a.getRole() != null ? a.getRole().getRoleName() : null)
                .scheduleId(ws.getScheduleId())
                .workDate(ws.getWorkDate())
                .scheduleStatus(ws.getStatus() != null ? ws.getStatus() : "SCHEDULED")
                .shiftId(s != null ? s.getShiftId() : null)
                .shiftName(s != null ? s.getShiftName() : null)
                .shiftStartTime(s != null ? s.getStartTime() : null)
                .shiftEndTime(s != null ? s.getEndTime() : null)
                .build();
    }
}
