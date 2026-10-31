package com.example.pbl6.dto.schedule;

import com.example.pbl6.dto.shift.ShiftResponse;
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
public class WorkScheduleResponse {
    private Integer scheduleId;
    private Integer accountId;
    private String accountFullName;
    private String fullName;
    private String accountUsername;
    private String username;
    private String role;
    private String roleCode;
    private String roleName;

    private ShiftResponse shift;
    private Integer shiftId;
    private String shiftName;
    private LocalTime startTime;
    private LocalTime endTime;

    private LocalDate workDate;
    private String notes;

    public static WorkScheduleResponse fromEntity(WorkSchedule ws) {
        if (ws == null) return null;
        Account acc = ws.getAccount();
        Shift s = ws.getShift();

        String empFullName = acc != null ? acc.getFullName() : null;
        String empUsername = acc != null ? acc.getUsername() : null;
        String roleStr = (acc != null && acc.getRole() != null) ? acc.getRole().getRoleCode() : null;
        String roleNameStr = (acc != null && acc.getRole() != null) ? acc.getRole().getRoleName() : null;

        return WorkScheduleResponse.builder()
                .scheduleId(ws.getScheduleId())
                .accountId(acc != null ? acc.getAccountId() : null)
                .accountFullName(empFullName)
                .fullName(empFullName)
                .accountUsername(empUsername)
                .username(empUsername)
                .role(roleStr)
                .roleCode(roleStr)
                .roleName(roleNameStr)
                .shift(ShiftResponse.fromEntity(s))
                .shiftId(s != null ? s.getShiftId() : null)
                .shiftName(s != null ? s.getShiftName() : null)
                .startTime(s != null ? s.getStartTime() : null)
                .endTime(s != null ? s.getEndTime() : null)
                .workDate(ws.getWorkDate())
                .notes(ws.getNotes())
                .build();
    }
}