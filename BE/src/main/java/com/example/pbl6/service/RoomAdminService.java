package com.example.pbl6.service;

import com.example.pbl6.dto.adminroom.RoomRequest;
import com.example.pbl6.dto.adminroom.RoomTypeRequest;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.RoomType;

public interface RoomAdminService {
    RoomType createRoomType(RoomTypeRequest request);
    RoomType updateRoomType(Integer id, RoomTypeRequest request);
    Room createRoom(RoomRequest request);
    Room updateRoom(Integer id, RoomRequest request);
    Room updateRoomStatus(Integer id, String status);
}