package com.example.pbl6.service;

import com.example.pbl6.dto.maintenance.CompleteMaintenanceDto;
import com.example.pbl6.dto.maintenance.MaintenanceRequestResponse;
import com.example.pbl6.dto.maintenance.ReportMaintenanceDto;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Equipment;
import com.example.pbl6.entity.MaintenanceRequest;
import com.example.pbl6.entity.Room;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.EquipmentRepository;
import com.example.pbl6.repository.MaintenanceRequestRepository;
import com.example.pbl6.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MaintenanceServiceImpl implements MaintenanceService {

    private final MaintenanceRequestRepository maintenanceRequestRepository;
    private final RoomRepository roomRepository;
    private final EquipmentRepository equipmentRepository;
    private final AccountRepository accountRepository;
    private final WorkScheduleService workScheduleService;
    private final AuditLogService auditLogService;
    private final ShiftGuard shiftGuard;

    @Override
    @Transactional
    public MaintenanceRequestResponse reportIssue(ReportMaintenanceDto dto, String username) {
        Account reporter = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản người báo: " + username));

        Room room = roomRepository.findById(dto.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng #" + dto.getRoomId()));

        Equipment equipment = null;
        if (dto.getEquipmentId() != null) {
            equipment = equipmentRepository.findById(dto.getEquipmentId()).orElse(null);
        }

        String priority = (dto.getPriority() != null && !dto.getPriority().isBlank())
                ? dto.getPriority().toUpperCase()
                : "MEDIUM";

        MaintenanceRequest request = MaintenanceRequest.builder()
                .room(room)
                .equipment(equipment)
                .reportedBy(reporter)
                .title(dto.getTitle().trim())
                .description(dto.getDescription())
                .priority(priority)
                .status("OPEN")
                .build();

        MaintenanceRequest saved = maintenanceRequestRepository.save(request);

        auditLogService.log(reporter, "BẢO TRÌ", "REPORT", "maintenance_request", Long.valueOf(saved.getRequestId()),
                "Báo hỏng phòng " + room.getRoomNumber() + ": " + dto.getTitle() + " (Mức độ: " + priority + ")");

        return MaintenanceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MaintenanceRequestResponse> getAllRequests(String status, String priority, Integer roomId) {
        return getAllRequests(status, priority, roomId, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MaintenanceRequestResponse> getAllRequests(String status, String priority, Integer roomId,
                                                           String assignedToUsername, String reportedByUsername) {
        List<MaintenanceRequest> list;
        if (roomId != null) {
            list = maintenanceRequestRepository.findByRoom_RoomId(roomId);
        } else if (status != null && !status.isBlank()) {
            list = maintenanceRequestRepository.findByStatus(status.toUpperCase());
        } else if (priority != null && !priority.isBlank()) {
            list = maintenanceRequestRepository.findByPriority(priority.toUpperCase());
        } else {
            list = maintenanceRequestRepository.findAll();
        }

        if (assignedToUsername != null) {
            list = list.stream()
                    .filter(r -> r.getAssignedTo() != null && assignedToUsername.equalsIgnoreCase(r.getAssignedTo().getUsername()))
                    .collect(Collectors.toList());
        }
        if (reportedByUsername != null) {
            list = list.stream()
                    .filter(r -> r.getReportedBy() != null && reportedByUsername.equalsIgnoreCase(r.getReportedBy().getUsername()))
                    .collect(Collectors.toList());
        }

        return list.stream()
                .map(MaintenanceRequestResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public MaintenanceRequestResponse assignTechnician(Integer requestId, Integer technicianId) {
        return assignTechnician(requestId, technicianId, null);
    }

    @Override
    @Transactional
    public MaintenanceRequestResponse assignTechnician(Integer requestId, Integer technicianId, String actorUsername) {
        MaintenanceRequest request = maintenanceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu bảo trì #" + requestId));

        String oldStatus = request.getStatus();
        if (!"OPEN".equalsIgnoreCase(oldStatus) && !"IN_PROGRESS".equalsIgnoreCase(oldStatus)) {
            throw new IllegalStateException("Chỉ có thể phân công yêu cầu bảo trì đang mở hoặc đang xử lý (hiện tại: " + oldStatus + ")");
        }

        Account tech = accountRepository.findById(technicianId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy kỹ thuật viên #" + technicianId));
        Account actor = actorUsername != null ? accountRepository.findByUsername(actorUsername).orElse(null) : null;
        shiftGuard.ensureOnShift(tech, "ROLE_MAINTENANCE", actor, "BẢO TRÌ", "maintenance_request", requestId);

        request.setAssignedTo(tech);
        request.setStatus("IN_PROGRESS");
        request.setStartedAt(LocalDateTime.now());

        if (request.getEquipment() != null) {
            request.getEquipment().setStatus("UNDER_REPAIR");
            equipmentRepository.save(request.getEquipment());
        }

        MaintenanceRequest saved = maintenanceRequestRepository.save(request);

        auditLogService.log("BẢO TRÌ", "ASSIGN", "maintenance_request", Long.valueOf(saved.getRequestId()),
                "Phân công kỹ thuật viên " + tech.getFullName() + " (" + tech.getUsername() + ") xử lý yêu cầu bảo trì phòng " +
                        (saved.getRoom() != null ? saved.getRoom().getRoomNumber() : "N/A") + " (" + oldStatus + " → IN_PROGRESS)");

        return MaintenanceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public MaintenanceRequestResponse completeWork(Integer requestId, CompleteMaintenanceDto dto, String technicianUsername) {
        return completeWork(requestId, dto, technicianUsername, false);
    }

    @Override
    @Transactional
    public MaintenanceRequestResponse completeWork(Integer requestId, CompleteMaintenanceDto dto, String technicianUsername, boolean ownOnly) {
        MaintenanceRequest request = maintenanceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu bảo trì #" + requestId));

        if (ownOnly && (request.getAssignedTo() == null || request.getAssignedTo().getUsername() == null
                || !request.getAssignedTo().getUsername().equalsIgnoreCase(technicianUsername))) {
            throw new org.springframework.security.access.AccessDeniedException("Bạn chỉ có thể hoàn tất yêu cầu bảo trì được phân công cho mình");
        }

        if (!"IN_PROGRESS".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Chỉ có thể báo hoàn tất yêu cầu bảo trì đang xử lý (hiện tại: " + request.getStatus() + ")");
        }

        request.setStatus("DONE");
        request.setCompletedAt(LocalDateTime.now());
        if (dto != null && dto.getResolutionNote() != null) {
            request.setResolutionNote(dto.getResolutionNote());
        }

        // Equipment stays UNDER_REPAIR until the receptionist/manager confirms the work (see confirmCompletion)

        MaintenanceRequest saved = maintenanceRequestRepository.save(request);

        auditLogService.log("BẢO TRÌ", "COMPLETE", "maintenance_request", Long.valueOf(saved.getRequestId()),
                "Kỹ thuật viên " + technicianUsername + " hoàn tất xử lý bảo trì #" + requestId +
                        (dto != null && dto.getResolutionNote() != null ? ": " + dto.getResolutionNote() : ""));

        return MaintenanceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public MaintenanceRequestResponse confirmCompletion(Integer requestId, String username) {
        MaintenanceRequest request = maintenanceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu bảo trì #" + requestId));

        Account confirmer = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + username));

        if (!"DONE".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Chỉ có thể nghiệm thu yêu cầu bảo trì đã được kỹ thuật viên báo hoàn tất (hiện tại: " + request.getStatus() + ")");
        }

        if (request.getEquipment() != null) {
            request.getEquipment().setStatus("WORKING");
            equipmentRepository.save(request.getEquipment());
        }

        request.setConfirmedBy(confirmer);
        request.setStatus("CONFIRMED");
        request.setConfirmedAt(LocalDateTime.now());

        // Kiểm tra xem phòng còn sự cố nào khác đang mở không
        Room room = request.getRoom();
        if (room != null && "MAINTENANCE".equalsIgnoreCase(room.getStatus())) {
            boolean hasOtherOpenRequests = maintenanceRequestRepository.findByRoom_RoomId(room.getRoomId()).stream()
                    .anyMatch(r -> !r.getRequestId().equals(requestId) 
                            && ("OPEN".equalsIgnoreCase(r.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(r.getStatus())));
            if (!hasOtherOpenRequests) {
                room.setStatus("CLEANING");
                roomRepository.save(room);
                log.info("Room {} released from MAINTENANCE to CLEANING after maintenance confirmed", room.getRoomNumber());
            }
        }

        MaintenanceRequest saved = maintenanceRequestRepository.save(request);

        auditLogService.log(confirmer, "BẢO TRÌ", "CONFIRM", "maintenance_request", Long.valueOf(saved.getRequestId()),
                "Xác nhận nghiệm thu bảo trì #" + requestId + " bởi " + confirmer.getFullName() + " (" + confirmer.getUsername() + ")");

        return MaintenanceRequestResponse.fromEntity(saved);
    }
}
