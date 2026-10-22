package com.example.pbl6.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "tier_benefit")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TierBenefit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tier_benefit_id")
    private Integer tierBenefitId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tier_id", nullable = false)
    private LoyaltyTier tier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private com.example.pbl6.entity.Service service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_type_id")
    private RoomType roomType;

    @Column(name = "benefit_type", nullable = false, length = 50)
    private String benefitType; // ROOM_DISCOUNT | FREE_SERVICE | FREE_NIGHT

    @Column(name = "benefit_name", nullable = false, length = 150)
    private String benefitName;

    @Column(name = "discount_percent", precision = 5, scale = 2)
    private BigDecimal discountPercent;

    @Column(name = "quota")
    private Integer quota;

    @Column(name = "period_type", length = 50)
    private String periodType; // MONTH | YEAR

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
}
