package com.example.pbl6.dto.schedule;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class WorkScheduleRequest {
    @NotNull(message = "Account ID is required")
    private Integer accountId;

    @NotNull(message = "Shift ID is required")
    private Integer shiftId;

    @NotNull(message = "Work date is required")
    private LocalDate workDate;
}