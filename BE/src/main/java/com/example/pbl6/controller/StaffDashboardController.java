package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.cleaning.RoomCleaningResponse;
import com.example.pbl6.dto.dashboard.StaffDashboardTodayResponse;
import com.example.pbl6.dto.dashboard.StaffDashboardTodayResponse.UnifiedTaskItem;
import com.example.pbl6.dto.maintenance.MaintenanceRequestResponse;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.MaintenanceRequest;
import com.example.pbl6.entity.RoomCleaningRequest;
import com.example.pbl6.entity.ServiceRequest;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.MaintenanceRequestRepository;
import com.example.pbl6.repository.RoomCleaningRequestRepository;
import com.example.pbl6.repository.ServiceRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/staff/dashboard", "/api/v1/staff/dashboard"})
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'MAINTENANCE', 'SERVICE_STAFF')")
public class StaffDashboardController {

    private final MaintenanceRequestRepository maintenanceRepository;
    private final RoomCleaningRequestRepository cleaningRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final AccountRepository accountRepository;

    /**
     * API cho Dashboard Staff Portal (Tab "Hôm nay"):
     * Lấy danh sách các công việc khẩn cấp/ưu tiên (maintenance_request, roomcleaning_request, service_request)
     * được phân công cho nhân viên trong ngày.
     */
    @GetMapping({"/today", ""})
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<StaffDashboardTodayResponse>> getTodayDashboard(
            @RequestParam(required = false) Integer accountId,
            @RequestParam(required = false, defaultValue = "false") boolean includeAllUnassigned,
            Authentication authentication
    ) {
        LocalDate today = LocalDate.now();
        Account currentAccount = null;
        if (accountId != null) {
            currentAccount = accountRepository.findById(accountId).orElse(null);
        } else if (authentication != null) {
            currentAccount = accountRepository.findByUsername(authentication.getName()).orElse(null);
        }

        final Integer targetAccountId = currentAccount != null ? currentAccount.getAccountId() : null;
        final String roleCode = (currentAccount != null && currentAccount.getRole() != null)
                ? currentAccount.getRole().getRoleCode()
                : "";
        final boolean isManagerOrAdminOrReceptionist = roleCode.contains("ADMIN")
                || roleCode.contains("MANAGER")
                || roleCode.contains("RECEPTIONIST");

        // 1. Maintenance Requests
        List<MaintenanceRequest> maintenances = maintenanceRepository.findAll().stream()
                .filter(m -> {
                    boolean isActive = !"CONFIRMED".equalsIgnoreCase(m.getStatus()) && !"CANCELED".equalsIgnoreCase(m.getStatus());
                    boolean isToday = m.getReportedAt() != null && m.getReportedAt().toLocalDate().equals(today);
                    if (!isActive && !isToday) return false;

                    if (isManagerOrAdminOrReceptionist && accountId == null) return true;
                    if (targetAccountId != null && m.getAssignedTo() != null && targetAccountId.equals(m.getAssignedTo().getAccountId())) {
                        return true;
                    }
                    return includeAllUnassigned && m.getAssignedTo() == null && roleCode.contains("MAINTENANCE");
                })
                .collect(Collectors.toList());

        // 2. Room Cleaning Requests
        List<RoomCleaningRequest> cleanings = cleaningRepository.findAll().stream()
                .filter(c -> {
                    boolean isActive = !"COMPLETED".equalsIgnoreCase(c.getStatus()) && !"CANCELED".equalsIgnoreCase(c.getStatus());
                    boolean isToday = c.getRequestedAt() != null && c.getRequestedAt().toLocalDate().equals(today);
                    if (!isActive && !isToday) return false;

                    if (isManagerOrAdminOrReceptionist && accountId == null) return true;
                    if (targetAccountId != null && c.getAssignedTo() != null && targetAccountId.equals(c.getAssignedTo().getAccountId())) {
                        return true;
                    }
                    return includeAllUnassigned && c.getAssignedTo() == null && roleCode.contains("HOUSEKEEPING");
                })
                .collect(Collectors.toList());

        // 3. Service Requests
        List<ServiceRequest> services = serviceRequestRepository.findAll().stream()
                .filter(s -> {
                    boolean isActive = !"COMPLETED".equalsIgnoreCase(s.getStatus()) && !"CANCELED".equalsIgnoreCase(s.getStatus());
                    boolean isToday = s.getRequestedAt() != null && s.getRequestedAt().toLocalDate().equals(today);
                    if (!isActive && !isToday) return false;

                    if (isManagerOrAdminOrReceptionist && accountId == null) return true;
                    if (targetAccountId != null && s.getAssignedTo() != null && targetAccountId.equals(s.getAssignedTo().getAccountId())) {
                        return true;
                    }
                    return includeAllUnassigned && s.getAssignedTo() == null && roleCode.contains("SERVICE_STAFF");
                })
                .collect(Collectors.toList());

        List<UnifiedTaskItem> unifiedTasks = new ArrayList<>();

        for (MaintenanceRequest m : maintenances) {
            unifiedTasks.add(UnifiedTaskItem.builder()
                    .taskType("MAINTENANCE")
                    .taskId(m.getRequestId())
                    .roomId(m.getRoom() != null ? m.getRoom().getRoomId() : null)
                    .roomNumber(m.getRoom() != null ? m.getRoom().getRoomNumber() : "N/A")
                    .title(m.getTitle())
                    .description(m.getDescription())
                    .priority(m.getPriority() != null ? m.getPriority() : "MEDIUM")
                    .priorityRank(priorityToRank(m.getPriority()))
                    .status(m.getStatus())
                    .assignedToId(m.getAssignedTo() != null ? m.getAssignedTo().getAccountId() : null)
                    .assignedToName(m.getAssignedTo() != null ? m.getAssignedTo().getFullName() : null)
                    .createdAt(m.getReportedAt())
                    .build());
        }

        for (RoomCleaningRequest c : cleanings) {
            unifiedTasks.add(UnifiedTaskItem.builder()
                    .taskType("ROOM_CLEANING")
                    .taskId(c.getCleaningId())
                    .roomId(c.getRoom() != null ? c.getRoom().getRoomId() : null)
                    .roomNumber(c.getRoom() != null ? c.getRoom().getRoomNumber() : "N/A")
                    .title("Dọn phòng " + (c.getRoom() != null ? c.getRoom().getRoomNumber() : ""))
                    .description(c.getNote())
                    .priority(c.getPriority() != null ? c.getPriority() : "MEDIUM")
                    .priorityRank(priorityToRank(c.getPriority()))
                    .status(c.getStatus())
                    .assignedToId(c.getAssignedTo() != null ? c.getAssignedTo().getAccountId() : null)
                    .assignedToName(c.getAssignedTo() != null ? c.getAssignedTo().getFullName() : null)
                    .createdAt(c.getRequestedAt())
                    .build());
        }

        for (ServiceRequest s : services) {
            String srvName = s.getService() != null ? s.getService().getServiceName() : "Dịch vụ phòng";
            unifiedTasks.add(UnifiedTaskItem.builder()
                    .taskType("SERVICE_REQUEST")
                    .taskId(s.getServiceRequestId())
                    .roomId(s.getRoom() != null ? s.getRoom().getRoomId() : null)
                    .roomNumber(s.getRoom() != null ? s.getRoom().getRoomNumber() : "N/A")
                    .title(srvName + " x" + (s.getQuantity() != null ? s.getQuantity() : 1))
                    .description(s.getNote())
                    .priority("HIGH")
                    .priorityRank(3)
                    .status(s.getStatus())
                    .assignedToId(s.getAssignedTo() != null ? s.getAssignedTo().getAccountId() : null)
                    .assignedToName(s.getAssignedTo() != null ? s.getAssignedTo().getFullName() : null)
                    .createdAt(s.getRequestedAt())
                    .build());
        }

        unifiedTasks.sort(Comparator.comparingInt(UnifiedTaskItem::getPriorityRank).reversed()
                .thenComparing(UnifiedTaskItem::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        StaffDashboardTodayResponse response = StaffDashboardTodayResponse.builder()
                .date(today)
                .staffAccountId(targetAccountId)
                .staffName(currentAccount != null ? currentAccount.getFullName() : null)
                .roleCode(roleCode)
                .totalUrgentOrPendingCount(unifiedTasks.size())
                .priorityTasks(unifiedTasks)
                .maintenanceRequests(maintenances.stream().map(MaintenanceRequestResponse::fromEntity).toList())
                .roomCleaningRequests(cleanings.stream().map(RoomCleaningResponse::fromEntity).toList())
                .serviceRequests(services.stream().map(ServiceRequestResponse::fromEntity).toList())
                .build();

        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách công việc trong ngày thành công", response));
    }

    private int priorityToRank(String priority) {
        if (priority == null) return 2;
        return switch (priority.trim().toUpperCase()) {
            case "URGENT" -> 4;
            case "HIGH" -> 3;
            case "LOW" -> 1;
            default -> 2; // MEDIUM
        };
    }
}
