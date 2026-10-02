package com.example.pbl6.dto.shift;

import com.example.pbl6.entity.Shift;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShiftResponse {
    private Integer shiftId;
    private LocalTime startTime;
    private LocalTime endTime;

    public static ShiftResponse fromEntity(Shift shift) {
        if (shift == null) return null;
        return ShiftResponse.builder()
                .shiftId(shift.getShiftId())
                .startTime(shift.getStartTime())
                .endTime(shift.getEndTime())
                .build();
    }
}