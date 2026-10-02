package com.example.pbl6.service.financial;

import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.booking.BankTransferQrResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class VietQrService {

    private final BankConfig bankConfig;

    /**
     * Tạo mã VietQR động chuẩn Napas cho đơn đặt phòng
     * Cú pháp chuyển khoản: PBL6 <BOOKING_CODE> (ví dụ: PBL6 BK20261001-A1B2)
     */
    public BankTransferQrResponse generateDepositQr(String bookingCode, BigDecimal depositAmount) {
        String cleanBookingCode = bookingCode != null ? bookingCode.trim().toUpperCase() : "";
        String transferContent = "PBL6 " + cleanBookingCode;

        String encodedContent = URLEncoder.encode(transferContent, StandardCharsets.UTF_8);
        String encodedAccountName = URLEncoder.encode(bankConfig.getAccountName(), StandardCharsets.UTF_8);

        long amountInt = depositAmount != null ? depositAmount.longValue() : 0L;

        String qrImageUrl = String.format(
                "https://img.vietqr.io/image/%s-%s-%s.png?amount=%d&addInfo=%s&accountName=%s",
                bankConfig.getBankId(),
                bankConfig.getAccountNo(),
                bankConfig.getTemplate(),
                amountInt,
                encodedContent,
                encodedAccountName
        );

        LocalDateTime expiredAt = LocalDateTime.now().plusMinutes(bankConfig.getPaymentTimeoutMinutes());

        return BankTransferQrResponse.builder()
                .qrImageUrl(qrImageUrl)
                .bankId(bankConfig.getBankId())
                .accountNo(bankConfig.getAccountNo())
                .accountName(bankConfig.getAccountName())
                .amount(depositAmount)
                .transferContent(transferContent)
                .timeoutMinutes(bankConfig.getPaymentTimeoutMinutes())
                .expiredAt(expiredAt)
                .build();
    }

    /**
     * Tạo mã VietQR thanh toán quyết toán hóa đơn khi trả phòng
     * Cú pháp chuyển khoản: PBL6 SETTLE <BOOKING_CODE> (ví dụ: PBL6 SETTLE BK20261001-A1B2)
     */
    public BankTransferQrResponse generateSettlementQr(String bookingCode, BigDecimal remainingAmount) {
        String cleanBookingCode = bookingCode != null ? bookingCode.trim().toUpperCase() : "";
        String transferContent = "PBL6 SETTLE " + cleanBookingCode;

        String encodedContent = URLEncoder.encode(transferContent, StandardCharsets.UTF_8);
        String encodedAccountName = URLEncoder.encode(bankConfig.getAccountName(), StandardCharsets.UTF_8);

        long amountInt = remainingAmount != null ? remainingAmount.longValue() : 0L;

        String qrImageUrl = String.format(
                "https://img.vietqr.io/image/%s-%s-%s.png?amount=%d&addInfo=%s&accountName=%s",
                bankConfig.getBankId(),
                bankConfig.getAccountNo(),
                bankConfig.getTemplate(),
                amountInt,
                encodedContent,
                encodedAccountName
        );

        return BankTransferQrResponse.builder()
                .qrImageUrl(qrImageUrl)
                .bankId(bankConfig.getBankId())
                .accountNo(bankConfig.getAccountNo())
                .accountName(bankConfig.getAccountName())
                .amount(remainingAmount)
                .transferContent(transferContent)
                .timeoutMinutes(60)
                .expiredAt(LocalDateTime.now().plusMinutes(60))
                .build();
    }
}
