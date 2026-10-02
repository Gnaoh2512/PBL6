package com.example.pbl6.dto.booking;

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
public class BankTransferQrResponse {
    private String qrImageUrl;
    private String bankId;
    private String accountNo;
    private String accountName;
    private BigDecimal amount;
    private String transferContent;
    private int timeoutMinutes;
    private LocalDateTime expiredAt;
}
