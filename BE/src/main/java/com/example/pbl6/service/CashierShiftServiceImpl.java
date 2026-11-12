package com.example.pbl6.service;

import com.example.pbl6.dto.cashier.CashierShiftResponse;
import com.example.pbl6.dto.cashier.CloseCashierShiftRequest;
import com.example.pbl6.dto.cashier.OpenCashierShiftRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.CashierShift;
import com.example.pbl6.entity.Shift;
import com.example.pbl6.entity.WorkSchedule;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.CashierShiftRepository;
import com.example.pbl6.repository.WorkScheduleRepository;
import com.example.pbl6.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CashierShiftServiceImpl implements CashierShiftService {

    private final CashierShiftRepository cashierShiftRepository;
    private final AccountRepository accountRepository;
    private final WorkScheduleRepository workScheduleRepository;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public CashierShiftResponse openShift(CustomUserDetails userDetails, OpenCashierShiftRequest request) {
        Account account = userDetails.getAccount();

        // Kiểm tra xem hiện tại đã có ca thu ngân chung nào đang mở (OPEN) trong ngày/ca hiện tại chưa
        Optional<CashierShift> existingOpen = findSharedOpenShiftEntity();
        if (existingOpen.isPresent()) {
            CashierShift openCs = existingOpen.get();
            throw new IllegalArgumentException("Hiện đã có ca thu ngân chung #" + openCs.getCashierShiftId()
                    + " đang mở (Người mở: " + (openCs.getAccount() != null ? openCs.getAccount().getFullName() : "Nhân viên")
                    + "). Vui lòng sử dụng chung ca hiện tại hoặc đóng ca trước khi mở ca mới.");
        }

        WorkSchedule schedule = null;
        if (request.getScheduleId() != null) {
            schedule = workScheduleRepository.findById(request.getScheduleId())
                    .orElseThrow(() -> new ResourceNotFoundException("WorkSchedule", "id", request.getScheduleId()));
        } else {
            // Tự động gắn lịch trực hôm nay của nhân viên nếu có
            List<WorkSchedule> todaySchedules = workScheduleRepository
                    .findByAccount_AccountIdAndWorkDate(account.getAccountId(), LocalDate.now());
            if (!todaySchedules.isEmpty()) {
                schedule = todaySchedules.get(0);
            }
        }

        CashierShift shift = CashierShift.builder()
                .account(account)
                .workSchedule(schedule)
                .startTime(LocalDateTime.now())
                .openingCash(request.getOpeningCash())
                .status("OPEN")
                .build();

        CashierShift saved = cashierShiftRepository.save(shift);

        auditLogService.log(account, "THU NGÂN", "OPEN_SHIFT", "cashier_shift", Long.valueOf(saved.getCashierShiftId()),
                "Mở ca thu ngân chung #" + saved.getCashierShiftId() + " - Tiền mặt đầu ca: " + request.getOpeningCash() + " VNĐ");

        return CashierShiftResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public CashierShiftResponse closeShift(Integer cashierShiftId, CustomUserDetails userDetails, CloseCashierShiftRequest request) {
        CashierShift shift = cashierShiftRepository.findById(cashierShiftId)
                .orElseThrow(() -> new ResourceNotFoundException("CashierShift", "id", cashierShiftId));

        if (!"OPEN".equalsIgnoreCase(shift.getStatus())) {
            throw new IllegalArgumentException("Ca thu ngân này không ở trạng thái OPEN.");
        }

        Account receivedBy = null;
        if (request.getReceivedByAccountId() != null) {
            receivedBy = accountRepository.findById(request.getReceivedByAccountId())
                    .orElseThrow(() -> new ResourceNotFoundException("Account", "id", request.getReceivedByAccountId()));
        }

        shift.setEndTime(LocalDateTime.now());
        shift.setClosingCashActual(request.getClosingCashActual());
        shift.setStatus("CLOSED");
        shift.setReceivedBy(receivedBy);
        shift.setHandoverNote(request.getHandoverNote());

        CashierShift saved = cashierShiftRepository.save(shift);

        auditLogService.log(userDetails.getAccount(), "THU NGÂN", "CLOSE_SHIFT", "cashier_shift", Long.valueOf(saved.getCashierShiftId()),
                "Đóng ca thu ngân #" + saved.getCashierShiftId() + " - Tiền mặt thực tế kiểm đếm: " + request.getClosingCashActual() + " VNĐ" +
                        (receivedBy != null ? " (Bàn giao cho: " + receivedBy.getFullName() + ")" : ""));

        return CashierShiftResponse.fromEntity(saved);
    }

    /**
     * Lấy ca thu ngân đang mở (OPEN) dùng chung cho cả Receptionist, Manager và Admin
     * theo ngày hôm đó và khung giờ ca làm việc thay vì lọc cứng theo account_id đăng nhập.
     */
    @Override
    @Transactional(readOnly = true)
    public CashierShiftResponse getActiveShift(CustomUserDetails userDetails) {
        return findSharedOpenShiftEntity()
                .map(CashierShiftResponse::fromEntity)
                .orElseThrow(() -> new ResourceNotFoundException("Active CashierShift", "status", "OPEN"));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CashierShift> findSharedOpenShiftEntity() {
        LocalDate today = LocalDate.now();
        LocalTime nowTime = LocalTime.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        // 1. Tìm tất cả ca thu ngân OPEN mở trong ngày hôm nay hoặc gắn với lịch trực hôm nay
        List<CashierShift> todayOpenShifts = cashierShiftRepository.findOpenShiftsForDate(today, startOfDay, endOfDay);

        if (!todayOpenShifts.isEmpty()) {
            // Ưu tiên ca có khung giờ Shift khớp với giờ hiện tại
            for (CashierShift cs : todayOpenShifts) {
                if (cs.getWorkSchedule() != null && cs.getWorkSchedule().getShift() != null) {
                    Shift s = cs.getWorkSchedule().getShift();
                    if (isTimeInShift(nowTime, s.getStartTime(), s.getEndTime())) {
                        return Optional.of(cs);
                    }
                }
            }
            // Nếu không gắn schedule hoặc ngoài giờ chuẩn, trả về ca OPEN mới nhất của ngày hôm nay
            return Optional.of(todayOpenShifts.get(0));
        }

        // 2. Fallback: Nếu ca đêm mở từ tối hôm qua (vắt qua 00:00) vẫn đang OPEN
        return cashierShiftRepository.findFirstByStatusOrderByStartTimeDesc("OPEN");
    }

    @Override
    @Transactional(readOnly = true)
    public List<CashierShiftResponse> getAllShifts() {
        return cashierShiftRepository.findAll().stream()
                .sorted(Comparator.comparing(CashierShift::getStartTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(CashierShiftResponse::fromEntity)
                .collect(Collectors.toList());
    }

    private boolean isTimeInShift(LocalTime time, LocalTime start, LocalTime end) {
        if (time == null || start == null || end == null) {
            return false;
        }
        if (!end.isBefore(start)) {
            // Ca thường trong ngày (VD: 06:00 - 14:00, 14:00 - 22:00)
            return !time.isBefore(start) && !time.isAfter(end);
        } else {
            // Ca đêm vắt qua 00:00 (VD: 22:00 - 06:00)
            return !time.isBefore(start) || !time.isAfter(end);
        }
    }
}
