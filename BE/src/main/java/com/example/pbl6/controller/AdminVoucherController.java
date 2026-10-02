package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.voucher.VoucherCreateRequest;
import com.example.pbl6.dto.voucher.VoucherResponse;
import com.example.pbl6.service.VoucherService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/vouchers")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class AdminVoucherController {

    private final VoucherService voucherService;

    /**
     * Quản trị viên xem tất cả voucher (đang chạy, đã hết hạn, đã tắt)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<VoucherResponse>>> getAllVouchers() {
        List<VoucherResponse> vouchers = voucherService.getAllVouchers();
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách tất cả voucher thành công", vouchers));
    }

    /**
     * Tạo mới voucher ưu đãi
     */
    @PostMapping
    public ResponseEntity<ApiResponse<VoucherResponse>> createVoucher(
            @Valid @RequestBody VoucherCreateRequest request
    ) {
        VoucherResponse created = voucherService.createVoucher(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Tạo chương trình voucher ưu đãi thành công", created));
    }

    /**
     * Bật / Tắt trạng thái hoạt động của voucher
     */
    @PatchMapping("/{voucherId}/toggle")
    public ResponseEntity<ApiResponse<VoucherResponse>> toggleVoucher(
            @PathVariable Integer voucherId
    ) {
        VoucherResponse updated = voucherService.toggleVoucher(voucherId);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật trạng thái voucher thành công", updated));
    }
}
