package com.example.pbl6.service;

import com.example.pbl6.dto.shift.ShiftRequest;
import com.example.pbl6.dto.shift.ShiftResponse;
import com.example.pbl6.entity.Shift;
import com.example.pbl6.exception.ConflictException;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.ShiftRepository;
import com.example.pbl6.repository.WorkScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ShiftServiceImpl implements ShiftService {

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    private final ShiftRepository shiftRepository;
    private final WorkScheduleRepository workScheduleRepository;
    private final AuditLogService auditLogService;

    @Override
    @Transactional(readOnly = true)
    public List<ShiftResponse> getAllShifts() {
        return shiftRepository.findAll().stream()
                .map(ShiftResponse::fromEntity)
                .toList();
    }

    @Override
    @Transactional
    public ShiftResponse createShift(ShiftRequest request) {
        validateTimes(request);
        Shift shift = Shift.builder()
                .shiftName(resolveName(request.getShiftName(), request.getStartTime(), request.getEndTime()))
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
        validateTimes(request);

        String requestedName = request.getShiftName() != null && !request.getShiftName().isBlank()
                ? request.getShiftName()
                : shift.getShiftName();
        shift.setShiftName(resolveName(requestedName, request.getStartTime(), request.getEndTime()));
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

        long inUse = workScheduleRepository.countByShift_ShiftId(id);
        if (inUse > 0) {
            throw new ConflictException("This shift is used by " + inUse
                    + " scheduled assignment(s). Reassign or remove them before deleting the shift");
        }

        String name = shift.getShiftName();
        shiftRepository.deleteById(id);

        auditLogService.log("CA LÀM VIỆC", "DELETE", "shift", Long.valueOf(id),
                "Xóa khung ca trực: " + name + " (ID: #" + id + ")");
    }

    /** end == start would be a zero-length shift; end < start is a valid overnight shift. */
    private void validateTimes(ShiftRequest request) {
        if (request.getStartTime() != null && request.getStartTime().equals(request.getEndTime())) {
            throw new IllegalArgumentException("A shift's start and end time must be different");
        }
    }

    /** The calendar needs a label, so a blank name becomes e.g. "Ca 06:00-14:00". */
    private String resolveName(String name, LocalTime start, LocalTime end) {
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        return "Ca " + start.format(HHMM) + "-" + end.format(HHMM);
    }
}
