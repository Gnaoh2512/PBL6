package com.example.pbl6.dto.schedule;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** Assign one shift to several staff over a date range, optionally only on some weekdays. */
@Data
public class BulkScheduleRequest {
    @NotEmpty(message = "At least one account is required")
    private List<Integer> accountIds;

    @NotNull(message = "Shift ID is required")
    private Integer shiftId;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "End date is required")
    private LocalDate endDate;

    /** MONDAY..SUNDAY. Null or empty means every day in the range. */
    private Set<DayOfWeek> daysOfWeek;

    private String notes;

    /** false: skip days that already have a schedule. true: replace the shift on those days. */
    private boolean overwrite;
}
