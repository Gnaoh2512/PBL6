package com.example.pbl6.service;

import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.voucher.VoucherApplyRequest;
import com.example.pbl6.dto.voucher.VoucherApplyResponse;
import com.example.pbl6.dto.voucher.VoucherCreateRequest;
import com.example.pbl6.dto.voucher.VoucherResponse;
import com.example.pbl6.entity.Voucher;
import com.example.pbl6.repository.VoucherRepository;
import com.example.pbl6.service.financial.FinancialCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VoucherServiceTest {

    @Mock
    private VoucherRepository voucherRepository;

    @Mock
    private BankConfig bankConfig;

    @Spy
    private FinancialCalculator financialCalculator = new FinancialCalculator();

    @InjectMocks
    private VoucherServiceImpl voucherService;

    private Voucher mockVoucherPercent;
    private Voucher mockVoucherFixed;

    @BeforeEach
    void setUp() {
        mockVoucherPercent = Voucher.builder()
                .voucherId(1)
                .code("SUMMER2026")
                .voucherName("Giảm 10% tối đa 100k")
                .discountType("PERCENTAGE")
                .discountValue(BigDecimal.valueOf(10))
                .maxDiscountAmount(BigDecimal.valueOf(100000))
                .minOrderAmount(BigDecimal.valueOf(500000))
                .startDate(LocalDate.now().minusDays(5))
                .endDate(LocalDate.now().plusDays(30))
                .usageLimit(100)
                .usedCount(5)
                .isActive(true)
                .build();

        mockVoucherFixed = Voucher.builder()
                .voucherId(2)
                .code("WELCOME50K")
                .voucherName("Giảm 50k")
                .discountType("FIXED_AMOUNT")
                .discountValue(BigDecimal.valueOf(50000))
                .minOrderAmount(BigDecimal.valueOf(200000))
                .startDate(LocalDate.now().minusDays(5))
                .endDate(LocalDate.now().plusDays(30))
                .usageLimit(200)
                .usedCount(0)
                .isActive(true)
                .build();
    }

    @Test
    @DisplayName("Thành công: Lấy danh sách voucher đang có hiệu lực")
    void testGetActiveVouchers() {
        when(voucherRepository.findByIsActiveTrue()).thenReturn(List.of(mockVoucherPercent, mockVoucherFixed));

        List<VoucherResponse> active = voucherService.getActiveVouchers();

        assertThat(active).hasSize(2);
        assertThat(active.get(0).getCode()).isEqualTo("SUMMER2026");
    }

    @Test
    @DisplayName("Thành công: Xem trước voucher giảm theo % có trần tối đa")
    void testPreviewVoucher_ValidPercentage() {
        when(voucherRepository.findByCodeIgnoreCase("SUMMER2026")).thenReturn(Optional.of(mockVoucherPercent));
        when(bankConfig.getDepositPercentage()).thenReturn(30);

        // Đơn 2,000,000đ -> 10% là 200,000đ nhưng bị chặn maxDiscount 100,000đ -> giảm 100,000đ
        VoucherApplyRequest request = VoucherApplyRequest.builder()
                .code("SUMMER2026")
                .orderAmount(BigDecimal.valueOf(2000000))
                .build();

        VoucherApplyResponse response = voucherService.previewVoucher(request);

        assertThat(response.isValid()).isTrue();
        assertThat(response.getDiscountAmount()).isEqualByComparingTo(BigDecimal.valueOf(100000));
        assertThat(response.getFinalAmount()).isEqualByComparingTo(BigDecimal.valueOf(1900000));
        // Cọc 30% của 1,900,000 = 570,000đ
        assertThat(response.getNewDepositRequired()).isEqualByComparingTo(BigDecimal.valueOf(570000));
    }

    @Test
    @DisplayName("Thành công: Xem trước voucher giảm tiền mặt cố định")
    void testPreviewVoucher_ValidFixedAmount() {
        when(voucherRepository.findByCodeIgnoreCase("WELCOME50K")).thenReturn(Optional.of(mockVoucherFixed));
        when(bankConfig.getDepositPercentage()).thenReturn(30);

        VoucherApplyRequest request = VoucherApplyRequest.builder()
                .code("WELCOME50K")
                .orderAmount(BigDecimal.valueOf(500000))
                .build();

        VoucherApplyResponse response = voucherService.previewVoucher(request);

        assertThat(response.isValid()).isTrue();
        assertThat(response.getDiscountAmount()).isEqualByComparingTo(BigDecimal.valueOf(50000));
        assertThat(response.getFinalAmount()).isEqualByComparingTo(BigDecimal.valueOf(450000));
    }

    @Test
    @DisplayName("Thất bại: Giá trị đơn hàng chưa đạt mức tối thiểu của voucher")
    void testPreviewVoucher_MinOrderNotMet() {
        when(voucherRepository.findByCodeIgnoreCase("SUMMER2026")).thenReturn(Optional.of(mockVoucherPercent));
        when(bankConfig.getDepositPercentage()).thenReturn(30);

        // Đơn 300,000đ < 500,000đ minOrderAmount
        VoucherApplyRequest request = VoucherApplyRequest.builder()
                .code("SUMMER2026")
                .orderAmount(BigDecimal.valueOf(300000))
                .build();

        VoucherApplyResponse response = voucherService.previewVoucher(request);

        assertThat(response.isValid()).isFalse();
        assertThat(response.getMessage()).contains("tối thiểu phải từ 500000");
    }

    @Test
    @DisplayName("Thành công: Tạo mới voucher thành công")
    void testCreateVoucher_Success() {
        VoucherCreateRequest request = VoucherCreateRequest.builder()
                .code("VIP200K")
                .voucherName("Ưu đãi VIP")
                .discountType("FIXED_AMOUNT")
                .discountValue(BigDecimal.valueOf(200000))
                .minOrderAmount(BigDecimal.valueOf(1000000))
                .build();

        when(voucherRepository.existsByCodeIgnoreCase("VIP200K")).thenReturn(false);
        when(voucherRepository.save(any(Voucher.class))).thenAnswer(inv -> {
            Voucher v = inv.getArgument(0);
            v.setVoucherId(99);
            return v;
        });

        VoucherResponse created = voucherService.createVoucher(request);

        assertThat(created).isNotNull();
        assertThat(created.getCode()).isEqualTo("VIP200K");
        assertThat(created.getDiscountValue()).isEqualByComparingTo(BigDecimal.valueOf(200000));
    }

    @Test
    @DisplayName("Thành công: Bật/Tắt trạng thái hoạt động của voucher")
    void testToggleVoucher_Success() {
        when(voucherRepository.findById(1)).thenReturn(Optional.of(mockVoucherPercent));
        when(voucherRepository.save(any(Voucher.class))).thenAnswer(inv -> inv.getArgument(0));

        VoucherResponse toggled = voucherService.toggleVoucher(1);

        assertThat(toggled.getIsActive()).isFalse();
    }
}
