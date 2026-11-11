package com.example.pbl6.repository;

import com.example.pbl6.entity.CustomerLoyalty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomerLoyaltyRepository extends JpaRepository<CustomerLoyalty, Integer> {
    Optional<CustomerLoyalty> findByCustomer_CustomerId(Integer customerId);
    Optional<CustomerLoyalty> findByCustomer_Account_AccountId(Integer accountId);
}
