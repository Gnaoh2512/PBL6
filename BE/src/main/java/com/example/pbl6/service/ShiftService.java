package com.example.pbl6.service;

import com.example.pbl6.dto.shift.ShiftRequest;
import com.example.pbl6.dto.shift.ShiftResponse;

import java.util.List;

public interface ShiftService {
    List<ShiftResponse> getAllShifts();
    ShiftResponse createShift(ShiftRequest request);
    ShiftResponse updateShift(Integer id, ShiftRequest request);
    void deleteShift(Integer id);
}