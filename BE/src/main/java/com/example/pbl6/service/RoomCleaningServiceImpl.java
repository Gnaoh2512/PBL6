package com.example.pbl6.service;

import com.example.pbl6.common.enums.RoomStatus;
import com.example.pbl6.dto.cleaning.RoomCleaningRequestDto;
import com.example.pbl6.dto.cleaning.RoomCleaningResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Booking;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.RoomCleaningRequest;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.BookingRepository;
import com.example.pbl6.repository.RoomCleaningRequestRepository;
import com.example.pbl6.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomCleaningServiceImpl implements RoomCleaningService {

    private final RoomCleaningRequestRepository cleaningRepository;
    private final RoomRepository roomRepository;
    private final BookingRepository bookingRepository;
    private final AccountRepository accountRepository;
    private final WorkScheduleService workScheduleService;
    private final AuditLogService auditLogService;

    @Override
    @Transactional(readOnly = true)
    public List<RoomCleaningResponse> getAllRequests(String status, String priority, Integer roomId, Integer assignedToId) {
        List<RoomCleaningRequest> list = cleaningRepository.findAll();

        if (roomId != null) {
            list = list.stream()
                    .filter(r -> r.getRoom() != null && roomId.equals(r.getRoom().getRoomId()))
                    .collect(Collectors.toList());
        }
        if (assignedToId != null) {
            list = list.stream()
                    .filter(r -> r.getAssignedTo() != null && assignedToId.equals(r.getAssignedTo().getAccountId()))
                    .collect(Collectors.toList());
        }
        if (StringUtils.hasText(status)) {
            String s = status.trim().toUpperCase();
            list = list.stream()
                    .filter(r -> s.equalsIgnoreCase(r.getStatus()))
                    .collect(Collectors.toList());
        }
        if (StringUtils.hasText(priority)) {
            String p = priority.trim().toUpperCase();
            list = list.stream()
                    .filter(r -> p.equalsIgnoreCase(r.getPriority()))
                    .collect(Collectors.toList());
        }

        return list.stream()
                .sorted(Comparator.comparing(RoomCleaningRequest::getCleaningId, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(RoomCleaningResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public RoomCleaningResponse getById(Integer id) {
        RoomCleaningRequest entity = cleaningRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dọn phòng #" + id));
        return RoomCleaningResponse.fromEntity(entity);
    }

    @Override
    @Transactional
    public RoomCleaningResponse createRequest(RoomCleaningRequestDto dto, String username) {
        Room room = roomRepository.findById(dto.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng #" + dto.getRoomId()));

        Account requester = null;
        if (StringUtils.hasText(username)) {
            requester = accountRepository.findByUsername(username).orElse(null);
        }

        Booking booking = null;
        if (dto.getBookingId() != null) {
            booking = bookingRepository.findById(dto.getBookingId()).orElse(null);
        }

        Account assignedTo = null;
        if (dto.getAssignedToId() != null) {
            assignedTo = accountRepository.findById(dto.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên #" + dto.getAssignedToId()));
            validateShiftIfScheduledDataExists(assignedTo, "ROLE_HOUSEKEEPING");
        }

        String priority = StringUtils.hasText(dto.getPriority()) ? dto.getPriority().trim().toUpperCase() : "MEDIUM";
        String status = assignedTo != null ? "IN_PROGRESS"
                : (StringUtils.hasText(dto.getStatus()) ? dto.getStatus().trim().toUpperCase() : "PENDING");

        RoomCleaningRequest req = RoomCleaningRequest.builder()
                .room(room)
                .booking(booking)
                .requestedBy(requester)
                .assignedTo(assignedTo)
                .priority(priority)
                .status(status)
                .note(dto.getNote())
                .startedAt(assignedTo != null ? LocalDateTime.now() : null)
                .build();

        if (!RoomStatus.OCCUPIED.name().equalsIgnoreCase(room.getStatus())
                && !RoomStatus.MAINTENANCE.name().equalsIgnoreCase(room.getStatus())) {
            room.setStatus(RoomStatus.CLEANING.name());
            roomRepository.save(room);
        }

        RoomCleaningRequest saved = cleaningRepository.save(req);
        auditLogService.log(requester, "BUỒNG PHÒNG", "CREATE_CLEANING", "roomcleaning_request", Long.valueOf(saved.getCleaningId()),
                "Tạo yêu cầu dọn phòng " + room.getRoomNumber() + " (Mức độ: " + priority + ")");

        return RoomCleaningResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public RoomCleaningResponse updateRequest(Integer id, RoomCleaningRequestDto dto, String username) {
        RoomCleaningRequest req = cleaningRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dọn phòng #" + id));

        if (dto.getRoomId() != null && (req.getRoom() == null || !dto.getRoomId().equals(req.getRoom().getRoomId()))) {
            Room room = roomRepository.findById(dto.getRoomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng #" + dto.getRoomId()));
            req.setRoom(room);
        }

        if (dto.getBookingId() != null) {
            Booking booking = bookingRepository.findById(dto.getBookingId()).orElse(null);
            req.setBooking(booking);
        }

        if (dto.getAssignedToId() != null) {
            Account assignedTo = accountRepository.findById(dto.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên #" + dto.getAssignedToId()));
            validateShiftIfScheduledDataExists(assignedTo, "ROLE_HOUSEKEEPING");
            req.setAssignedTo(assignedTo);
            if ("PENDING".equalsIgnoreCase(req.getStatus())) {
                req.setStatus("IN_PROGRESS");
                req.setStartedAt(LocalDateTime.now());
            }
        }

        if (StringUtils.hasText(dto.getPriority())) {
            req.setPriority(dto.getPriority().trim().toUpperCase());
        }
        if (StringUtils.hasText(dto.getStatus())) {
            String newStatus = dto.getStatus().trim().toUpperCase();
            req.setStatus(newStatus);
            if ("COMPLETED".equalsIgnoreCase(newStatus)) {
                req.setCompletedAt(LocalDateTime.now());
                releaseRoomAfterCleaning(req.getRoom());
            }
        }
        if (dto.getNote() != null) {
            req.setNote(dto.getNote());
        }

        RoomCleaningRequest saved = cleaningRepository.save(req);
        auditLogService.log("BUỒNG PHÒNG", "UPDATE_CLEANING", "roomcleaning_request", Long.valueOf(saved.getCleaningId()),
                "Cập nhật yêu cầu dọn phòng #" + id + " bởi " + username);

        return RoomCleaningResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public RoomCleaningResponse assignStaff(Integer id, Integer staffAccountId, String actorUsername) {
        RoomCleaningRequest req = cleaningRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dọn phòng #" + id));

        Account staff;
        if (staffAccountId != null) {
            staff = accountRepository.findById(staffAccountId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên #" + staffAccountId));
        } else {
            staff = accountRepository.findByUsername(actorUsername)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + actorUsername));
        }

        validateShiftIfScheduledDataExists(staff, "ROLE_HOUSEKEEPING");

        req.setAssignedTo(staff);
        req.setStatus("IN_PROGRESS");
        if (req.getStartedAt() == null) {
            req.setStartedAt(LocalDateTime.now());
        }

        RoomCleaningRequest saved = cleaningRepository.save(req);
        auditLogService.log("BUỒNG PHÒNG", "ASSIGN_CLEANING", "roomcleaning_request", Long.valueOf(saved.getCleaningId()),
                "Phân công nhân viên " + staff.getFullName() + " dọn phòng " + (req.getRoom() != null ? req.getRoom().getRoomNumber() : ""));

        return RoomCleaningResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public RoomCleaningResponse completeCleaning(Integer id, String note, String actorUsername) {
        RoomCleaningRequest req = cleaningRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dọn phòng #" + id));

        if (req.getAssignedTo() == null && StringUtils.hasText(actorUsername)) {
            accountRepository.findByUsername(actorUsername).ifPresent(req::setAssignedTo);
        }

        req.setStatus("COMPLETED");
        req.setCompletedAt(LocalDateTime.now());
        if (StringUtils.hasText(note)) {
            req.setNote(StringUtils.hasText(req.getNote()) ? req.getNote() + " | " + note : note);
        }

        releaseRoomAfterCleaning(req.getRoom());

        RoomCleaningRequest saved = cleaningRepository.save(req);
        auditLogService.log("BUỒNG PHÒNG", "COMPLETE_CLEANING", "roomcleaning_request", Long.valueOf(saved.getCleaningId()),
                "Hoàn tất dọn phòng " + (req.getRoom() != null ? req.getRoom().getRoomNumber() : "#" + id) + " bởi " + actorUsername);

        return RoomCleaningResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public void deleteRequest(Integer id, String actorUsername) {
        RoomCleaningRequest req = cleaningRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dọn phòng #" + id));
        cleaningRepository.delete(req);
        auditLogService.log("BUỒNG PHÒNG", "DELETE_CLEANING", "roomcleaning_request", Long.valueOf(id),
                "Xóa yêu cầu dọn phòng #" + id + " bởi " + actorUsername);
    }

    private void releaseRoomAfterCleaning(Room room) {
        if (room != null && RoomStatus.CLEANING.name().equalsIgnoreCase(room.getStatus())) {
            room.setStatus(RoomStatus.AVAILABLE.name());
            roomRepository.save(room);
        }
    }

    /**
     * Nếu trong ngày/ca hiện tại có dữ liệu phân ca trực cho bộ phận đó thì kiểm tra Strict Shift Validation.
     */
    private void validateShiftIfScheduledDataExists(Account staff, String roleCode) {
        var availableStaff = workScheduleService.getAvailableStaffInShift(LocalDate.now(), LocalTime.now(), roleCode);
        if (!availableStaff.isEmpty()) {
            boolean inShift = availableStaff.stream().anyMatch(s -> s.getAccountId().equals(staff.getAccountId()));
            if (!inShift) {
                throw new IllegalArgumentException("Nhân viên " + staff.getFullName() + " hiện không có trong lịch trực ca hiện tại!");
            }
        }
    }
}
