package com.example.pbl6.service;

import com.example.pbl6.dto.billing.CancellationRefundResponse;
import com.example.pbl6.dto.billing.LiveFolioResponse;
import com.example.pbl6.dto.billing.SettlementRequest;
import com.example.pbl6.dto.service.ServiceOrderRequest;
import com.example.pbl6.dto.service.ServiceResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;

import java.math.BigDecimal;
import java.util.List;

public interface CustomerBillingService {

    /**
     * Lấy danh mục dịch vụ đang hoạt động của khách sạn (F&B, Giặt là, Spa...)
     */
    List<ServiceResponse> getActiveServices(Integer categoryId);

    /**
     * Gọi dịch vụ phòng trong thời gian lưu trú
     */
    ServiceUsageResponse orderInStayService(ServiceOrderRequest request, String username);

    /**
     * Lấy danh sách dịch vụ đã sử dụng theo mã đơn đặt phòng
     */
    List<ServiceUsageResponse> getServicesUsed(String bookingCode);

    /**
     * Lấy chi tiết Hóa đơn trực tiếp theo thời gian thực (Live Folio)
     * Tiền phòng + Dịch vụ + 10% VAT - Tiền cọc đã nộp = Số tiền còn lại + Mã VietQR tất toán
     */
    LiveFolioResponse getLiveFolio(String bookingCode);

    /**
     * Thực hiện Check-in cho khách (Đổi phòng sang OCCUPIED, đơn sang CHECKED_IN)
     */
    void checkInGuest(String bookingCode, String staffUsername);

    /**
     * Tất toán hóa đơn và Checkout (CASH hoặc BANK_TRANSFER)
     */
    LiveFolioResponse settleCheckout(String bookingCode, SettlementRequest request, String cashierUsername);

    /**
     * Xử lý webhook thanh toán tất toán từ SePay/Ngân hàng
     */
    boolean processSettlementWebhook(String bookingCode, BigDecimal amount, String referenceCode);

    /**
     * Hủy đặt phòng theo chính sách hoàn cọc
     */
    CancellationRefundResponse cancelWithRefundPolicy(String bookingCode, String reason, String username);
}
