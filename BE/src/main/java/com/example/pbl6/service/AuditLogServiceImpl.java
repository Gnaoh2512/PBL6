package com.example.pbl6.service;

import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.AuditLogRepository;
import com.example.pbl6.security.CustomUserDetails;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogServiceImpl implements AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final AccountRepository accountRepository;

    @Override
    public void log(String moduleName, String actionType, String targetTable, Long targetId, String details) {
        log(null, moduleName, actionType, targetTable, targetId, null, details);
    }

    @Override
    public void log(String moduleName, String actionType, String targetTable, Long targetId, String oldValue, String newValue) {
        log(null, moduleName, actionType, targetTable, targetId, oldValue, newValue);
    }

    @Override
    public void log(Account performer, String moduleName, String actionType, String targetTable, Long targetId, String details) {
        log(performer, moduleName, actionType, targetTable, targetId, null, details);
    }

    @Override
    public void log(Account performer, String moduleName, String actionType, String targetTable, Long targetId, String oldValue, String newValue) {
        try {
            Account finalPerformer = performer != null ? performer : resolveCurrentAccount();
            String ip = resolveClientIp();

            AuditLog entry = AuditLog.builder()
                    .account(finalPerformer)
                    .moduleName(moduleName)
                    .actionType(actionType)
                    .targetTable(targetTable)
                    .targetId(targetId)
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .ipAddress(ip)
                    .loggedAt(LocalDateTime.now())
                    .build();

            auditLogRepository.save(entry);
            log.info("AuditLog recorded: [{}] {} on {} id={} by {}",
                    moduleName, actionType, targetTable, targetId,
                    finalPerformer != null ? finalPerformer.getUsername() : "Hệ thống");
        } catch (Exception ex) {
            log.warn("Không thể lưu AuditLog: {}", ex.getMessage());
        }
    }

    @Override
    public List<AuditLog> getAllAuditLogs() {
        return auditLogRepository.findAllByOrderByLoggedAtDesc();
    }

    private Account resolveCurrentAccount() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
                Object principal = auth.getPrincipal();
                if (principal instanceof CustomUserDetails cud && cud.getAccount() != null) {
                    return cud.getAccount();
                }
                String username = auth.getName();
                if (username != null && !username.isBlank()) {
                    return accountRepository.findByUsername(username).orElse(null);
                }
            }
        } catch (Exception ex) {
            log.debug("resolveCurrentAccount error: {}", ex.getMessage());
        }
        return null;
    }

    private String resolveClientIp() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null && attributes.getRequest() != null) {
                HttpServletRequest request = attributes.getRequest();
                String xForwardedFor = request.getHeader("X-Forwarded-For");
                if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                    return xForwardedFor.split(",")[0].trim();
                }
                String remoteAddr = request.getRemoteAddr();
                if (remoteAddr != null && !remoteAddr.isBlank()) {
                    return "0:0:0:0:0:0:0:1".equals(remoteAddr) ? "127.0.0.1" : remoteAddr;
                }
            }
        } catch (Exception ignored) {}
        return "127.0.0.1";
    }
}

