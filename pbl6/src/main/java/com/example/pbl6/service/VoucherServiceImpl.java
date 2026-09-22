package com.example.pbl6.service;

import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.voucher.VoucherApplyRequest;
import com.example.pbl6.dto.voucher.VoucherApplyResponse;
import com.example.pbl6.dto.voucher.VoucherCreateRequest;
import com.example.pbl6.dto.voucher.VoucherResponse;
import com.example.pbl6.entity.Voucher;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.VoucherRepository;
import com.example.pbl6.service.financial.FinancialCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VoucherServiceImpl implements VoucherService {

    private final VoucherRepository voucherRepository;
    private final FinancialCalculator financialCalculator;
    private final BankConfig bankConfig;

    @Override
    @Transactional(readOnly = true)
    public List<VoucherResponse> getActiveVouchers() {
        LocalDate today = LocalDate.now();
        return voucherRepository.findByIsActiveTrue().stream()
                .filter(v -> (v.getStartDate() == null || !today.isBefore(v.getStartDate())) &&
                             (v.getEndDate() == null || !today.isAfter(v.getEndDate())) &&
                             (v.getUsageLimit() == null || v.getUsedCount() < v.getUsageLimit()))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<VoucherResponse> getAllVouchers() {
        return voucherRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public VoucherApplyResponse previewVoucher(VoucherApplyRequest request) {
        String code = request.getCode() != null ? request.getCode().trim().toUpperCase() : "";
        BigDecimal orderAmount = request.getOrderAmount() != null ? request.getOrderAmount() : BigDecimal.ZERO;

        Optional<Voucher> optVoucher = voucherRepository.findByCodeIgnoreCase(code);
        if (optVoucher.isEmpty()) {
            return VoucherApplyResponse.builder()
                    .isValid(false)
                    .code(code)
                    .originalAmount(orderAmount)
                    .discountAmount(BigDecimal.ZERO)
                    .finalAmount(orderAmount)
                    .newDepositRequired(financialCalculator.calculateDeposit(orderAmount, bankConfig.getDepositPercentage()))
                    .message("Mã voucher không tồn tại trên hệ thống")
                    .build();
        }

        Voucher voucher = optVoucher.get();
        String validationError = checkVoucherValidity(voucher, orderAmount);
        if (validationError != null) {
            return VoucherApplyResponse.builder()
                    .isValid(false)
                    .code(code)
                    .voucherName(voucher.getVoucherName())
                    .originalAmount(orderAmount)
                    .discountAmount(BigDecimal.ZERO)
                    .finalAmount(orderAmount)
                    .newDepositRequired(financialCalculator.calculateDeposit(orderAmount, bankConfig.getDepositPercentage()))
                    .message(validationError)
                    .build();
        }

        BigDecimal discountAmount = financialCalculator.calculateVoucherDiscount(voucher, orderAmount);
        BigDecimal finalAmount = orderAmount.subtract(discountAmount);
        if (finalAmount.compareTo(BigDecimal.ZERO) < 0) {
            finalAmount = BigDecimal.ZERO;
        }
        BigDecimal newDepositRequired = financialCalculator.calculateDeposit(finalAmount, bankConfig.getDepositPercentage());

        return VoucherApplyResponse.builder()
                .isValid(true)
                .code(voucher.getCode())
                .voucherName(voucher.getVoucherName())
                .originalAmount(orderAmount)
                .discountAmount(discountAmount)
                .finalAmount(finalAmount)
                .newDepositRequired(newDepositRequired)
                .message("Áp dụng mã ưu đãi thành công! Bạn được giảm " + discountAmount.longValue() + "đ.")
                .build();
    }

    @Override
    @Transactional
    public Voucher validateAndUseVoucher(String code, BigDecimal orderAmount) {
        if (!StringUtils.hasText(code)) {
            return null;
        }

        String cleanCode = code.trim().toUpperCase();
        Voucher voucher = voucherRepository.findByCodeIgnoreCase(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Mã voucher không hợp lệ: " + cleanCode));

        String error = checkVoucherValidity(voucher, orderAmount);
        if (error != null) {
            throw new IllegalArgumentException(error);
        }

        voucher.setUsedCount(voucher.getUsedCount() + 1);
        return voucherRepository.save(voucher);
    }

    @Override
    @Transactional
    public VoucherResponse createVoucher(VoucherCreateRequest request) {
        String code = request.getCode().trim().toUpperCase();
        if (voucherRepository.existsByCodeIgnoreCase(code)) {
            throw new IllegalArgumentException("Mã voucher '" + code + "' đã tồn tại");
        }

        Voucher voucher = Voucher.builder()
                .code(code)
                .voucherName(request.getVoucherName())
                .discountType(request.getDiscountType().toUpperCase())
                .discountValue(request.getDiscountValue())
                .maxDiscountAmount(request.getMaxDiscountAmount())
                .minOrderAmount(request.getMinOrderAmount())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .usageLimit(request.getUsageLimit())
                .usedCount(0)
                .isActive(true)
                .build();

        Voucher saved = voucherRepository.save(voucher);
        log.info("Đã tạo mới voucher khuyến mãi: {}", saved.getCode());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public VoucherResponse toggleVoucher(Integer voucherId) {
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy voucher với ID: " + voucherId));

        voucher.setIsActive(!Boolean.TRUE.equals(voucher.getIsActive()));
        Voucher updated = voucherRepository.save(voucher);
        log.info("Voucher {} đổi trạng thái sang: {}", voucher.getCode(), updated.getIsActive() ? "ACTIVE" : "INACTIVE");
        return mapToResponse(updated);
    }

    private String checkVoucherValidity(Voucher voucher, BigDecimal orderAmount) {
        if (!Boolean.TRUE.equals(voucher.getIsActive())) {
            return "Mã voucher này hiện đang tạm ngưng sử dụng";
        }
        LocalDate today = LocalDate.now();
        if (voucher.getStartDate() != null && today.isBefore(voucher.getStartDate())) {
            return "Chương trình ưu đãi này chưa bắt đầu (hiệu lực từ " + voucher.getStartDate() + ")";
        }
        if (voucher.getEndDate() != null && today.isAfter(voucher.getEndDate())) {
            return "Mã voucher đã hết hạn sử dụng (hết hạn ngày " + voucher.getEndDate() + ")";
        }
        if (voucher.getUsageLimit() != null && voucher.getUsedCount() >= voucher.getUsageLimit()) {
            return "Mã voucher đã hết số lượt sử dụng";
        }
        if (voucher.getMinOrderAmount() != null && orderAmount.compareTo(voucher.getMinOrderAmount()) < 0) {
            return "Đơn đặt phòng tối thiểu phải từ " + voucher.getMinOrderAmount().longValue() + "đ để áp dụng voucher này";
        }
        return null;
    }

    private VoucherResponse mapToResponse(Voucher v) {
        return VoucherResponse.builder()
                .voucherId(v.getVoucherId())
                .code(v.getCode())
                .voucherName(v.getVoucherName())
                .discountType(v.getDiscountType())
                .discountValue(v.getDiscountValue())
                .maxDiscountAmount(v.getMaxDiscountAmount())
                .minOrderAmount(v.getMinOrderAmount())
                .startDate(v.getStartDate())
                .endDate(v.getEndDate())
                .usageLimit(v.getUsageLimit())
                .usedCount(v.getUsedCount())
                .isActive(v.getIsActive())
                .build();
    }
}
