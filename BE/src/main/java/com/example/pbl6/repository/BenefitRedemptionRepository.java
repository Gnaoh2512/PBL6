package com.example.pbl6.repository;

import com.example.pbl6.entity.BenefitRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BenefitRedemptionRepository extends JpaRepository<BenefitRedemption, Integer> {
    List<BenefitRedemption> findByCustomer_CustomerId(Integer customerId);
    List<BenefitRedemption> findByBooking_BookingId(Integer bookingId);
    long countByCustomer_CustomerIdAndTierBenefit_TierBenefitIdAndRedeemedAtAfter(
            Integer customerId, Integer tierBenefitId, LocalDateTime after);
}
