package com.example.pbl6.dto.adminroom;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RoomRequest {
    @NotBlank(message = "Room number is required")
    @Size(max = 20, message = "Room number must not exceed 20 characters")
    private String roomNumber;

    @NotNull(message = "Room type ID is required")
    private Integer roomTypeId;

    private Integer floor;

    @Size(max = 50, message = "Status must not exceed 50 characters")
    private String status;

    private String note;
}