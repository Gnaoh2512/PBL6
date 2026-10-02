package com.example.pbl6.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "voucher")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Voucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "voucher_id")
    private Integer voucherId;

    @Column(name = "code", unique = true, nullable = false, length = 50)
    private String code;

    @Column(name = "voucher_name", nullable = false, length = 150)
    private String voucherName;

    /**
     * Loại giảm giá: PERCENTAGE (% giá trị đơn) hoặc FIXED_AMOUNT (tiền cố định)
     */
    @Column(name = "discount_type", nullable = false, length = 20)
    private String discountType;

    /**
     * Giá trị giảm: 10 (nếu 10%) hoặc 50000 (nếu 50,000đ)
     */
    @Column(name = "discount_value", precision = 15, scale = 2, nullable = false)
    private BigDecimal discountValue;

    /**
     * Mức giảm tối đa (áp dụng cho PERCENTAGE, ví dụ giảm 20% nhưng tối đa 300,000đ)
     */
    @Column(name = "max_discount_amount", precision = 15, scale = 2)
    private BigDecimal maxDiscountAmount;

    /**
     * Giá trị đơn hàng tối thiểu để được áp dụng voucher
     */
    @Column(name = "min_order_amount", precision = 15, scale = 2)
    private BigDecimal minOrderAmount;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    /**
     * Tổng số lượt dùng tối đa cho phép
     */
    @Column(name = "usage_limit")
    private Integer usageLimit;

    /**
     * Số lượt đã sử dụng
     */
    @Builder.Default
    @Column(name = "used_count")
    private Integer usedCount = 0;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
