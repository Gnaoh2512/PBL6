package com.example.pbl6.dto.loyalty;

import com.example.pbl6.entity.LoyaltyTransaction;
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
public class LoyaltyTransactionResponse {
    private Integer txnId;
    private String txnType; // EARN | ADJUST
    private Integer invoiceId;
    private String createdBy;
    private Integer stayDays;
    private BigDecimal amountSpent;
    private BigDecimal scoreEarned;
    private String note;
    private LocalDateTime createdAt;

    public static LoyaltyTransactionResponse fromEntity(LoyaltyTransaction entity) {
        if (entity == null) {
            return null;
        }
        return LoyaltyTransactionResponse.builder()
                .txnId(entity.getTxnId())
                .txnType(entity.getTxnType())
                .invoiceId(entity.getInvoice() != null ? entity.getInvoice().getInvoiceId() : null)
                .createdBy(entity.getCreatedBy() != null ? entity.getCreatedBy().getFullName() : "Hệ thống tự động")
                .stayDays(entity.getStayDays())
                .amountSpent(entity.getAmountSpent())
                .scoreEarned(entity.getScoreEarned())
                .note(entity.getNote())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
