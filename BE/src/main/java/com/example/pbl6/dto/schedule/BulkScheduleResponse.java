package com.example.pbl6.dto.schedule;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkScheduleResponse {
    private int createdCount;
    private int updatedCount;
    private int skippedCount;

    /** Schedules that were created or updated, ordered by date. */
    private List<WorkScheduleResponse> schedules;

    /** Entries that were not applied, with the reason. */
    private List<SkippedItem> skipped;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkippedItem {
        private Integer accountId;
        private String accountFullName;
        private LocalDate workDate;
        private String reason;
    }
}
