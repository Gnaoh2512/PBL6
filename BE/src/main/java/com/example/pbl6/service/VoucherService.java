package com.example.pbl6.service;

import com.example.pbl6.dto.voucher.VoucherApplyRequest;
import com.example.pbl6.dto.voucher.VoucherApplyResponse;
import com.example.pbl6.dto.voucher.VoucherCreateRequest;
import com.example.pbl6.dto.voucher.VoucherResponse;
import com.example.pbl6.entity.Voucher;

import java.math.BigDecimal;
import java.util.List;

public interface VoucherService {

    /**
     * Lấy danh sách các voucher đang có hiệu lực cho khách hàng
     */
    List<VoucherResponse> getActiveVouchers();

    /**
     * Quản trị viên lấy tất cả voucher
     */
    List<VoucherResponse> getAllVouchers();

    /**
     * Khách hàng kiểm tra và xem trước số tiền giảm của voucher
     */
    VoucherApplyResponse previewVoucher(VoucherApplyRequest request);

    /**
     * Kiểm tra tính hợp lệ và ghi nhận sử dụng voucher khi tạo đơn đặt phòng
     */
    Voucher validateAndUseVoucher(String code, BigDecimal orderAmount);

    /**
     * Tạo mới voucher khuyến mãi (Admin)
     */
    VoucherResponse createVoucher(VoucherCreateRequest request);

    /**
     * Bật / Tắt trạng thái hoạt động của voucher
     */
    VoucherResponse toggleVoucher(Integer voucherId);
}
