package com.example.pbl6.repository;

import com.example.pbl6.entity.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Integer> {
    List<Equipment> findByRoom_RoomId(Integer roomId);
    List<Equipment> findByRoomIsNull();
    List<Equipment> findByStatus(String status);
}
