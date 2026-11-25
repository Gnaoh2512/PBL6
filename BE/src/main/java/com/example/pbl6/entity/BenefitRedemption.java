package com.example.pbl6.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One use of a loyalty free-service benefit. Counts against the benefit quota while
 * {@code status} is APPLIED; a cancelled service request voids it and gives the use back.
 */
@Entity
@Table(name = "benefit_redemption")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BenefitRedemption {

    public static final String STATUS_APPLIED = "APPLIED";
    public static final String STATUS_VOIDED = "VOIDED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "redemption_id")
    private Integer redemptionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tier_benefit_id", nullable = false)
    private TierBenefit tierBenefit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_request_id")
    private ServiceRequest serviceRequest;

    @Column(name = "idempotency_key", length = 64)
    private String idempotencyKey;

    @Column(name = "value_amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal valueAmount;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private String status = STATUS_APPLIED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voided_by")
    private Account voidedBy;

    @Column(name = "voided_at")
    private LocalDateTime voidedAt;

    @Column(name = "void_reason", length = 255)
    private String voidReason;

    @CreationTimestamp
    @Column(name = "redeemed_at", updatable = false)
    private LocalDateTime redeemedAt;
}
