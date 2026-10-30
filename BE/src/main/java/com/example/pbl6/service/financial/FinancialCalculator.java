package com.example.pbl6.service.financial;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Component
public class FinancialCalculator {

    public static final int DEFAULT_DEPOSIT_PERCENTAGE = 30;
    public static final BigDecimal TAX_RATE_10_PERCENT = BigDecimal.valueOf(0.10);

    /**
     * Tính số đêm giữa 2 ngày (tối thiểu 1 đêm)
     */
    public long calculateNights(LocalDate checkInDate, LocalDate checkOutDate) {
        if (checkInDate == null || checkOutDate == null) {
            return 1;
        }
        long nights = ChronoUnit.DAYS.between(checkInDate, checkOutDate);
        return Math.max(nights, 1);
    }

    /**
     * Tính tổng tiền phòng dựa theo đơn giá theo đêm và số đêm
     */
    public BigDecimal calculateTotalRoomCharge(BigDecimal pricePerNight, long nights) {
        if (pricePerNight == null || nights <= 0) {
            return BigDecimal.ZERO;
        }
        return pricePerNight.multiply(BigDecimal.valueOf(nights)).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Tính số tiền cọc yêu cầu theo phần trăm (mặc định 30%)
     */
    public BigDecimal calculateDeposit(BigDecimal totalAmount, int depositPercentage) {
        if (totalAmount == null || totalAmount.compareTo(BigDecimal.ZERO) <= 0 || depositPercentage <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal percentage = BigDecimal.valueOf(depositPercentage).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        return totalAmount.multiply(percentage).setScale(0, RoundingMode.HALF_UP);
    }

    /**
     * Tính tiền thuế VAT 10%
     */
    public BigDecimal calculateTax(BigDecimal subtotal) {
        if (subtotal == null || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return subtotal.multiply(TAX_RATE_10_PERCENT).setScale(0, RoundingMode.HALF_UP);
    }

    /**
     * Tính tổng hóa đơn cuối cùng: Subtotal + Tax - Discount - DepositApplied
     */
    public BigDecimal calculateFinalTotal(BigDecimal subtotal, BigDecimal tax, BigDecimal discount, BigDecimal depositApplied) {
        BigDecimal total = subtotal != null ? subtotal : BigDecimal.ZERO;
        if (tax != null) total = total.add(tax);
        if (discount != null) total = total.subtract(discount);
        if (depositApplied != null) total = total.subtract(depositApplied);
        return total.compareTo(BigDecimal.ZERO) > 0 ? total : BigDecimal.ZERO;
    }

    /**
     * Tính tỷ lệ hoàn cọc khi hủy phòng theo chính sách khách sạn:
     * - Trước >= 3 ngày: hoàn 100%
     * - Trước 1 - 2 ngày: hoàn 50%
     * - Hủy trong ngày check-in hoặc sát giờ: phạt 100% (hoàn 0%)
     */
    public int calculateRefundPercentage(LocalDate checkInDate, LocalDate cancelDate) {
        if (checkInDate == null || cancelDate == null) {
            return 0;
        }
        long daysBefore = ChronoUnit.DAYS.between(cancelDate, checkInDate);
        if (daysBefore >= 3) {
            return 100;
        } else if (daysBefore >= 1) {
            return 50;
        } else {
            return 0;
        }
    }

    /**
     * Tính toán số tiền được giảm theo Voucher ưu đãi
     */
    public BigDecimal calculateVoucherDiscount(com.example.pbl6.entity.Voucher voucher, BigDecimal subtotal) {
        if (voucher == null || subtotal == null || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        if (voucher.getMinOrderAmount() != null && subtotal.compareTo(voucher.getMinOrderAmount()) < 0) {
            return BigDecimal.ZERO;
        }

        BigDecimal discount = BigDecimal.ZERO;
        if ("PERCENTAGE".equalsIgnoreCase(voucher.getDiscountType())) {
            BigDecimal percentage = voucher.getDiscountValue() != null ? voucher.getDiscountValue() : BigDecimal.ZERO;
            discount = subtotal.multiply(percentage).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

            if (voucher.getMaxDiscountAmount() != null && discount.compareTo(voucher.getMaxDiscountAmount()) > 0) {
                discount = voucher.getMaxDiscountAmount();
            }
        } else if ("FIXED_AMOUNT".equalsIgnoreCase(voucher.getDiscountType())) {
            discount = voucher.getDiscountValue() != null ? voucher.getDiscountValue() : BigDecimal.ZERO;
        }

        return discount.compareTo(subtotal) > 0 ? subtotal : discount.setScale(0, RoundingMode.HALF_UP);
    }
}
