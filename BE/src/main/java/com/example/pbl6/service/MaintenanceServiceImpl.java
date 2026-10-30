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

import java.time.LocalDateTime;
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

    @Override
    @Transactional
    public MaintenanceRequestResponse reportIssue(ReportMaintenanceDto dto, String username) {
        Account reporter = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản người báo: " + username));

        Room room = roomRepository.findById(dto.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng #" + dto.getRoomId()));

        Equipment equipment = null;
        if (dto.getEquipmentId() != null) {
            equipment = equipmentRepository.findById(dto.getEquipmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thiết bị #" + dto.getEquipmentId()));
            equipment.setStatus("BROKEN");
            equipmentRepository.save(equipment);
        }

        String priority = dto.getPriority() != null ? dto.getPriority().toUpperCase() : "MEDIUM";

        // Tự động chuyển phòng sang MAINTENANCE nếu sự cố nghiêm trọng
        if ("HIGH".equalsIgnoreCase(priority) || "URGENT".equalsIgnoreCase(priority)) {
            room.setStatus("MAINTENANCE");
            roomRepository.save(room);
            log.warn("Room {} locked to MAINTENANCE due to {} issue: {}", room.getRoomNumber(), priority, dto.getTitle());
        }

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
        return MaintenanceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MaintenanceRequestResponse> getAllRequests(String status, String priority, Integer roomId) {
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

        return list.stream()
                .map(MaintenanceRequestResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public MaintenanceRequestResponse assignTechnician(Integer requestId, Integer technicianId) {
        MaintenanceRequest request = maintenanceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu bảo trì #" + requestId));

        Account tech = accountRepository.findById(technicianId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy kỹ thuật viên #" + technicianId));

        request.setAssignedTo(tech);
        request.setStatus("IN_PROGRESS");
        request.setStartedAt(LocalDateTime.now());

        if (request.getEquipment() != null) {
            request.getEquipment().setStatus("UNDER_REPAIR");
            equipmentRepository.save(request.getEquipment());
        }

        return MaintenanceRequestResponse.fromEntity(maintenanceRequestRepository.save(request));
    }

    @Override
    @Transactional
    public MaintenanceRequestResponse completeWork(Integer requestId, CompleteMaintenanceDto dto, String technicianUsername) {
        MaintenanceRequest request = maintenanceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu bảo trì #" + requestId));

        request.setStatus("DONE");
        request.setCompletedAt(LocalDateTime.now());
        if (dto != null && dto.getResolutionNote() != null) {
            request.setResolutionNote(dto.getResolutionNote());
        }

        if (request.getEquipment() != null) {
            request.getEquipment().setStatus("WORKING");
            equipmentRepository.save(request.getEquipment());
        }

        return MaintenanceRequestResponse.fromEntity(maintenanceRequestRepository.save(request));
    }

    @Override
    @Transactional
    public MaintenanceRequestResponse confirmCompletion(Integer requestId, String username) {
        MaintenanceRequest request = maintenanceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu bảo trì #" + requestId));

        Account confirmer = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + username));

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

        return MaintenanceRequestResponse.fromEntity(maintenanceRequestRepository.save(request));
    }
}
