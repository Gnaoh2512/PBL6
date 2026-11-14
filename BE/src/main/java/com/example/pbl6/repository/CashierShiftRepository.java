package com.example.pbl6.repository;

import com.example.pbl6.entity.CashierShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CashierShiftRepository extends JpaRepository<CashierShift, Integer> {
    List<CashierShift> findByAccount_AccountId(Integer accountId);
    List<CashierShift> findByStatus(String status);
    List<CashierShift> findByStatusOrderByStartTimeDesc(String status);
    Optional<CashierShift> findFirstByStatusOrderByStartTimeDesc(String status);
    boolean existsByWorkSchedule_ScheduleId(Integer scheduleId);

    /**
     * Lấy ca thu ngân chung đang mở (OPEN) trong ngày hoặc thuộc lịch trực của ngày đó,
     * không lọc cứng theo account_id để cả Lễ tân (Receptionist) và Admin/Manager đều truy cập chung được.
     */
    @Query("""
            SELECT cs FROM CashierShift cs
            LEFT JOIN FETCH cs.account a
            LEFT JOIN FETCH cs.workSchedule ws
            LEFT JOIN FETCH ws.shift s
            WHERE UPPER(cs.status) = 'OPEN'
              AND (
                   (cs.startTime >= :startOfDay AND cs.startTime <= :endOfDay)
                   OR (ws IS NOT NULL AND ws.workDate = :workDate)
              )
            ORDER BY cs.startTime DESC
            """)
    List<CashierShift> findOpenShiftsForDate(@Param("workDate") LocalDate workDate,
                                             @Param("startOfDay") LocalDateTime startOfDay,
                                             @Param("endOfDay") LocalDateTime endOfDay);
}
