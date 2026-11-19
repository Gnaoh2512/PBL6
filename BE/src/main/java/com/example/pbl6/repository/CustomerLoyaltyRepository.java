package com.example.pbl6.repository;

import com.example.pbl6.entity.CustomerLoyalty;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomerLoyaltyRepository extends JpaRepository<CustomerLoyalty, Integer> {
    Optional<CustomerLoyalty> findByCustomer_CustomerId(Integer customerId);

    /** Row lock: serialises benefit redemptions of one customer so the quota check cannot be raced. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select cl from CustomerLoyalty cl where cl.customer.customerId = :customerId")
    Optional<CustomerLoyalty> findByCustomerIdForUpdate(@Param("customerId") Integer customerId);
}
