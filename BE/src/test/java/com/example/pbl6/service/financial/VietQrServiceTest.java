package com.example.pbl6.service.financial;

import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.booking.BankTransferQrResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class VietQrServiceTest {

    private VietQrService vietQrService;
    private BankConfig bankConfig;

    @BeforeEach
    void setUp() {
        bankConfig = new BankConfig();
        bankConfig.setBankId("MB");
        bankConfig.setAccountNo("090123456789");
        bankConfig.setAccountName("KHACH SAN PBL6");
        bankConfig.setTemplate("compact2");
        bankConfig.setPaymentTimeoutMinutes(15);

        vietQrService = new VietQrService(bankConfig);
    }

    @Test
    void generateDepositQr_ReturnsValidQrPayload() {
        String bookingCode = "BK-20261001-A1B2";
        BigDecimal depositAmount = BigDecimal.valueOf(300000);

        BankTransferQrResponse qr = vietQrService.generateDepositQr(bookingCode, depositAmount);

        assertNotNull(qr);
        assertEquals("MB", qr.getBankId());
        assertEquals("090123456789", qr.getAccountNo());
        assertEquals("KHACH SAN PBL6", qr.getAccountName());
        assertEquals(depositAmount, qr.getAmount());
        assertEquals("PBL6 BK-20261001-A1B2", qr.getTransferContent());
        assertEquals(15, qr.getTimeoutMinutes());

        assertNotNull(qr.getQrImageUrl());
        assertTrue(qr.getQrImageUrl().contains("https://img.vietqr.io/image/MB-090123456789-compact2.png"));
        assertTrue(qr.getQrImageUrl().contains("amount=300000"));
        assertTrue(qr.getQrImageUrl().contains("addInfo=PBL6+BK-20261001-A1B2"));
    }
}
