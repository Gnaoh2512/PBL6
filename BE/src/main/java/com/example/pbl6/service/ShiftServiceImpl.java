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
    private final AuditLogService auditLogService;

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
                .shiftName(request.getShiftName())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .description(request.getDescription())
                .build();
        Shift saved = shiftRepository.save(shift);

        auditLogService.log("CA LÀM VIỆC", "CREATE", "shift", Long.valueOf(saved.getShiftId()),
                "Tạo khung ca trực mới: " + saved.getShiftName() + " (" + saved.getStartTime() + " - " + saved.getEndTime() + ")");

        return ShiftResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public ShiftResponse updateShift(Integer id, ShiftRequest request) {
        Shift shift = shiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shift", "id", id));

        if (request.getShiftName() != null) {
            shift.setShiftName(request.getShiftName());
        }
        shift.setStartTime(request.getStartTime());
        shift.setEndTime(request.getEndTime());
        if (request.getDescription() != null) {
            shift.setDescription(request.getDescription());
        }

        Shift updated = shiftRepository.save(shift);

        auditLogService.log("CA LÀM VIỆC", "UPDATE", "shift", Long.valueOf(updated.getShiftId()),
                "Cập nhật khung ca trực: " + updated.getShiftName() + " (" + updated.getStartTime() + " - " + updated.getEndTime() + ")");

        return ShiftResponse.fromEntity(updated);
    }

    @Override
    @Transactional
    public void deleteShift(Integer id) {
        Shift shift = shiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shift", "id", id));
        String name = shift.getShiftName();
        shiftRepository.deleteById(id);

        auditLogService.log("CA LÀM VIỆC", "DELETE", "shift", Long.valueOf(id),
                "Xóa khung ca trực: " + name + " (ID: #" + id + ")");
    }
}
