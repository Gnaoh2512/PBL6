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
     * Tìm kiếm phòng trống và báo giá dự kiến (POST JSON body)
     */
    @PostMapping("/available")
    public ResponseEntity<ApiResponse<List<AvailableRoomResponse>>> searchAvailableRoomsPost(
            @Valid @RequestBody RoomSearchRequest request) {
        List<AvailableRoomResponse> rooms = roomCatalogService.findAvailableRooms(request);
        return ResponseEntity.ok(ApiResponse.ok(rooms));
    }
}
