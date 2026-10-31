package com.example.pbl6.repository;

import com.example.pbl6.entity.LoyaltyTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LoyaltyTierRepository extends JpaRepository<LoyaltyTier, Integer> {
    Optional<LoyaltyTier> findByTierCode(String tierCode);
    Optional<LoyaltyTier> findByTierLevel(Integer tierLevel);
}
