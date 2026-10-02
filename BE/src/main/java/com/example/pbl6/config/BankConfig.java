package com.example.pbl6.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "hotel.bank")
public class BankConfig {
    /**
     * Mã định danh ngân hàng (MB, VCB, ICB, TCB, VPB, ACB...)
     */
    private String bankId = "MB";

    /**
     * Số tài khoản ngân hàng nhận tiền cọc của khách sạn
     */
    private String accountNo = "090123456789";

    /**
     * Tên chủ tài khoản nhận tiền
     */
    private String accountName = "KHACH SAN PBL6";

    /**
     * Giao diện mẫu VietQR (compact2, compact, qr_only)
     */
    private String template = "compact2";

    /**
     * Tỉ lệ tiền cọc yêu cầu (%)
     */
    private int depositPercentage = 30;

    /**
     * Thời gian giữ chỗ chờ cọc (phút)
     */
    private int paymentTimeoutMinutes = 15;

    /**
     * API Key xác thực Webhook từ SePay (nếu có cấu hình bảo mật)
     */
    private String sepayApiKey = "";
}
