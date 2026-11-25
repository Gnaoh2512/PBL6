package com.example.pbl6.repository;

import com.example.pbl6.entity.BenefitRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BenefitRedemptionRepository extends JpaRepository<BenefitRedemption, Integer> {
    Optional<BenefitRedemption> findFirstByServiceRequest_ServiceRequestId(Integer serviceRequestId);

    List<BenefitRedemption> findByServiceRequest_ServiceRequestIdIn(Collection<Integer> serviceRequestIds);

    List<BenefitRedemption> findByBooking_BookingIdAndServiceRequestIsNotNull(Integer bookingId);

    Optional<BenefitRedemption> findFirstByCustomer_CustomerIdAndIdempotencyKey(Integer customerId, String idempotencyKey);

    long countByCustomer_CustomerIdAndTierBenefit_TierBenefitIdAndStatusAndRedeemedAtGreaterThanEqual(
            Integer customerId, Integer tierBenefitId, String status, LocalDateTime from);
}
