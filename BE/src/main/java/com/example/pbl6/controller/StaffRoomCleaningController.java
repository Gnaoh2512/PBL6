package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.cleaning.RoomCleaningRequestDto;
import com.example.pbl6.dto.cleaning.RoomCleaningResponse;
import com.example.pbl6.service.RoomCleaningService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/staff/room-cleaning", "/api/v1/room-cleaning", "/api/admin/room-cleaning"})
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN', 'SERVICE_STAFF', 'MAINTENANCE')")
public class StaffRoomCleaningController {

    private final RoomCleaningService roomCleaningService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomCleaningResponse>>> getAllRequests(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Integer roomId,
            @RequestParam(required = false) Integer assignedToId
    ) {
        List<RoomCleaningResponse> list = roomCleaningService.getAllRequests(status, priority, roomId, assignedToId);
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách yêu cầu dọn phòng thành công", list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RoomCleaningResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok(roomCleaningService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RoomCleaningResponse>> createRequest(
            @Valid @RequestBody RoomCleaningRequestDto dto,
            Authentication authentication
    ) {
        String username = authentication != null ? authentication.getName() : "staff";
        RoomCleaningResponse response = roomCleaningService.createRequest(dto, username);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Tạo yêu cầu dọn phòng thành công", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RoomCleaningResponse>> updateRequest(
            @PathVariable Integer id,
            @RequestBody RoomCleaningRequestDto dto,
            Authentication authentication
    ) {
        String username = authentication != null ? authentication.getName() : "staff";
        RoomCleaningResponse response = roomCleaningService.updateRequest(id, dto, username);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật yêu cầu dọn phòng thành công", response));
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<ApiResponse<RoomCleaningResponse>> assignStaff(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer staffId,
            @RequestParam(required = false) Integer assignedToId,
            Authentication authentication
    ) {
        String username = authentication != null ? authentication.getName() : "staff";
        Integer targetStaffId = staffId != null ? staffId : assignedToId;
        RoomCleaningResponse response = roomCleaningService.assignStaff(id, targetStaffId, username);
        return ResponseEntity.ok(ApiResponse.ok("Đã phân công nhân viên dọn phòng", response));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<ApiResponse<RoomCleaningResponse>> completeCleaning(
            @PathVariable Integer id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication
    ) {
        String username = authentication != null ? authentication.getName() : "staff";
        String note = body != null ? body.get("note") : null;
        RoomCleaningResponse response = roomCleaningService.completeCleaning(id, note, username);
        return ResponseEntity.ok(ApiResponse.ok("Đã hoàn tất dọn phòng. Phòng chuyển sang trạng thái AVAILABLE!", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('RECEPTIONIST', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        String username = authentication != null ? authentication.getName() : "staff";
        roomCleaningService.deleteRequest(id, username);
        return ResponseEntity.ok(ApiResponse.ok("Đã xóa yêu cầu dọn phòng", null));
    }
}
