package com.example.pbl6.dto.cashier;

import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.CashierShift;
import com.example.pbl6.entity.WorkSchedule;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashierShiftResponse {
    private Integer cashierShiftId;
    private Integer accountId;
    private String accountFullName;
    private String accountRole;
    private Integer scheduleId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private BigDecimal openingCash;
    private BigDecimal closingCashActual;
    private String status;
    private Integer receivedById;
    private String receivedByFullName;
    private String handoverNote;

    // Chỉ số tài chính & thống kê giao dịch đồng bộ
    @Builder.Default
    private BigDecimal totalRevenue = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal totalCashRevenue = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal totalBankRevenue = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal totalCardRevenue = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal totalRefund = BigDecimal.ZERO;
    @Builder.Default
    private BigDecimal totalFund = BigDecimal.ZERO;
    @Builder.Default
    private Integer transactionCount = 0;

    @Builder.Default
    private List<CashierTransactionResponse> transactions = new ArrayList<>();

    @JsonProperty("cashierName")
    public String getCashierName() {
        return accountFullName;
    }

    @JsonProperty("notes")
    public String getNotes() {
        return handoverNote;
    }

    public static CashierShiftResponse fromEntity(CashierShift cs) {
        if (cs == null) return null;
        Account acc = cs.getAccount();
        WorkSchedule ws = cs.getWorkSchedule();
        Account rec = cs.getReceivedBy();

        BigDecimal openCash = cs.getOpeningCash() != null ? cs.getOpeningCash() : BigDecimal.ZERO;

        return CashierShiftResponse.builder()
                .cashierShiftId(cs.getCashierShiftId())
                .accountId(acc != null ? acc.getAccountId() : null)
                .accountFullName(acc != null ? acc.getFullName() : null)
                .accountRole(acc != null && acc.getRole() != null ? acc.getRole().getRoleName() : null)
                .scheduleId(ws != null ? ws.getScheduleId() : null)
                .startTime(cs.getStartTime())
                .endTime(cs.getEndTime())
                .openingCash(openCash)
                .closingCashActual(cs.getClosingCashActual())
                .status(cs.getStatus())
                .receivedById(rec != null ? rec.getAccountId() : null)
                .receivedByFullName(rec != null ? rec.getFullName() : null)
                .handoverNote(cs.getHandoverNote())
                .totalFund(openCash)
                .totalRevenue(BigDecimal.ZERO)
                .totalCashRevenue(BigDecimal.ZERO)
                .totalBankRevenue(BigDecimal.ZERO)
                .totalCardRevenue(BigDecimal.ZERO)
                .totalRefund(BigDecimal.ZERO)
                .transactionCount(0)
                .transactions(new ArrayList<>())
                .build();
    }
}
