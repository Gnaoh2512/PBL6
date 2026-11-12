package com.example.pbl6.dto.schedule;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class WorkScheduleStatusUpdateRequest {
    /** Allowed values: SCHEDULED, COMPLETED, ABSENT, OFF */
    @NotBlank(message = "Status is required")
    private String status;

    /** Optional note update when changing status. */
    private String notes;
}
