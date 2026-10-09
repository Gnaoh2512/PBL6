package com.example.pbl6.dto.room;

import com.example.pbl6.entity.Room;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvailableRoomResponse {
    private Integer roomId;
    private String roomNumber;
    private Integer floor;
    private String status;
    private String note;
    private RoomTypeResponse roomType;

    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private long nights;
    private BigDecimal pricePerNight;
    private BigDecimal totalRoomCharge;
    private int depositPercentage;
    private BigDecimal estimatedDeposit;

    public static AvailableRoomResponse fromEntity(
            Room room,
            LocalDate checkInDate,
            LocalDate checkOutDate,
            long nights,
            BigDecimal totalRoomCharge,
            int depositPercentage,
            BigDecimal estimatedDeposit) {
        if (room == null) return null;

        BigDecimal basePrice = room.getRoomType() != null ? room.getRoomType().getBasePrice() : BigDecimal.ZERO;

        return AvailableRoomResponse.builder()
                .roomId(room.getRoomId())
                .roomNumber(room.getRoomNumber())
                .floor(room.getFloor())
                .status(room.getStatus())
                .note(room.getNote())
                .roomType(RoomTypeResponse.fromEntity(room.getRoomType()))
                .checkInDate(checkInDate)
                .checkOutDate(checkOutDate)
                .nights(nights)
                .pricePerNight(basePrice)
                .totalRoomCharge(totalRoomCharge)
                .depositPercentage(depositPercentage)
                .estimatedDeposit(estimatedDeposit)
                .build();
    }
}