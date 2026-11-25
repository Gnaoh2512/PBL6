package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.common.StaffScope;
import com.example.pbl6.dto.equipment.EquipmentRequest;
import com.example.pbl6.dto.equipment.EquipmentResponse;
import com.example.pbl6.service.EquipmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import com.example.pbl6.security.Roles;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/equipment")
@RequiredArgsConstructor
@PreAuthorize(Roles.EQUIPMENT_VIEW)
public class AdminEquipmentController {

    private static final Set<String> VALID_STATUSES = Set.of("WORKING", "BROKEN", "UNDER_REPAIR", "RETIRED");

    private final EquipmentService equipmentService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EquipmentResponse>>> getAllEquipment(
            @RequestParam(required = false) Integer roomId,
            @RequestParam(required = false) String status
    ) {
        List<EquipmentResponse> list = equipmentService.getAllEquipment(roomId, status);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    // Creating equipment: asset register is owned by manager / admin
    @PostMapping
    @PreAuthorize(Roles.ADMIN_MANAGER)
    public ResponseEntity<ApiResponse<EquipmentResponse>> createEquipment(@Valid @RequestBody EquipmentRequest request) {
        EquipmentResponse response = equipmentService.createEquipment(request);
        return ResponseEntity.ok(ApiResponse.ok("Thêm thiết bị mới thành công", response));
    }

    // Editing equipment details: manager / admin / maintenance (receptionist is read + status only)
    @PutMapping("/{id}")
    @PreAuthorize(Roles.MAINTENANCE_DESK)
    public ResponseEntity<ApiResponse<EquipmentResponse>> updateEquipment(
            @PathVariable Integer id,
            @Valid @RequestBody EquipmentRequest request,
            Authentication authentication
    ) {
        if (isRetire(request.getStatus()) && !canRetire(authentication)) {
            return ResponseEntity.status(403).body(ApiResponse.error("Chỉ quản lý hoặc quản trị viên mới được thanh lý thiết bị"));
        }
        EquipmentResponse response = equipmentService.updateEquipment(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật thiết bị thành công", response));
    }

    // The admin UI calls PATCH /api/admin/equipment/{id}/status?status=BROKEN
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<EquipmentResponse>> updateEquipmentStatus(
            @PathVariable Integer id,
            @RequestParam String status,
            Authentication authentication
    ) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (isRetire(normalized) && !canRetire(authentication)) {
            return ResponseEntity.status(403).body(ApiResponse.error("Chỉ quản lý hoặc quản trị viên mới được thanh lý thiết bị"));
        }
        if (!VALID_STATUSES.contains(normalized)) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Trạng thái không hợp lệ: " + status));
        }
        EquipmentResponse current = equipmentService.getEquipmentById(id);
        EquipmentRequest request = EquipmentRequest.builder()
                .roomId(current.getRoomId())
                .equipmentName(current.getEquipmentName())
                .serialNumber(current.getSerialNumber())
                .status(normalized)
                .note(current.getNote())
                .build();
        EquipmentResponse updated = equipmentService.updateEquipment(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật trạng thái thiết bị thành công", updated));
    }

    private static boolean isRetire(String status) {
        return status != null && "RETIRED".equalsIgnoreCase(status.trim());
    }

    private static boolean canRetire(Authentication authentication) {
        return StaffScope.hasRole(authentication, "ADMIN") || StaffScope.hasRole(authentication, "MANAGER");
    }
}
