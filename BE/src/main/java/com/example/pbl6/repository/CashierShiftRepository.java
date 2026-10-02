package com.example.pbl6.repository;

import com.example.pbl6.entity.CashierShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CashierShiftRepository extends JpaRepository<CashierShift, Integer> {
    List<CashierShift> findByAccount_AccountId(Integer accountId);
    List<CashierShift> findByStatus(String status);
}
