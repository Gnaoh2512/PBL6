package com.example.pbl6.service;

import com.example.pbl6.entity.Account;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Strict shift validation: a task can only be given to staff who are on today's schedule for the current shift.
 * Managers and admins may override (assign outside the shift) — every override is written to the audit log.
 */
@Component
@RequiredArgsConstructor
public class ShiftGuard {

    private final WorkScheduleService workScheduleService;
    private final AuditLogService auditLogService;

    public void ensureOnShift(Account staff, String roleCode, Account actor, String module, String targetTable, Integer targetId) {
        var available = workScheduleService.getAvailableStaffInShift(LocalDate.now(), LocalTime.now(), roleCode);
        boolean inShift = available.stream().anyMatch(s -> s.getAccountId().equals(staff.getAccountId()));
        if (inShift) {
            return;
        }
        if (canOverride(actor)) {
            auditLogService.log(actor, module, "SHIFT_OVERRIDE", targetTable, targetId == null ? null : Long.valueOf(targetId),
                    "Phân công ngoài ca trực: " + staff.getFullName() + " (" + staff.getUsername() + ") không có trong lịch trực hiện tại");
            return;
        }
        throw new IllegalArgumentException("Nhân viên " + staff.getFullName()
                + " hiện không có trong lịch trực ca hiện tại! Chỉ quản lý hoặc quản trị viên mới có thể phân công ngoài ca.");
    }

    public static boolean canOverride(Account actor) {
        if (actor == null || actor.getRole() == null || actor.getRole().getRoleCode() == null) {
            return false;
        }
        String code = actor.getRole().getRoleCode().toUpperCase();
        return code.equals("ROLE_ADMIN") || code.equals("ROLE_MANAGER") || code.equals("ADMIN") || code.equals("MANAGER");
    }
}
