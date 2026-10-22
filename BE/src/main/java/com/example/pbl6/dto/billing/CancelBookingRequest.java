package com.example.pbl6.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CancelBookingRequest {

    @Builder.Default
    private String reason = "Khách hàng yêu cầu hủy phòng";

    /**
     * Phương thức xử lý hoàn cọc:
     * - CASH_REFUND: Hoàn tiền ngân hàng/tiền mặt theo bậc thang thời gian (100% / 50% / 0%).
     * - CREDIT_VOUCHER: Quy đổi tiền cọc thành Voucher lưu trú 6 tháng để sử dụng cho lần đặt phòng sau.
     * - LOYALTY_POINTS: Quy đổi tiền cọc thành Điểm thưởng Coastal Bay Club cộng trực tiếp vào tài khoản hội viên.
     */
    @Builder.Default
    private String refundOption = "CASH_REFUND"; // CASH_REFUND | CREDIT_VOUCHER | LOYALTY_POINTS
}
