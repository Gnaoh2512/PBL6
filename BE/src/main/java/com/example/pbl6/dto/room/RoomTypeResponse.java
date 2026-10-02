package com.example.pbl6.dto.room;

import com.example.pbl6.entity.RoomType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomTypeResponse {
    private Integer roomTypeId;
    private String typeName;
    private Integer capacity;
    private BigDecimal basePrice;
    private String amenities;
    private String description;

    public static RoomTypeResponse fromEntity(RoomType roomType) {
        if (roomType == null) return null;
        return RoomTypeResponse.builder()
                .roomTypeId(roomType.getRoomTypeId())
                .typeName(roomType.getTypeName())
                .capacity(roomType.getCapacity())
                .basePrice(roomType.getBasePrice())
                .amenities(roomType.getAmenities())
                .description(roomType.getDescription())
                .build();
    }
}
