package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.room.AvailableRoomResponse;
import com.example.pbl6.dto.room.RoomSearchRequest;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.service.RoomCatalogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/public/rooms")
@RequiredArgsConstructor
public class PublicRoomController {

    private final RoomCatalogService roomCatalogService;

    /**
     * Lấy danh sách tất cả các hạng phòng (Standard, Deluxe, Suite...)
     */
    @GetMapping("/room-types")
    public ResponseEntity<ApiResponse<List<RoomTypeResponse>>> getAllRoomTypes() {
        List<RoomTypeResponse> roomTypes = roomCatalogService.getAllRoomTypes();
        return ResponseEntity.ok(ApiResponse.ok(roomTypes));
    }

    /**
     * Xem thông tin chi tiết một hạng phòng theo ID
     */
    @GetMapping("/room-types/{id}")
    public ResponseEntity<ApiResponse<RoomTypeResponse>> getRoomTypeById(@PathVariable Integer id) {
        RoomTypeResponse roomType = roomCatalogService.getRoomTypeById(id);
        return ResponseEntity.ok(ApiResponse.ok(roomType));
    }

    /**
     * Tìm kiếm phòng trống và báo giá dự kiến (GET query params)
     * Ví dụ: /api/public/rooms/available?checkInDate=2026-10-01&checkOutDate=2026-10-03&guestCount=2
     */
    @GetMapping("/available")
    public ResponseEntity<ApiResponse<List<AvailableRoomResponse>>> searchAvailableRoomsGet(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkInDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOutDate,
            @RequestParam(required = false) Integer roomTypeId,
            @RequestParam(required = false) Integer guestCount,
            @RequestParam(required = false) java.math.BigDecimal minPrice,
            @RequestParam(required = false) java.math.BigDecimal maxPrice,
            @RequestParam(required = false) String sortBy) {

        RoomSearchRequest request = RoomSearchRequest.builder()
                .checkInDate(checkInDate)
                .checkOutDate(checkOutDate)
                .roomTypeId(roomTypeId)
                .guestCount(guestCount)
                .minPrice(minPrice)
                .maxPrice(maxPrice)
                .sortBy(sortBy)
                .build();

        List<AvailableRoomResponse> rooms = roomCatalogService.findAvailableRooms(request);
        return ResponseEntity.ok(ApiResponse.ok(rooms));
    }

    /**
     * Tìm kiếm phòng trống và báo giá dự kiến (POST JSON body)
     */
    @PostMapping("/available")
    public ResponseEntity<ApiResponse<List<AvailableRoomResponse>>> searchAvailableRoomsPost(
            @Valid @RequestBody RoomSearchRequest request) {
        List<AvailableRoomResponse> rooms = roomCatalogService.findAvailableRooms(request);
        return ResponseEntity.ok(ApiResponse.ok(rooms));
    }
}
