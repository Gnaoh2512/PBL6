package com.example.pbl6.dto.cashier;

import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.CashierShift;
import com.example.pbl6.entity.WorkSchedule;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashierShiftResponse {
    private Integer cashierShiftId;
    private Integer accountId;
    private String accountFullName;
    private Integer scheduleId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private BigDecimal openingCash;
    private BigDecimal closingCashActual;
    private String status;
    private Integer receivedById;
    private String receivedByFullName;
    private String handoverNote;

    public static CashierShiftResponse fromEntity(CashierShift cs) {
        if (cs == null) return null;
        Account acc = cs.getAccount();
        WorkSchedule ws = cs.getWorkSchedule();
        Account rec = cs.getReceivedBy();

        return CashierShiftResponse.builder()
                .cashierShiftId(cs.getCashierShiftId())
                .accountId(acc != null ? acc.getAccountId() : null)
                .accountFullName(acc != null ? acc.getFullName() : null)
                .scheduleId(ws != null ? ws.getScheduleId() : null)
                .startTime(cs.getStartTime())
                .endTime(cs.getEndTime())
                .openingCash(cs.getOpeningCash())
                .closingCashActual(cs.getClosingCashActual())
                .status(cs.getStatus())
                .receivedById(rec != null ? rec.getAccountId() : null)
                .receivedByFullName(rec != null ? rec.getFullName() : null)
                .handoverNote(cs.getHandoverNote())
                .build();
    }
}