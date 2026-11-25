package com.example.pbl6.common;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

/**
 * Decides whether the caller is a "field" staff member (service / housekeeping / maintenance)
 * who may only see and act on tasks that belong to them.
 * Supervisory roles (ADMIN, MANAGER, RECEPTIONIST) keep the full view.
 */
public final class StaffScope {

    private StaffScope() {
    }

    public static boolean isOwnTasksOnly(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        boolean fieldRole = false;
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            String role = authority.getAuthority();
            if (role == null) {
                continue;
            }
            if (role.startsWith("ROLE_")) {
                role = role.substring(5);
            }
            switch (role) {
                case "ADMIN", "MANAGER", "RECEPTIONIST" -> {
                    return false;
                }
                case "SERVICE_STAFF", "HOUSEKEEPING", "MAINTENANCE" -> fieldRole = true;
                default -> {
                }
            }
        }
        return fieldRole;
    }

    public static boolean hasRole(Authentication authentication, String role) {
        if (authentication == null) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            String value = authority.getAuthority();
            if (("ROLE_" + role).equals(value) || role.equals(value)) {
                return true;
            }
        }
        return false;
    }
}
