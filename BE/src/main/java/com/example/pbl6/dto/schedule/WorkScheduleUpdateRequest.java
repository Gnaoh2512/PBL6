package com.example.pbl6.dto.schedule;

import lombok.Data;

import java.time.LocalDate;

/** Every field is optional: null means "leave unchanged". Send notes as "" to clear them. */
@Data
public class WorkScheduleUpdateRequest {
    private Integer accountId;
    private Integer shiftId;
    private LocalDate workDate;
    private String status;
    private String notes;
}
