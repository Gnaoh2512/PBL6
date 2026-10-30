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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Account createdBy;

    @Column(name = "voucher_code", unique = true, nullable = false, length = 50)
    private String voucherCode;

    @Column(name = "voucher_name", nullable = false, length = 150)
    private String voucherName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "discount_type", nullable = false, length = 50)
    private String discountType;

    @Column(name = "discount_value", precision = 15, scale = 2, nullable = false)
    private BigDecimal discountValue;

    @Column(name = "max_discount_amount", precision = 15, scale = 2)
    private BigDecimal maxDiscountAmount;

    @Column(name = "min_order_amount", precision = 15, scale = 2)
    private BigDecimal minOrderAmount;

    @Column(name = "valid_from")
    private LocalDateTime validFrom;

    @Column(name = "valid_to")
    private LocalDateTime validTo;

    @Column(name = "usage_limit")
    private Integer usageLimit;

    @Column(name = "usage_limit_per_customer")
    private Integer usageLimitPerCustomer;

    @Transient
    @Builder.Default
    private Integer usedCount = 0;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // Helper methods for backward compatibility — @Transient prevents Hibernate from treating 'code' as a separate DB column
    @Transient
    public String getCode() {
        return voucherCode;
    }

    @Transient
    public void setCode(String code) {
        this.voucherCode = code;
    }

    @Transient
    public LocalDate getStartDate() {
        return validFrom != null ? validFrom.toLocalDate() : null;
    }

    @Transient
    public void setStartDate(LocalDate startDate) {
        this.validFrom = startDate != null ? startDate.atStartOfDay() : null;
    }

    @Transient
    public LocalDate getEndDate() {
        return validTo != null ? validTo.toLocalDate() : null;
    }

    @Transient
    public void setEndDate(LocalDate endDate) {
        this.validTo = endDate != null ? endDate.atTime(23, 59, 59) : null;
    }

    public static class VoucherBuilder {
        public VoucherBuilder code(String code) {
            this.voucherCode = code;
            return this;
        }

        public VoucherBuilder startDate(LocalDate startDate) {
            this.validFrom = startDate != null ? startDate.atStartOfDay() : null;
            return this;
        }

        public VoucherBuilder endDate(LocalDate endDate) {
            this.validTo = endDate != null ? endDate.atTime(23, 59, 59) : null;
            return this;
        }
    }
}
