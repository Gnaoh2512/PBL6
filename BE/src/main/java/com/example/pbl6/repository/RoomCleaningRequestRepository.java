package com.example.pbl6.repository;

import com.example.pbl6.entity.RoomCleaningRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomCleaningRequestRepository extends JpaRepository<RoomCleaningRequest, Integer> {
    List<RoomCleaningRequest> findByRoom_RoomId(Integer roomId);
    List<RoomCleaningRequest> findByStatus(String status);
    List<RoomCleaningRequest> findByPriority(String priority);
    List<RoomCleaningRequest> findByAssignedTo_AccountId(Integer accountId);
}
