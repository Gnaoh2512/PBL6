package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.voucher.VoucherApplyRequest;
import com.example.pbl6.dto.voucher.VoucherApplyResponse;
import com.example.pbl6.dto.voucher.VoucherResponse;
import com.example.pbl6.service.VoucherService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public/vouchers")
@RequiredArgsConstructor
public class PublicVoucherController {

    private final VoucherService voucherService;

    /**
     * Khách hàng xem danh sách các voucher ưu đãi đang có hiệu lực
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<VoucherResponse>>> getActiveVouchers() {
        List<VoucherResponse> vouchers = voucherService.getActiveVouchers();
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách mã ưu đãi thành công", vouchers));
    }

    /**
     * Khách hàng áp dụng thử mã voucher để xem số tiền được giảm và tiền cọc mới
     */
    @PostMapping("/apply")
    public ResponseEntity<ApiResponse<VoucherApplyResponse>> applyVoucher(
            @Valid @RequestBody VoucherApplyRequest request
    ) {
        VoucherApplyResponse response = voucherService.previewVoucher(request);
        return ResponseEntity.ok(ApiResponse.ok(response.getMessage(), response));
    }
}
