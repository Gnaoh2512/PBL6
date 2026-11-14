package com.example.pbl6.dto.schedule;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Assign one shift to one or several staff over a date range or recurring period (N weeks / N months),
 * optionally only on specific weekdays and with step interval (every K weeks / K months).
 */
@Data
public class BulkScheduleRequest {
    /** List of staff account IDs (can also pass single accountId for convenience). */
    private List<Integer> accountIds;

    /** Optional single accountId fallback if caller sends accountId instead of accountIds. */
    private Integer accountId;

    @NotNull(message = "Shift ID is required")
    private Integer shiftId;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    /**
     * End date of the schedule range.
     * Can be omitted if repeatWeeks, repeatMonths, or repeatCount + repeatUnit are provided.
     */
    private LocalDate endDate;

    /** Repeat for N weeks starting from startDate (e.g. 4 = 4 weeks). */
    private Integer repeatWeeks;

    /** Repeat for N months starting from startDate (e.g. 3 = 3 months). */
    private Integer repeatMonths;

    /** Generic repeat duration count (used with repeatUnit: DAY / WEEK / MONTH). */
    private Integer repeatCount;

    /** Unit for repeatCount: "DAY" ("DAYS"), "WEEK" ("WEEKS"), or "MONTH" ("MONTHS"). */
    private String repeatUnit;

    /**
     * Step interval between recurrences (default = 1).
     * E.g. repeatInterval = 2 with WEEK means every 2 weeks.
     */
    private Integer repeatInterval;

    /** MONDAY..SUNDAY. Null or empty means every day in the range (or the startDate's weekday when recurring). */
    private Set<DayOfWeek> daysOfWeek;

    /** Optional initial status: SCHEDULED (default) | COMPLETED | ABSENT | OFF. */
    private String status;

    private String notes;

    /** false: skip days that already have a schedule. true: replace the shift on those days. */
    private boolean overwrite;
}
