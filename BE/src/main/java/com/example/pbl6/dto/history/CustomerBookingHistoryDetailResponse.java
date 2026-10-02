package com.example.pbl6.dto.history;

import com.example.pbl6.dto.booking.BankTransferQrResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerBookingHistoryDetailResponse {
    private String bookingCode;
    private String bookingStatus;
    private LocalDateTime createdAt;

    // Thông tin khách hàng
    private String customerName;
    private String customerPhone;
    private String customerEmail;

    // Thông tin phòng
    private String roomNumber;
    private Integer floor;
    private String roomTypeName;
    private BigDecimal pricePerNight;
    private String amenities;

    // Lịch lưu trú
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private long nights;
    private Integer guestCount;
    private String note;

    // Bóc tách tài chính & chi phí
    private BigDecimal roomCharge;
    private BigDecimal serviceCharge;
    private BigDecimal subtotal;
    private BigDecimal taxRate;
    private BigDecimal taxAmount;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;

    // Thanh toán
    private BigDecimal depositRequired;
    private BigDecimal depositPaid;
    private BigDecimal settlementPaid;
    private BigDecimal remainingBalance;

    @JsonProperty("isFullySettled")
    private boolean isFullySettled;

    // Chi tiết dịch vụ đã sử dụng trong kỳ
    @Builder.Default
    private List<ServiceUsageResponse> servicesUsed = new ArrayList<>();

    // Lịch sử các đợt giao dịch tài chính (Cọc, Tất toán, Hoàn tiền)
    @Builder.Default
    private List<PaymentHistoryResponse> paymentTransactions = new ArrayList<>();

    // Hóa đơn điện tử nếu có
    private String invoiceNumber;
    private String invoiceStatus;
    private LocalDateTime invoiceIssuedAt;

    // Thông tin hủy & hoàn tiền nếu có
    private LocalDateTime canceledAt;
    private String cancelReason;
    private BigDecimal refundAmount;

    // Mã VietQR nếu đơn còn cần thanh toán (cọc hoặc tất toán)
    private BankTransferQrResponse qrCode;
}
