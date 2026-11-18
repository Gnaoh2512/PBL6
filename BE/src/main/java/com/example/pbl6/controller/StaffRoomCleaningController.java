package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.common.StaffScope;
import com.example.pbl6.dto.cleaning.RoomCleaningRequestDto;
import com.example.pbl6.dto.cleaning.RoomCleaningResponse;
import com.example.pbl6.service.RoomCleaningService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import com.example.pbl6.security.Roles;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/staff/room-cleaning")
@RequiredArgsConstructor
@PreAuthorize(Roles.HOUSEKEEPING_DESK)
public class StaffRoomCleaningController {

    private final RoomCleaningService roomCleaningService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomCleaningResponse>>> getAllRequests(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Integer roomId,
            @RequestParam(required = false) Integer assignedToId,
            Authentication authentication
    ) {
        // Housekeeping only see the cleaning tasks assigned to them
        String ownUsername = StaffScope.isOwnTasksOnly(authentication) ? authentication.getName() : null;
        List<RoomCleaningResponse> list = roomCleaningService.getAllRequests(status, priority, roomId, assignedToId, ownUsername);
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách yêu cầu dọn phòng thành công", list));
    }

    @PreAuthorize(Roles.SUPERVISORS)
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

    @PreAuthorize(Roles.SUPERVISORS)
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
        RoomCleaningResponse response = roomCleaningService.completeCleaning(id, note, username, StaffScope.isOwnTasksOnly(authentication));
        return ResponseEntity.ok(ApiResponse.ok(StaffScope.isOwnTasksOnly(authentication) ? "Đã báo dọn xong, chờ lễ tân/quản lý kiểm tra phòng." : "Đã hoàn tất dọn phòng. Phòng chuyển sang trạng thái AVAILABLE!", response));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(Roles.SUPERVISORS)
    public ResponseEntity<ApiResponse<RoomCleaningResponse>> approveCleaning(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        RoomCleaningResponse response = roomCleaningService.approveCleaning(id, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Đã duyệt phòng. Phòng chuyển sang trạng thái AVAILABLE!", response));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(Roles.SUPERVISORS)
    public ResponseEntity<ApiResponse<RoomCleaningResponse>> rejectCleaning(
            @PathVariable Integer id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication
    ) {
        String reason = body != null ? body.get("reason") : null;
        RoomCleaningResponse response = roomCleaningService.rejectCleaning(id, reason, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Đã trả lại yêu cầu cho nhân viên dọn lại", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(Roles.SUPERVISORS)
    public ResponseEntity<ApiResponse<Void>> deleteRequest(
            @PathVariable Integer id,
            Authentication authentication
    ) {
        String username = authentication != null ? authentication.getName() : "staff";
        roomCleaningService.deleteRequest(id, username);
        return ResponseEntity.ok(ApiResponse.ok("Đã xóa yêu cầu dọn phòng", null));
    }
}
