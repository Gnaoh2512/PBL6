package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;
import com.example.pbl6.service.CustomerHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public/history")
@RequiredArgsConstructor
public class PublicHistoryController {

    private final CustomerHistoryService customerHistoryService;

    /**
     * Khách vãng lai tra cứu danh sách lịch sử đặt phòng qua Số điện thoại (không cần tài khoản)
     */
    @GetMapping("/lookup")
    public ResponseEntity<ApiResponse<List<CustomerBookingHistorySummaryResponse>>> lookupPublicHistory(
            @RequestParam String phone,
            @RequestParam(required = false) String status
    ) {
        List<CustomerBookingHistorySummaryResponse> history = customerHistoryService.lookupPublicHistoryByPhone(phone, status);
        return ResponseEntity.ok(ApiResponse.ok("Tra cứu lịch sử đặt phòng thành công", history));
    }

    /**
     * Khách vãng lai tra cứu chi tiết 1 đơn đặt phòng bằng Mã đơn và Số điện thoại (bảo mật dữ liệu)
     */
    @GetMapping("/lookup/{bookingCode}")
    public ResponseEntity<ApiResponse<CustomerBookingHistoryDetailResponse>> lookupPublicBookingDetail(
            @PathVariable String bookingCode,
            @RequestParam String phone
    ) {
        CustomerBookingHistoryDetailResponse detail = customerHistoryService.lookupPublicBookingDetail(bookingCode, phone);
        return ResponseEntity.ok(ApiResponse.ok("Tra cứu chi tiết đơn lưu trú thành công", detail));
    }
}
