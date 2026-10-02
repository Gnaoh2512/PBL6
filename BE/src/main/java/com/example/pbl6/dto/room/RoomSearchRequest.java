package com.example.pbl6.dto.room;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomSearchRequest {

    @NotNull(message = "Ngày nhận phòng không được để trống")
    @FutureOrPresent(message = "Ngày nhận phòng phải từ ngày hiện tại trở đi")
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate checkInDate;

    @NotNull(message = "Ngày trả phòng không được để trống")
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate checkOutDate;

    private Integer roomTypeId;

    private Integer guestCount;

    private java.math.BigDecimal minPrice;

    private java.math.BigDecimal maxPrice;

    /**
     * Sắp xếp: "PRICE_ASC" (giá tăng dần - mặc định), "PRICE_DESC" (giá giảm dần)
     */
    private String sortBy;
}
