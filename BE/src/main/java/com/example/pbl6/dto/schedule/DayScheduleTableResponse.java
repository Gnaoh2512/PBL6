package com.example.pbl6.dto.schedule;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

/**
 * Detailed summary & shift table for a single calendar date when clicking on a day in the calendar.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DayScheduleTableResponse {
    private LocalDate workDate;
    private DayOfWeek dayOfWeek;
    private int totalSchedules;
    private int scheduledCount;
    private int completedCount;
    private int absentCount;
    private int offCount;

    /** All shift assignments on this date, ordered by shift start time then staff full name. */
    private List<WorkScheduleResponse> schedules;
}
