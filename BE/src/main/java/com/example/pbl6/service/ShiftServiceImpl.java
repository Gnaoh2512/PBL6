package com.example.pbl6.service;

import com.example.pbl6.dto.shift.ShiftRequest;
import com.example.pbl6.dto.shift.ShiftResponse;
import com.example.pbl6.entity.Shift;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShiftServiceImpl implements ShiftService {

    private final ShiftRepository shiftRepository;

    @Override
    public List<ShiftResponse> getAllShifts() {
        return shiftRepository.findAll().stream()
                .map(ShiftResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ShiftResponse createShift(ShiftRequest request) {
        Shift shift = Shift.builder()
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .build();
        return ShiftResponse.fromEntity(shiftRepository.save(shift));
    }

    @Override
    @Transactional
    public ShiftResponse updateShift(Integer id, ShiftRequest request) {
        Shift shift = shiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shift", "id", id));

        shift.setStartTime(request.getStartTime());
        shift.setEndTime(request.getEndTime());

        return ShiftResponse.fromEntity(shiftRepository.save(shift));
    }

    @Override
    @Transactional
    public void deleteShift(Integer id) {
        if (!shiftRepository.existsById(id)) {
            throw new ResourceNotFoundException("Shift", "id", id);
        }
        shiftRepository.deleteById(id);
    }
}