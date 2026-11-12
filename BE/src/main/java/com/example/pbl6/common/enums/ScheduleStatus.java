package com.example.pbl6.common.enums;

import java.util.Locale;

public enum ScheduleStatus {
    SCHEDULED,
    COMPLETED,
    ABSENT,
    OFF;

    /** Null or blank means SCHEDULED (rows created before the status column existed). */
    public static ScheduleStatus parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return SCHEDULED;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "Invalid schedule status '" + raw + "'. Allowed values: SCHEDULED, COMPLETED, ABSENT, OFF");
        }
    }

    /** Attendance records (completed / absent) must not be overwritten by bulk operations. */
    public boolean isAttendanceRecord() {
        return this == COMPLETED || this == ABSENT;
    }
}
