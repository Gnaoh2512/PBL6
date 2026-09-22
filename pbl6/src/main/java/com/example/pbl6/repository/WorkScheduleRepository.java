package com.example.pbl6.repository;

import com.example.pbl6.entity.WorkSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface WorkScheduleRepository extends JpaRepository<WorkSchedule, Integer> {
    List<WorkSchedule> findByWorkDate(LocalDate workDate);
    List<WorkSchedule> findByAccount_AccountId(Integer accountId);
}
