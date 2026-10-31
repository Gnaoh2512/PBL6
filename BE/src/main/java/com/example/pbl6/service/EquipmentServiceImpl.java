package com.example.pbl6.service;

import com.example.pbl6.dto.equipment.EquipmentRequest;
import com.example.pbl6.dto.equipment.EquipmentResponse;
import com.example.pbl6.entity.Equipment;
import com.example.pbl6.entity.Room;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.EquipmentRepository;
import com.example.pbl6.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EquipmentServiceImpl implements EquipmentService {

    private final EquipmentRepository equipmentRepository;
    private final RoomRepository roomRepository;
    private final AuditLogService auditLogService;

    @Override
    @Transactional(readOnly = true)
    public List<EquipmentResponse> getAllEquipment(Integer roomId, String status) {
        List<Equipment> list;
        if (roomId != null) {
            list = equipmentRepository.findByRoom_RoomId(roomId);
        } else if (status != null && !status.isBlank()) {
            list = equipmentRepository.findByStatus(status.toUpperCase());
        } else {
            list = equipmentRepository.findAll();
        }

        return list.stream()
                .map(EquipmentResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public EquipmentResponse getEquipmentById(Integer id) {
        Equipment equipment = equipmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thiết bị #" + id));
        return EquipmentResponse.fromEntity(equipment);
    }

    @Override
    @Transactional
    public EquipmentResponse createEquipment(EquipmentRequest request) {
        Room room = null;
        if (request.getRoomId() != null) {
            room = roomRepository.findById(request.getRoomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng #" + request.getRoomId()));
        }

        Equipment equipment = Equipment.builder()
                .room(room)
                .equipmentName(request.getEquipmentName().trim())
                .serialNumber(request.getSerialNumber() != null ? request.getSerialNumber().trim() : null)
                .status(request.getStatus() != null ? request.getStatus().toUpperCase() : "WORKING")
                .note(request.getNote())
                .build();

        Equipment saved = equipmentRepository.save(equipment);

        auditLogService.log("THIẾT BỊ", "CREATE", "equipment", Long.valueOf(saved.getEquipmentId()),
                "Thêm mới thiết bị: " + saved.getEquipmentName() + " (Phòng: " + (room != null ? room.getRoomNumber() : "Kho") + ", Tình trạng: " + saved.getStatus() + ")");

        return EquipmentResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public EquipmentResponse updateEquipment(Integer id, EquipmentRequest request) {
        Equipment equipment = equipmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thiết bị #" + id));

        Room room = null;
        if (request.getRoomId() != null) {
            room = roomRepository.findById(request.getRoomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng #" + request.getRoomId()));
            equipment.setRoom(room);
        } else {
            equipment.setRoom(null);
        }

        equipment.setEquipmentName(request.getEquipmentName().trim());
        equipment.setSerialNumber(request.getSerialNumber() != null ? request.getSerialNumber().trim() : null);
        if (request.getStatus() != null) {
            equipment.setStatus(request.getStatus().toUpperCase());
        }
        equipment.setNote(request.getNote());

        Equipment updated = equipmentRepository.save(equipment);

        auditLogService.log("THIẾT BỊ", "UPDATE", "equipment", Long.valueOf(updated.getEquipmentId()),
                "Cập nhật thiết bị: " + updated.getEquipmentName() + " (Tình trạng: " + updated.getStatus() + ", Phòng: " + (room != null ? room.getRoomNumber() : "Kho") + ")");

        return EquipmentResponse.fromEntity(updated);
    }

    @Override
    @Transactional
    public void deleteEquipment(Integer id) {
        Equipment equipment = equipmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thiết bị #" + id));
        equipment.setStatus("RETIRED");
        equipmentRepository.save(equipment);

        auditLogService.log("THIẾT BỊ", "DELETE", "equipment", Long.valueOf(id),
                "Ngưng sử dụng (thanh lý) thiết bị: " + equipment.getEquipmentName() + " (ID: #" + id + ")");
    }
}
