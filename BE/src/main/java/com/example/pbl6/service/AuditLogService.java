package com.example.pbl6.service;

import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;

import java.util.List;

public interface AuditLogService {

    void log(String moduleName, String actionType, String targetTable, Long targetId, String details);

    void log(String moduleName, String actionType, String targetTable, Long targetId, String oldValue, String newValue);

    void log(Account performer, String moduleName, String actionType, String targetTable, Long targetId, String details);

    void log(Account performer, String moduleName, String actionType, String targetTable, Long targetId, String oldValue, String newValue);

    List<AuditLog> getAllAuditLogs();
}

