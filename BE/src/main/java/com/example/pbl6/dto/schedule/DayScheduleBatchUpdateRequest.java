package com.example.pbl6.dto.schedule;

import jakarta.validation.Valid;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * Batch edit/create/delete work schedules for a single day (used when editing inside the Day Schedule Table modal).
 */
@Data
public class DayScheduleBatchUpdateRequest {
    /** Optional target date for any new entries that omit workDate. */
    private LocalDate workDate;

    /** Existing or new schedule items to update/create in that day's table. */
    @Valid
    private List<DayScheduleItemDto> items;

    /** Optional schedule IDs to delete from that day's table. */
    private List<Integer> deletedScheduleIds;

    @Data
    public static class DayScheduleItemDto {
        /** If scheduleId != null -> update existing schedule; if null -> create new schedule on workDate. */
        private Integer scheduleId;
        private Integer accountId;
        private Integer shiftId;
        private LocalDate workDate;
        /** SCHEDULED | COMPLETED | ABSENT | OFF */
        private String status;
        private String notes;
    }
}
