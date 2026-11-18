package com.example.pbl6.service;

import com.example.pbl6.dto.cleaning.RoomCleaningRequestDto;
import com.example.pbl6.dto.cleaning.RoomCleaningResponse;

import java.util.List;

public interface RoomCleaningService {
    List<RoomCleaningResponse> getAllRequests(String status, String priority, Integer roomId, Integer assignedToId);
    List<RoomCleaningResponse> getAllRequests(String status, String priority, Integer roomId, Integer assignedToId, String assignedToUsername);
    RoomCleaningResponse getById(Integer id);
    RoomCleaningResponse createRequest(RoomCleaningRequestDto dto, String username);
    RoomCleaningResponse updateRequest(Integer id, RoomCleaningRequestDto dto, String username);
    RoomCleaningResponse assignStaff(Integer id, Integer staffAccountId, String actorUsername);
    RoomCleaningResponse completeCleaning(Integer id, String note, String actorUsername);
    RoomCleaningResponse completeCleaning(Integer id, String note, String actorUsername, boolean ownOnly);
    /** Supervisor accepts a cleaning that is AWAITING_INSPECTION: room becomes AVAILABLE. */
    RoomCleaningResponse approveCleaning(Integer id, String actorUsername);
    /** Supervisor sends a cleaning back to the housekeeper (AWAITING_INSPECTION -> IN_PROGRESS). */
    RoomCleaningResponse rejectCleaning(Integer id, String reason, String actorUsername);
    void deleteRequest(Integer id, String actorUsername);
}
