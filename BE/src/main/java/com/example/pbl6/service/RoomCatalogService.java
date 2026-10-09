package com.example.pbl6.service;

import com.example.pbl6.dto.room.AvailableRoomResponse;
import com.example.pbl6.dto.room.RoomSearchRequest;
import com.example.pbl6.dto.room.RoomTypeResponse;

import java.util.List;

public interface RoomCatalogService {

    List<RoomTypeResponse> getAllRoomTypes();

    RoomTypeResponse getRoomTypeById(Integer id);

    List<AvailableRoomResponse> findAvailableRooms(RoomSearchRequest request);
}
