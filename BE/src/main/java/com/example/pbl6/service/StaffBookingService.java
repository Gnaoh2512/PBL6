package com.example.pbl6.service;

import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.booking.WalkInBookingRequest;

public interface StaffBookingService {

    /**
     * Lễ tân tạo đơn đặt phòng trực tiếp tại quầy cho khách vãng lai
     */
    BookingDetailResponse createWalkInBooking(WalkInBookingRequest request, String staffUsername);

    /**
     * Xác nhận duyệt tiền cọc thủ công cho đơn đặt phòng
     */
    BookingDetailResponse confirmDepositManual(String bookingCode, String staffUsername);

    /**
     * Hủy đơn đặt phòng bởi nhân viên
     */
    void cancelBooking(String bookingCode, String cancelReason, String staffUsername);
}
