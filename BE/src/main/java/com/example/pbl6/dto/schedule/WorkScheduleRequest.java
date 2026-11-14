package com.example.pbl6.dto.schedule;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

@Data
public class WorkScheduleRequest {
    @NotNull(message = "Account ID is required")
    private Integer accountId;

    @NotNull(message = "Shift ID is required")
    private Integer shiftId;

    @NotNull(message = "Work date is required")
    private LocalDate workDate;

    private String notes;

    /** Optional: SCHEDULED (default) | COMPLETED | ABSENT | OFF */
    private String status;

    // --- Optional recurring fields if caller uses POST /api/admin/schedules with repeat options ---

    /** Optional end date if creating a recurring schedule from the single-schedule form. */
    private LocalDate endDate;

    /** Repeat for N weeks starting from workDate (e.g. 4 = 4 weeks). */
    private Integer repeatWeeks;

    /** Repeat for N months starting from workDate (e.g. 3 = 3 months). */
    private Integer repeatMonths;

    /** Generic repeat duration count (used with repeatUnit: DAY / WEEK / MONTH). */
    private Integer repeatCount;

    /** Unit for repeatCount: "DAY" ("DAYS"), "WEEK" ("WEEKS"), or "MONTH" ("MONTHS"). */
    private String repeatUnit;

    /** Step interval between recurrences (default = 1). */
    private Integer repeatInterval;

    /** MONDAY..SUNDAY when repeating. */
    private Set<DayOfWeek> daysOfWeek;

    /** Whether to overwrite existing non-attendance schedules when repeating. */
    private boolean overwrite;

    public boolean isRecurring() {
        return endDate != null
                || (repeatWeeks != null && repeatWeeks > 0)
                || (repeatMonths != null && repeatMonths > 0)
                || (repeatCount != null && repeatCount > 0);
    }
}
