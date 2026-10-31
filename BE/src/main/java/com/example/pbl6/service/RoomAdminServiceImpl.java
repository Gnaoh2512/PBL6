package com.example.pbl6.service;

import com.example.pbl6.dto.adminroom.RoomRequest;
import com.example.pbl6.dto.adminroom.RoomTypeRequest;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.RoomType;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.RoomRepository;
import com.example.pbl6.repository.RoomTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomAdminServiceImpl implements RoomAdminService {

    private final RoomRepository roomRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public RoomType createRoomType(RoomTypeRequest request) {
        RoomType roomType = RoomType.builder()
                .typeName(request.getTypeName())
                .capacity(request.getCapacity())
                .basePrice(request.getBasePrice())
                .amenities(request.getAmenities())
                .description(request.getDescription())
                .build();
        RoomType saved = roomTypeRepository.save(roomType);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "CREATE_ROOM_TYPE", "room_type", Long.valueOf(saved.getRoomTypeId()),
                "Tạo mới hạng phòng: " + saved.getTypeName() + " (Sức chứa: " + saved.getCapacity() + " người, Giá: " + saved.getBasePrice() + " VNĐ)");

        return saved;
    }

    @Override
    @Transactional
    public RoomType updateRoomType(Integer id, RoomTypeRequest request) {
        RoomType roomType = roomTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", id));

        roomType.setTypeName(request.getTypeName());
        roomType.setCapacity(request.getCapacity());
        roomType.setBasePrice(request.getBasePrice());
        roomType.setAmenities(request.getAmenities());
        roomType.setDescription(request.getDescription());

        RoomType updated = roomTypeRepository.save(roomType);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "UPDATE_ROOM_TYPE", "room_type", Long.valueOf(updated.getRoomTypeId()),
                "Cập nhật thông tin hạng phòng: " + updated.getTypeName() + " (Giá: " + updated.getBasePrice() + " VNĐ)");

        return updated;
    }

    @Override
    @Transactional
    public Room createRoom(RoomRequest request) {
        if (roomRepository.existsByRoomNumber(request.getRoomNumber())) {
            throw new IllegalArgumentException("Room number already exists: " + request.getRoomNumber());
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", request.getRoomTypeId()));

        Room room = Room.builder()
                .roomNumber(request.getRoomNumber())
                .roomType(roomType)
                .floor(request.getFloor())
                .status(request.getStatus() != null ? request.getStatus() : "AVAILABLE")
                .note(request.getNote())
                .build();

        Room saved = roomRepository.save(room);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "CREATE_ROOM", "room", Long.valueOf(saved.getRoomId()),
                "Thêm phòng mới: Phòng " + saved.getRoomNumber() + " (Tầng " + saved.getFloor() + ", Hạng: " + roomType.getTypeName() + ")");

        return saved;
    }

    @Override
    @Transactional
    public Room updateRoom(Integer id, RoomRequest request) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", id));

        if (!room.getRoomNumber().equals(request.getRoomNumber()) &&
                roomRepository.existsByRoomNumber(request.getRoomNumber())) {
            throw new IllegalArgumentException("Room number already exists: " + request.getRoomNumber());
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", request.getRoomTypeId()));

        room.setRoomNumber(request.getRoomNumber());
        room.setRoomType(roomType);
        room.setFloor(request.getFloor());
        if (request.getStatus() != null) {
            room.setStatus(request.getStatus());
        }
        room.setNote(request.getNote());

        Room updated = roomRepository.save(room);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "UPDATE_ROOM", "room", Long.valueOf(updated.getRoomId()),
                "Cập nhật phòng " + updated.getRoomNumber() + " (Trạng thái: " + updated.getStatus() + ", Tầng: " + updated.getFloor() + ")");

        return updated;
    }

    @Override
    @Transactional
    public Room updateRoomStatus(Integer id, String status) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", id));
        String oldStatus = room.getStatus();
        room.setStatus(status);
        Room updated = roomRepository.save(room);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "STATUS_CHANGE", "room", Long.valueOf(updated.getRoomId()),
                oldStatus,
                "Đổi trạng thái phòng " + updated.getRoomNumber() + ": " + oldStatus + " ➔ " + status);

        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Room> getAllRooms() {
        return roomRepository.findAll();
    }
}
