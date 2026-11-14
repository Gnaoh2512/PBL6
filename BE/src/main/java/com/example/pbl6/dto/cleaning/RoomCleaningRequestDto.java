package com.example.pbl6.dto.cleaning;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomCleaningRequestDto {

    @NotNull(message = "Mã phòng (roomId) không được để trống")
    private Integer roomId;

    private Integer bookingId;

    private Integer assignedToId;

    @Builder.Default
    private String priority = "MEDIUM"; // LOW | MEDIUM | HIGH | URGENT

    private String status; // PENDING | IN_PROGRESS | COMPLETED | CANCELED

    private String note;
}
