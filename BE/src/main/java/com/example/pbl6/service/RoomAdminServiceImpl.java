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

@Service
@RequiredArgsConstructor
public class RoomAdminServiceImpl implements RoomAdminService {

    private final RoomRepository roomRepository;
    private final RoomTypeRepository roomTypeRepository;

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
        return roomTypeRepository.save(roomType);
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

        return roomTypeRepository.save(roomType);
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

        return roomRepository.save(room);
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

        return roomRepository.save(room);
    }

    @Override
    @Transactional
    public Room updateRoomStatus(Integer id, String status) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", id));
        room.setStatus(status);
        return roomRepository.save(room);
    }
}