package com.example.pbl6.repository;

import com.example.pbl6.entity.TierBenefit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TierBenefitRepository extends JpaRepository<TierBenefit, Integer> {
    List<TierBenefit> findByTier_TierIdAndIsActiveTrue(Integer tierId);
    List<TierBenefit> findByTier_TierLevelLessThanEqualAndIsActiveTrue(Integer tierLevel);
}
