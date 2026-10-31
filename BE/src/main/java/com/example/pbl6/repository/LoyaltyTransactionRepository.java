package com.example.pbl6.repository;

import com.example.pbl6.entity.LoyaltyTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, Integer> {
    List<LoyaltyTransaction> findByCustomer_CustomerIdOrderByCreatedAtDesc(Integer customerId);
}
