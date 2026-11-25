package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.adminroom.RoomRequest;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.entity.Room;
import com.example.pbl6.service.RoomAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.example.pbl6.security.Roles;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminRoomController {

    private final RoomAdminService roomAdminService;

    @GetMapping("/rooms")
    @PreAuthorize(Roles.OPERATIONS_STAFF)
    public ApiResponse<java.util.List<Room>> getAllRooms() {
        return ApiResponse.ok(roomAdminService.getAllRooms());
    }

    @GetMapping("/rooms/{roomId}/bookings")
    @PreAuthorize(Roles.SUPERVISORS)
    public ApiResponse<java.util.List<BookingDetailResponse>> getRoomBookings(@PathVariable Integer roomId) {
        return ApiResponse.ok(roomAdminService.getRoomBookings(roomId));
    }

    @PostMapping("/rooms")
    @PreAuthorize(Roles.ADMIN_MANAGER)
    public ApiResponse<Room> createRoom(@Valid @RequestBody RoomRequest request) {
        return ApiResponse.ok("Room created successfully", roomAdminService.createRoom(request));
    }

    @PutMapping("/rooms/{id}")
    @PreAuthorize(Roles.ADMIN_MANAGER)
    public ApiResponse<Room> updateRoom(@PathVariable Integer id, @Valid @RequestBody RoomRequest request) {
        return ApiResponse.ok("Room updated successfully", roomAdminService.updateRoom(id, request));
    }

    @PatchMapping("/rooms/{id}/status")
    @PreAuthorize(Roles.SUPERVISORS)
    public ApiResponse<Room> updateRoomStatus(@PathVariable Integer id, @RequestParam String status) {
        return ApiResponse.ok("Room status updated successfully", roomAdminService.updateRoomStatus(id, status));
    }
}
