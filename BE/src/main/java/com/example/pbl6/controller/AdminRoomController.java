package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.adminroom.RoomRequest;
import com.example.pbl6.dto.adminroom.RoomTypeRequest;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.RoomType;
import com.example.pbl6.service.RoomAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
public class AdminRoomController {

    private final RoomAdminService roomAdminService;

    @PostMapping("/room-types")
    public ApiResponse<RoomType> createRoomType(@Valid @RequestBody RoomTypeRequest request) {
        return ApiResponse.ok("Room type created successfully", roomAdminService.createRoomType(request));
    }

    @PutMapping("/room-types/{id}")
    public ApiResponse<RoomType> updateRoomType(@PathVariable Integer id, @Valid @RequestBody RoomTypeRequest request) {
        return ApiResponse.ok("Room type updated successfully", roomAdminService.updateRoomType(id, request));
    }

    @PostMapping("/rooms")
    public ApiResponse<Room> createRoom(@Valid @RequestBody RoomRequest request) {
        return ApiResponse.ok("Room created successfully", roomAdminService.createRoom(request));
    }

    @PutMapping("/rooms/{id}")
    public ApiResponse<Room> updateRoom(@PathVariable Integer id, @Valid @RequestBody RoomRequest request) {
        return ApiResponse.ok("Room updated successfully", roomAdminService.updateRoom(id, request));
    }

    @PatchMapping("/rooms/{id}/status")
    public ApiResponse<Room> updateRoomStatus(@PathVariable Integer id, @RequestParam String status) {
        return ApiResponse.ok("Room status updated successfully", roomAdminService.updateRoomStatus(id, status));
    }
}