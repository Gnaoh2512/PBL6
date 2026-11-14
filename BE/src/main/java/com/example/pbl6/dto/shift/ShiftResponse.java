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
    private String shiftName;
    private LocalTime startTime;
    private LocalTime endTime;
    private String description;

    /** True when the shift runs past midnight (end time is before start time). */
    private boolean overnight;

    public static ShiftResponse fromEntity(Shift shift) {
        if (shift == null) return null;
        boolean overnight = shift.getStartTime() != null && shift.getEndTime() != null
                && shift.getEndTime().isBefore(shift.getStartTime());
        return ShiftResponse.builder()
                .shiftId(shift.getShiftId())
                .shiftName(shift.getShiftName())
                .startTime(shift.getStartTime())
                .endTime(shift.getEndTime())
                .description(shift.getDescription())
                .overnight(overnight)
                .build();
    }
}
