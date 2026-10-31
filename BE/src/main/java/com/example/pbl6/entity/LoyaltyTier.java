package com.example.pbl6.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "loyalty_tier")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoyaltyTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tier_id")
    private Integer tierId;

    @Column(name = "tier_code", unique = true, nullable = false, length = 50)
    private String tierCode;

    @Column(name = "tier_name", nullable = false, length = 100)
    private String tierName;

    @Column(name = "tier_level", unique = true, nullable = false)
    private Integer tierLevel;

    @Builder.Default
    @Column(name = "min_score", precision = 10, scale = 2, nullable = false)
    private BigDecimal minScore = BigDecimal.ZERO;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
}
