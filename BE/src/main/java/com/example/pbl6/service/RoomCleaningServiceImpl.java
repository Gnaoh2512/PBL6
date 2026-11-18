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
    private final ShiftGuard shiftGuard;

    @Override
    @Transactional(readOnly = true)
    public List<RoomCleaningResponse> getAllRequests(String status, String priority, Integer roomId, Integer assignedToId) {
        return getAllRequests(status, priority, roomId, assignedToId, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomCleaningResponse> getAllRequests(String status, String priority, Integer roomId, Integer assignedToId, String assignedToUsername) {
        List<RoomCleaningRequest> list = cleaningRepository.findAll();

        if (assignedToUsername != null) {
            list = list.stream()
                    .filter(r -> r.getAssignedTo() != null && assignedToUsername.equalsIgnoreCase(r.getAssignedTo().getUsername()))
                    .collect(Collectors.toList());
        }

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
            shiftGuard.ensureOnShift(assignedTo, "ROLE_HOUSEKEEPING", requester, "BUỒNG PHÒNG", "roomcleaning_request", null);
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
            shiftGuard.ensureOnShift(assignedTo, "ROLE_HOUSEKEEPING", accountRepository.findByUsername(username).orElse(null), "BUỒNG PHÒNG", "roomcleaning_request", id);
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

        String oldStatus = req.getStatus();
        if (!"PENDING".equalsIgnoreCase(oldStatus) && !"IN_PROGRESS".equalsIgnoreCase(oldStatus)) {
            throw new IllegalStateException("Chỉ có thể phân công yêu cầu dọn phòng đang chờ hoặc đang dọn (hiện tại: " + oldStatus + ")");
        }

        Account actor = accountRepository.findByUsername(actorUsername).orElse(null);
        Account staff;
        if (staffAccountId != null) {
            staff = accountRepository.findById(staffAccountId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên #" + staffAccountId));
        } else {
            staff = accountRepository.findByUsername(actorUsername)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + actorUsername));
        }

        shiftGuard.ensureOnShift(staff, "ROLE_HOUSEKEEPING", actor, "BUỒNG PHÒNG", "roomcleaning_request", id);

        req.setAssignedTo(staff);
        req.setStatus("IN_PROGRESS");
        if (req.getStartedAt() == null) {
            req.setStartedAt(LocalDateTime.now());
        }

        RoomCleaningRequest saved = cleaningRepository.save(req);
        auditLogService.log("BUỒNG PHÒNG", "ASSIGN_CLEANING", "roomcleaning_request", Long.valueOf(saved.getCleaningId()),
                "Phân công nhân viên " + staff.getFullName() + " dọn phòng " + (req.getRoom() != null ? req.getRoom().getRoomNumber() : "")
                        + " (" + oldStatus + " → IN_PROGRESS)");

        return RoomCleaningResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public RoomCleaningResponse completeCleaning(Integer id, String note, String actorUsername) {
        return completeCleaning(id, note, actorUsername, false);
    }

    /**
     * Housekeeping (ownOnly = true) finishes the cleaning -> AWAITING_INSPECTION, the room stays CLEANING until a
     * receptionist / manager / admin approves it. Supervisors completing directly skip the inspection step.
     */
    @Override
    @Transactional
    public RoomCleaningResponse completeCleaning(Integer id, String note, String actorUsername, boolean ownOnly) {
        RoomCleaningRequest req = cleaningRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dọn phòng #" + id));

        if (ownOnly && (req.getAssignedTo() == null || req.getAssignedTo().getUsername() == null
                || !req.getAssignedTo().getUsername().equalsIgnoreCase(actorUsername))) {
            throw new org.springframework.security.access.AccessDeniedException("Bạn chỉ có thể hoàn tất yêu cầu dọn phòng được phân công cho mình");
        }
        if (!"IN_PROGRESS".equalsIgnoreCase(req.getStatus())) {
            throw new IllegalStateException("Chỉ có thể hoàn tất yêu cầu dọn phòng đang dọn (hiện tại: " + req.getStatus() + ")");
        }

        req.setCompletedAt(LocalDateTime.now());
        if (StringUtils.hasText(note)) {
            req.setNote(StringUtils.hasText(req.getNote()) ? req.getNote() + " | " + note : note);
        }

        String roomLabel = req.getRoom() != null ? req.getRoom().getRoomNumber() : "#" + id;
        String action;
        String details;
        if (ownOnly) {
            req.setStatus("AWAITING_INSPECTION");
            action = "SUBMIT_CLEANING";
            details = "Dọn xong phòng " + roomLabel + ", chờ kiểm tra (IN_PROGRESS → AWAITING_INSPECTION) bởi " + actorUsername;
        } else {
            req.setStatus("COMPLETED");
            releaseRoomAfterCleaning(req.getRoom());
            action = "COMPLETE_CLEANING";
            details = "Hoàn tất dọn phòng " + roomLabel + " (IN_PROGRESS → COMPLETED) bởi " + actorUsername;
        }

        RoomCleaningRequest saved = cleaningRepository.save(req);
        auditLogService.log("BUỒNG PHÒNG", action, "roomcleaning_request", Long.valueOf(saved.getCleaningId()), details);
        return RoomCleaningResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public RoomCleaningResponse approveCleaning(Integer id, String actorUsername) {
        RoomCleaningRequest req = cleaningRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dọn phòng #" + id));
        if (!"AWAITING_INSPECTION".equalsIgnoreCase(req.getStatus())) {
            throw new IllegalStateException("Chỉ có thể duyệt yêu cầu đang chờ kiểm tra (hiện tại: " + req.getStatus() + ")");
        }

        req.setStatus("COMPLETED");
        releaseRoomAfterCleaning(req.getRoom());

        RoomCleaningRequest saved = cleaningRepository.save(req);
        auditLogService.log("BUỒNG PHÒNG", "APPROVE_CLEANING", "roomcleaning_request", Long.valueOf(saved.getCleaningId()),
                "Duyệt phòng " + (req.getRoom() != null ? req.getRoom().getRoomNumber() : "#" + id)
                        + " đạt chuẩn, phòng sẵn sàng đón khách (AWAITING_INSPECTION → COMPLETED) bởi " + actorUsername);
        return RoomCleaningResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public RoomCleaningResponse rejectCleaning(Integer id, String reason, String actorUsername) {
        RoomCleaningRequest req = cleaningRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dọn phòng #" + id));
        if (!"AWAITING_INSPECTION".equalsIgnoreCase(req.getStatus())) {
            throw new IllegalStateException("Chỉ có thể trả lại yêu cầu đang chờ kiểm tra (hiện tại: " + req.getStatus() + ")");
        }

        req.setStatus("IN_PROGRESS");
        req.setCompletedAt(null);
        String remark = "Trả lại: " + (StringUtils.hasText(reason) ? reason.trim() : "chưa đạt, cần dọn lại");
        req.setNote(StringUtils.hasText(req.getNote()) ? req.getNote() + " | " + remark : remark);

        RoomCleaningRequest saved = cleaningRepository.save(req);
        auditLogService.log("BUỒNG PHÒNG", "REJECT_CLEANING", "roomcleaning_request", Long.valueOf(saved.getCleaningId()),
                "Trả lại phòng " + (req.getRoom() != null ? req.getRoom().getRoomNumber() : "#" + id)
                        + " để dọn lại (AWAITING_INSPECTION → IN_PROGRESS) bởi " + actorUsername + " — " + remark);
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

}
