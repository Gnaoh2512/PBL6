package com.example.pbl6.dto.schedule;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

/**
 * Copies every schedule in [sourceStart, sourceEnd] so that sourceStart lands on targetStart,
 * e.g. sourceStart=Mon 3 Nov, sourceEnd=Sun 9 Nov, targetStart=Mon 10 Nov copies a week forward.
 */
@Data
public class CopyScheduleRequest {
    @NotNull(message = "Source start date is required")
    private LocalDate sourceStart;

    @NotNull(message = "Source end date is required")
    private LocalDate sourceEnd;

    @NotNull(message = "Target start date is required")
    private LocalDate targetStart;

    /** false: skip days that already have a schedule. true: replace the shift on those days. */
    private boolean overwrite;
}
