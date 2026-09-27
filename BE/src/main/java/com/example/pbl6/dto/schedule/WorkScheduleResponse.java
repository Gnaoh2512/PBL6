package com.example.pbl6.dto.schedule;

import com.example.pbl6.dto.shift.ShiftResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.WorkSchedule;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkScheduleResponse {
    private Integer scheduleId;
    private Integer accountId;
    private String accountFullName;
    private String accountUsername;
    private ShiftResponse shift;
    private LocalDate workDate;

    public static WorkScheduleResponse fromEntity(WorkSchedule ws) {
        if (ws == null) return null;
        Account acc = ws.getAccount();
        return WorkScheduleResponse.builder()
                .scheduleId(ws.getScheduleId())
                .accountId(acc != null ? acc.getAccountId() : null)
                .accountFullName(acc != null ? acc.getFullName() : null)
                .accountUsername(acc != null ? acc.getUsername() : null)
                .shift(ShiftResponse.fromEntity(ws.getShift()))
                .workDate(ws.getWorkDate())
                .build();
    }
}