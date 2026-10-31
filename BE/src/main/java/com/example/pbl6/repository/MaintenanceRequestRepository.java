package com.example.pbl6.repository;

import com.example.pbl6.entity.MaintenanceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaintenanceRequestRepository extends JpaRepository<MaintenanceRequest, Integer> {
    List<MaintenanceRequest> findByRoom_RoomId(Integer roomId);
    List<MaintenanceRequest> findByStatus(String status);
    List<MaintenanceRequest> findByPriority(String priority);
    List<MaintenanceRequest> findByAssignedTo_AccountId(Integer accountId);
}
