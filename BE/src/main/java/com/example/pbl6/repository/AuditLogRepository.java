package com.example.pbl6.repository;

import com.example.pbl6.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByTargetTableAndTargetId(String targetTable, Long targetId);
    List<AuditLog> findByAccount_AccountId(Integer accountId);
}
