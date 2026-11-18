package com.example.pbl6.security;

/**
 * Single source of truth for {@code @PreAuthorize} role expressions.
 * Own-task scoping for field staff (service / housekeeping / maintenance) lives in
 * {@link com.example.pbl6.common.StaffScope}.
 */
public final class Roles {

    private Roles() {
    }

    /** Admin or manager */
    public static final String ADMIN_MANAGER = "hasAnyRole('ADMIN', 'MANAGER')";

    /** Admin only */
    public static final String ADMIN_ONLY = "hasRole('ADMIN')";

    /** Any staff account */
    public static final String ALL_STAFF = "hasAnyRole('ADMIN', 'HOUSEKEEPING', 'MAINTENANCE', 'MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF')";

    /** Guest-facing endpoints (customer) plus admin */
    public static final String CUSTOMER_OR_ADMIN = "hasAnyRole('ADMIN', 'CUSTOMER')";

    /** Equipment register: supervisors + maintenance */
    public static final String EQUIPMENT_VIEW = "hasAnyRole('ADMIN', 'MAINTENANCE', 'MANAGER', 'RECEPTIONIST')";

    /** Room cleaning: housekeeping + supervisors */
    public static final String HOUSEKEEPING_DESK = "hasAnyRole('ADMIN', 'HOUSEKEEPING', 'MANAGER', 'RECEPTIONIST')";

    /** Completing / managing maintenance work: maintenance, manager, admin */
    public static final String MAINTENANCE_DESK = "hasAnyRole('ADMIN', 'MAINTENANCE', 'MANAGER')";

    /** Everyone except service staff: supervisors, housekeeping, maintenance (room list, maintenance requests — results scoped by StaffScope) */
    public static final String OPERATIONS_STAFF = "hasAnyRole('ADMIN', 'HOUSEKEEPING', 'MAINTENANCE', 'MANAGER', 'RECEPTIONIST')";

    /** Service requests: service staff + supervisors */
    public static final String SERVICE_DESK = "hasAnyRole('ADMIN', 'MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF')";

    /** Service staff only */
    public static final String SERVICE_STAFF_ONLY = "hasRole('SERVICE_STAFF')";

    /** Front-desk supervisors: admin, manager, receptionist */
    public static final String SUPERVISORS = "hasAnyRole('ADMIN', 'MANAGER', 'RECEPTIONIST')";
}
