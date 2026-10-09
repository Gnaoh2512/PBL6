package com.example.pbl6.service;

import com.example.pbl6.dto.booking.BookingCreateRequest;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.booking.PaymentStatusResponse;
import com.example.pbl6.dto.booking.SePayWebhookPayload;

import java.util.List;

public interface CustomerBookingService {

    /**
     * Tạo đơn đặt phòng mới và sinh mã VietQR chuyển khoản cọc
     */
    BookingDetailResponse createBooking(BookingCreateRequest request, String currentUsername);

    /**
     * Xem thông tin chi tiết đơn đặt phòng bằng mã booking
     */
    BookingDetailResponse getBookingByCode(String bookingCode);

    /**
     * Kiểm tra trạng thái nộp cọc theo thời gian thực (Polling)
     */
    PaymentStatusResponse getPaymentStatus(String bookingCode);

    /**
     * Nhân viên Lễ tân / Thu ngân bấm duyệt cọc bằng tay
     */
    BookingDetailResponse confirmDepositManual(String bookingCode, String staffUsername);

    /**
     * Tiếp nhận và xử lý Webhook tự động từ cổng SePay khi có tiền về
     */
    boolean processSePayWebhook(SePayWebhookPayload payload, String apiKeyHeader);

    /**
     * Giả lập nộp cọc thành công (tiện ích cho dev / kiểm thử demo)
     */
    PaymentStatusResponse simulateDeposit(String bookingCode);

    /**
     * Hủy đơn đặt phòng
     */
    void cancelBooking(String bookingCode, String cancelReason, String canceledByUsername);

    /**
     * Quét và hủy các đơn quá hạn thanh toán cọc (quá 15 phút)
     */
    int expireOverdueBookings();

    /**
     * Xem danh sách các đơn đặt phòng của khách hàng đã đăng nhập
     */
    List<BookingDetailResponse> getMyBookings(String currentUsername);
}
