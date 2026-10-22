package com.example.pbl6.service;

import com.example.pbl6.dto.equipment.EquipmentRequest;
import com.example.pbl6.dto.equipment.EquipmentResponse;

import java.util.List;

public interface EquipmentService {
    List<EquipmentResponse> getAllEquipment(Integer roomId, String status);
    EquipmentResponse getEquipmentById(Integer id);
    EquipmentResponse createEquipment(EquipmentRequest request);
    EquipmentResponse updateEquipment(Integer id, EquipmentRequest request);
    void deleteEquipment(Integer id);
}
