package com.example.pbl6.repository;

import com.example.pbl6.entity.WorkSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface WorkScheduleRepository extends JpaRepository<WorkSchedule, Integer> {

    @Query("""
            select ws from WorkSchedule ws
              join fetch ws.account a
              left join fetch a.role r
              join fetch ws.shift s
            where ws.workDate = :workDate
            order by s.startTime asc, a.fullName asc
            """)
    List<WorkSchedule> findByWorkDate(@Param("workDate") LocalDate workDate);

    List<WorkSchedule> findByAccount_AccountId(Integer accountId);

    /** List (not Optional) on purpose: databases built by ddl-auto may lack the unique constraint. */
    List<WorkSchedule> findByAccount_AccountIdAndWorkDate(Integer accountId, LocalDate workDate);

    List<WorkSchedule> findByAccount_AccountIdInAndWorkDateBetween(Collection<Integer> accountIds,
                                                                   LocalDate from, LocalDate to);

    boolean existsByShift_ShiftId(Integer shiftId);

    long countByShift_ShiftId(Integer shiftId);

    /** Calendar query: all filters except the date range are optional (pass null to ignore). */
    @Query("""
            select ws from WorkSchedule ws
              join fetch ws.account a
              left join fetch a.role r
              join fetch ws.shift s
            where ws.workDate between :from and :to
              and (:accountId is null or a.accountId = :accountId)
              and (:shiftId is null or s.shiftId = :shiftId)
              and (:roleCode is null or r.roleCode = :roleCode)
            order by ws.workDate asc, s.startTime asc, a.fullName asc
            """)
    List<WorkSchedule> search(@Param("from") LocalDate from,
                              @Param("to") LocalDate to,
                              @Param("accountId") Integer accountId,
                              @Param("shiftId") Integer shiftId,
                              @Param("roleCode") String roleCode);
}
