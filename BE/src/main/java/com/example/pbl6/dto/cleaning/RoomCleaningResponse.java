package com.example.pbl6.dto.cleaning;

import com.example.pbl6.entity.RoomCleaningRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomCleaningResponse {
    private Integer cleaningId;
    private Integer roomId;
    private String roomNumber;
    private Integer floor;
    private String roomStatus;
    private Integer bookingId;
    private String bookingCode;
    private Integer requestedById;
    private String requestedByName;
    private Integer assignedToId;
    private String assignedToName;
    private String priority;
    private String status;
    private String note;
    private LocalDateTime requestedAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;

    public static RoomCleaningResponse fromEntity(RoomCleaningRequest entity) {
        if (entity == null) {
            return null;
        }
        return RoomCleaningResponse.builder()
                .cleaningId(entity.getCleaningId())
                .roomId(entity.getRoom() != null ? entity.getRoom().getRoomId() : null)
                .roomNumber(entity.getRoom() != null ? entity.getRoom().getRoomNumber() : null)
                .floor(entity.getRoom() != null ? entity.getRoom().getFloor() : null)
                .roomStatus(entity.getRoom() != null ? entity.getRoom().getStatus() : null)
                .bookingId(entity.getBooking() != null ? entity.getBooking().getBookingId() : null)
                .bookingCode(entity.getBooking() != null ? entity.getBooking().getBookingCode() : null)
                .requestedById(entity.getRequestedBy() != null ? entity.getRequestedBy().getAccountId() : null)
                .requestedByName(entity.getRequestedBy() != null ? entity.getRequestedBy().getFullName() : null)
                .assignedToId(entity.getAssignedTo() != null ? entity.getAssignedTo().getAccountId() : null)
                .assignedToName(entity.getAssignedTo() != null ? entity.getAssignedTo().getFullName() : null)
                .priority(entity.getPriority())
                .status(entity.getStatus())
                .note(entity.getNote())
                .requestedAt(entity.getRequestedAt())
                .startedAt(entity.getStartedAt())
                .completedAt(entity.getCompletedAt())
                .build();
    }
}
