package com.example.pbl6.service;

import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;

import java.util.List;

public interface CustomerHistoryService {

    /**
     * Khách hàng có tài khoản thành viên xem danh sách lịch sử các đơn đặt phòng
     * @param username Tên đăng nhập của tài khoản khách
     * @param status Trạng thái đơn cần lọc (ALL hoặc PENDING_DEPOSIT, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELED)
     */
    List<CustomerBookingHistorySummaryResponse> getMemberHistory(String username, String status);

    /**
     * Khách hàng thành viên xem chi tiết toàn diện 1 đơn đặt phòng trong lịch sử
     */
    CustomerBookingHistoryDetailResponse getMemberBookingDetail(String username, String bookingCode);

    /**
     * Khách vãng lai tra cứu danh sách lịch sử đặt phòng qua Số điện thoại
     */
    List<CustomerBookingHistorySummaryResponse> lookupPublicHistoryByPhone(String phone, String status);

    /**
     * Khách vãng lai tra cứu chi tiết 1 đơn đặt phòng bằng Mã đơn và Số điện thoại (đối soát bảo mật)
     */
    CustomerBookingHistoryDetailResponse lookupPublicBookingDetail(String bookingCode, String phone);
}
