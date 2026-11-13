package com.example.pbl6.service;

import com.example.pbl6.common.enums.ScheduleStatus;
import com.example.pbl6.dto.schedule.AvailableStaffInShiftResponse;
import com.example.pbl6.dto.schedule.BulkScheduleRequest;
import com.example.pbl6.dto.schedule.BulkScheduleResponse;
import com.example.pbl6.dto.schedule.CopyScheduleRequest;
import com.example.pbl6.dto.schedule.DayScheduleBatchUpdateRequest;
import com.example.pbl6.dto.schedule.DayScheduleTableResponse;
import com.example.pbl6.dto.schedule.ScheduleStaffResponse;
import com.example.pbl6.dto.schedule.WorkScheduleRequest;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
import com.example.pbl6.dto.schedule.WorkScheduleStatusUpdateRequest;
import com.example.pbl6.dto.schedule.WorkScheduleUpdateRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Shift;
import com.example.pbl6.entity.WorkSchedule;
import com.example.pbl6.exception.ConflictException;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.CashierShiftRepository;
import com.example.pbl6.repository.ShiftRepository;
import com.example.pbl6.repository.WorkScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WorkScheduleServiceImpl implements WorkScheduleService {

    private static final String MODULE = "LỊCH LÀM VIỆC";
    private static final String TABLE = "work_schedule";

    /** Longest range a calendar query may cover (up to 1 year for multi-month views). */
    private static final int MAX_QUERY_DAYS = 370;
    /** Longest range a bulk / recurring assign or copy may cover (up to 1 year / 12 months / 52 weeks). */
    private static final int MAX_BULK_DAYS = 370;

    private final WorkScheduleRepository workScheduleRepository;
    private final AccountRepository accountRepository;
    private final ShiftRepository shiftRepository;
    private final CashierShiftRepository cashierShiftRepository;
    private final AuditLogService auditLogService;

    // ------------------------------------------------------------------ reads

    @Override
    @Transactional(readOnly = true)
    public List<WorkScheduleResponse> getAllSchedules() {
        return workScheduleRepository.findAll().stream()
                .map(WorkScheduleResponse::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkScheduleResponse> getSchedulesByDate(LocalDate workDate) {
        LocalDate target = workDate != null ? workDate : LocalDate.now();
        return workScheduleRepository.findByWorkDate(target).stream()
                .map(WorkScheduleResponse::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DayScheduleTableResponse getDayScheduleTable(LocalDate workDate, Integer shiftId, String role) {
        LocalDate targetDate = workDate != null ? workDate : LocalDate.now();
        List<WorkScheduleResponse> list = workScheduleRepository
                .search(targetDate, targetDate, null, shiftId, normalizeRole(role)).stream()
                .map(WorkScheduleResponse::fromEntity)
                .toList();

        int scheduled = 0;
        int completed = 0;
        int absent = 0;
        int off = 0;
        for (WorkScheduleResponse item : list) {
            ScheduleStatus st = ScheduleStatus.parse(item.getStatus());
            switch (st) {
                case COMPLETED -> completed++;
                case ABSENT -> absent++;
                case OFF -> off++;
                default -> scheduled++;
            }
        }

        return DayScheduleTableResponse.builder()
                .workDate(targetDate)
                .dayOfWeek(targetDate.getDayOfWeek())
                .totalSchedules(list.size())
                .scheduledCount(scheduled)
                .completedCount(completed)
                .absentCount(absent)
                .offCount(off)
                .schedules(list)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkScheduleResponse> searchSchedules(LocalDate from, LocalDate to,
                                                      Integer accountId, Integer shiftId, String role) {
        validateRange(from, to, MAX_QUERY_DAYS);
        return workScheduleRepository.search(from, to, accountId, shiftId, normalizeRole(role)).stream()
                .map(WorkScheduleResponse::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkScheduleResponse> getMySchedules(Integer accountId, LocalDate from, LocalDate to) {
        validateRange(from, to, MAX_QUERY_DAYS);
        return workScheduleRepository.search(from, to, accountId, null, null).stream()
                .map(WorkScheduleResponse::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleStaffResponse> getSchedulableStaff() {
        return accountRepository.findSchedulableStaff().stream()
                .map(ScheduleStaffResponse::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AvailableStaffInShiftResponse> getAvailableStaffInShift(LocalDate date, LocalTime time, String roleCode) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        LocalTime targetTime = time != null ? time : LocalTime.now();
        String normalizedRole = normalizeRole(roleCode);

        // Lấy lịch của cả ngày trước đó (để bắt trường hợp ca đêm từ 22:00 hôm qua kéo sang 06:00 sáng hôm nay)
        LocalDate prevDate = targetDate.minusDays(1);
        List<WorkSchedule> candidates = workScheduleRepository.search(prevDate, targetDate, null, null, normalizedRole);

        List<AvailableStaffInShiftResponse> available = new ArrayList<>();
        Set<Integer> addedAccounts = new LinkedHashSet<>();

        for (WorkSchedule ws : candidates) {
            Account account = ws.getAccount();
            Shift shift = ws.getShift();
            if (account == null || shift == null || !isSchedulable(account)) {
                continue;
            }
            ScheduleStatus st = ScheduleStatus.parse(ws.getStatus());
            if (st == ScheduleStatus.OFF || st == ScheduleStatus.ABSENT) {
                continue;
            }
            if (matchesShiftTime(ws.getWorkDate(), shift, targetDate, targetTime)) {
                if (addedAccounts.add(account.getAccountId())) {
                    available.add(AvailableStaffInShiftResponse.fromWorkSchedule(ws));
                }
            }
        }
        return available;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isStaffInActiveShift(Integer accountId, LocalDate date, LocalTime time) {
        if (accountId == null) return false;
        LocalDate targetDate = date != null ? date : LocalDate.now();
        LocalTime targetTime = time != null ? time : LocalTime.now();
        LocalDate prevDate = targetDate.minusDays(1);

        List<WorkSchedule> schedules = workScheduleRepository.search(prevDate, targetDate, accountId, null, null);
        for (WorkSchedule ws : schedules) {
            ScheduleStatus st = ScheduleStatus.parse(ws.getStatus());
            if (st == ScheduleStatus.OFF || st == ScheduleStatus.ABSENT) {
                continue;
            }
            if (ws.getShift() != null && matchesShiftTime(ws.getWorkDate(), ws.getShift(), targetDate, targetTime)) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesShiftTime(LocalDate scheduleDate, Shift shift, LocalDate targetDate, LocalTime targetTime) {
        if (scheduleDate == null || shift == null || shift.getStartTime() == null || shift.getEndTime() == null) {
            return false;
        }
        LocalTime start = shift.getStartTime();
        LocalTime end = shift.getEndTime();

        if (!end.isBefore(start)) {
            // Ca thường trong ngày (ví dụ 06:00 -> 14:00, 14:00 -> 22:00)
            return scheduleDate.equals(targetDate) && !targetTime.isBefore(start) && !targetTime.isAfter(end);
        } else {
            // Ca đêm vắt qua 00:00 (ví dụ 22:00 -> 06:00)
            if (scheduleDate.equals(targetDate)) {
                return !targetTime.isBefore(start);
            } else if (scheduleDate.plusDays(1).equals(targetDate)) {
                return !targetTime.isAfter(end);
            }
            return false;
        }
    }

    // ----------------------------------------------------------------- writes

    @Override
    @Transactional
    public WorkScheduleResponse createSchedule(WorkScheduleRequest request) {
        // Nếu người dùng gửi kèm các tham số lặp lại (repeatWeeks, repeatMonths, repeatCount, endDate...)
        // vào API tạo lịch đơn, tự động xử lý đặt lịch lặp lại và trả về bản ghi đầu tiên.
        if (request.isRecurring()) {
            BulkScheduleRequest bulkReq = new BulkScheduleRequest();
            bulkReq.setAccountIds(List.of(request.getAccountId()));
            bulkReq.setShiftId(request.getShiftId());
            bulkReq.setStartDate(request.getWorkDate());
            bulkReq.setEndDate(request.getEndDate());
            bulkReq.setRepeatWeeks(request.getRepeatWeeks());
            bulkReq.setRepeatMonths(request.getRepeatMonths());
            bulkReq.setRepeatCount(request.getRepeatCount());
            bulkReq.setRepeatUnit(request.getRepeatUnit());
            bulkReq.setRepeatInterval(request.getRepeatInterval());
            bulkReq.setDaysOfWeek(request.getDaysOfWeek());
            bulkReq.setStatus(request.getStatus());
            bulkReq.setNotes(request.getNotes());
            bulkReq.setOverwrite(request.isOverwrite());

            BulkScheduleResponse bulkRes = bulkAssign(bulkReq);
            if (bulkRes.getSchedules() != null && !bulkRes.getSchedules().isEmpty()) {
                return bulkRes.getSchedules().get(0);
            }
            List<WorkSchedule> onStart = workScheduleRepository
                    .findByAccount_AccountIdAndWorkDate(request.getAccountId(), request.getWorkDate());
            if (!onStart.isEmpty()) {
                return WorkScheduleResponse.fromEntity(onStart.get(0));
            }
            throw new ConflictException("Could not create recurring schedules; all target dates were skipped");
        }

        Account account = loadAccount(request.getAccountId());
        Shift shift = loadShift(request.getShiftId());
        requireSchedulable(account);
        ScheduleStatus status = ScheduleStatus.parse(request.getStatus());
        if (status != ScheduleStatus.SCHEDULED) {
            requireAdminOrManagerForStatusChange();
        }

        if (hasScheduleOnDate(account.getAccountId(), request.getWorkDate(), null)) {
            throw alreadyScheduled(account, request.getWorkDate());
        }

        WorkSchedule schedule = WorkSchedule.builder()
                .account(account)
                .shift(shift)
                .workDate(request.getWorkDate())
                .status(status.name())
                .notes(request.getNotes())
                .build();

        WorkSchedule saved;
        try {
            saved = workScheduleRepository.saveAndFlush(schedule);
        } catch (DataIntegrityViolationException ex) {
            // Lost a race with another request for the same staff/day.
            throw alreadyScheduled(account, request.getWorkDate());
        }

        auditLogService.log(MODULE, "ASSIGN", TABLE, Long.valueOf(saved.getScheduleId()),
                "Phân ca " + shiftLabel(shift) + " cho nhân viên " + staffLabel(account)
                        + " vào ngày " + request.getWorkDate());

        return WorkScheduleResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public WorkScheduleResponse updateSchedule(Integer id, WorkScheduleUpdateRequest request) {
        WorkSchedule ws = workScheduleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkSchedule", "id", id));

        String before = describe(ws);
        ScheduleStatus currentStatus = ScheduleStatus.parse(ws.getStatus());

        Account newAccount = request.getAccountId() != null ? loadAccount(request.getAccountId()) : ws.getAccount();
        Shift newShift = request.getShiftId() != null ? loadShift(request.getShiftId()) : ws.getShift();
        LocalDate newDate = request.getWorkDate() != null ? request.getWorkDate() : ws.getWorkDate();
        ScheduleStatus newStatus = request.getStatus() != null
                ? ScheduleStatus.parse(request.getStatus())
                : currentStatus;

        // Kiểm tra nghiêm ngặt: Chỉ ADMIN và MANAGER mới được chỉnh sửa status của shift
        if (request.getStatus() != null || newStatus != currentStatus) {
            requireAdminOrManagerForStatusChange();
        }

        boolean accountChanged = !Objects.equals(idOf(newAccount), idOf(ws.getAccount()));
        boolean dateChanged = !Objects.equals(newDate, ws.getWorkDate());

        if (accountChanged) {
            requireSchedulable(newAccount);
        }
        if (accountChanged || dateChanged) {
            if (hasScheduleOnDate(newAccount.getAccountId(), newDate, ws.getScheduleId())) {
                throw alreadyScheduled(newAccount, newDate);
            }
            if (cashierShiftRepository.existsByWorkSchedule_ScheduleId(ws.getScheduleId())) {
                throw new ConflictException(
                        "This schedule is linked to a cashier shift, so its staff member and date cannot be changed");
            }
        }

        ws.setAccount(newAccount);
        ws.setShift(newShift);
        ws.setWorkDate(newDate);
        ws.setStatus(newStatus.name());
        if (request.getNotes() != null) {
            ws.setNotes(request.getNotes());
        }

        WorkSchedule saved;
        try {
            saved = workScheduleRepository.saveAndFlush(ws);
        } catch (DataIntegrityViolationException ex) {
            throw alreadyScheduled(newAccount, newDate);
        }

        auditLogService.log(MODULE, "UPDATE", TABLE, Long.valueOf(id), before, describe(saved));
        return WorkScheduleResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public WorkScheduleResponse updateScheduleStatus(Integer id, WorkScheduleStatusUpdateRequest request) {
        requireAdminOrManagerForStatusChange();

        WorkSchedule ws = workScheduleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkSchedule", "id", id));

        String before = describe(ws);
        ScheduleStatus newStatus = ScheduleStatus.parse(request.getStatus());
        ws.setStatus(newStatus.name());
        if (request.getNotes() != null) {
            ws.setNotes(request.getNotes());
        }

        WorkSchedule saved = workScheduleRepository.saveAndFlush(ws);
        auditLogService.log(MODULE, "UPDATE_STATUS", TABLE, Long.valueOf(id), before, describe(saved));
        return WorkScheduleResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public DayScheduleTableResponse batchUpdateDaySchedules(LocalDate workDate, DayScheduleBatchUpdateRequest request) {
        requireAdminOrManagerForStatusChange();

        LocalDate targetDate = workDate != null
                ? workDate
                : (request != null && request.getWorkDate() != null ? request.getWorkDate() : LocalDate.now());

        if (request != null) {
            if (request.getDeletedScheduleIds() != null) {
                for (Integer delId : request.getDeletedScheduleIds()) {
                    if (delId != null && workScheduleRepository.existsById(delId)) {
                        deleteSchedule(delId);
                    }
                }
            }

            if (request.getItems() != null) {
                for (DayScheduleBatchUpdateRequest.DayScheduleItemDto item : request.getItems()) {
                    if (item == null) continue;
                    LocalDate itemDate = item.getWorkDate() != null ? item.getWorkDate() : targetDate;
                    if (item.getScheduleId() != null) {
                        WorkScheduleUpdateRequest updateReq = new WorkScheduleUpdateRequest();
                        updateReq.setAccountId(item.getAccountId());
                        updateReq.setShiftId(item.getShiftId());
                        updateReq.setWorkDate(itemDate);
                        updateReq.setStatus(item.getStatus());
                        updateReq.setNotes(item.getNotes());
                        updateSchedule(item.getScheduleId(), updateReq);
                    } else if (item.getAccountId() != null && item.getShiftId() != null) {
                        WorkScheduleRequest createReq = new WorkScheduleRequest();
                        createReq.setAccountId(item.getAccountId());
                        createReq.setShiftId(item.getShiftId());
                        createReq.setWorkDate(itemDate);
                        createReq.setStatus(item.getStatus());
                        createReq.setNotes(item.getNotes());
                        createSchedule(createReq);
                    }
                }
            }
        }

        return getDayScheduleTable(targetDate, null, null);
    }

    @Override
    @Transactional
    public BulkScheduleResponse bulkAssign(BulkScheduleRequest request) {
        LocalDate startDate = request.getStartDate();
        if (startDate == null) {
            throw new IllegalArgumentException("Start date is required");
        }

        LocalDate resolvedEndDate = resolveRecurringEndDate(request);
        validateRange(startDate, resolvedEndDate, MAX_BULK_DAYS);

        Set<Integer> accountIds = resolveAccountIds(request);
        if (accountIds.isEmpty()) {
            throw new IllegalArgumentException("At least one account is required");
        }

        Shift shift = loadShift(request.getShiftId());
        List<Account> accounts = loadAccounts(accountIds);
        accounts.forEach(this::requireSchedulable);

        ScheduleStatus initialStatus = ScheduleStatus.parse(request.getStatus());
        if (initialStatus != ScheduleStatus.SCHEDULED) {
            requireAdminOrManagerForStatusChange();
        }

        List<LocalDate> dates = expandRecurringDates(startDate, resolvedEndDate, request);
        if (dates.isEmpty()) {
            throw new IllegalArgumentException("No dates in the selected range match the chosen recurrence / days of the week");
        }

        Map<Key, WorkSchedule> existing = loadExisting(accountIds, startDate, resolvedEndDate);
        BulkCollector out = new BulkCollector();
        for (Account account : accounts) {
            for (LocalDate date : dates) {
                upsert(account, shift, date, request.getNotes(), initialStatus,
                        request.isOverwrite(), existing, out);
            }
        }

        BulkScheduleResponse response = persist(out);
        auditLogService.log(MODULE, "BULK_ASSIGN", TABLE, (Long) null,
                "Phân ca hàng loạt / lặp lại: " + shiftLabel(shift) + " cho " + accounts.size() + " nhân viên từ "
                        + startDate + " đến " + resolvedEndDate + " — " + summary(response));
        return response;
    }

    @Override
    @Transactional
    public BulkScheduleResponse copySchedules(CopyScheduleRequest request) {
        validateRange(request.getSourceStart(), request.getSourceEnd(), MAX_BULK_DAYS);
        long baseOffset = ChronoUnit.DAYS.between(request.getSourceStart(), request.getTargetStart());
        if (baseOffset == 0) {
            throw new IllegalArgumentException("The target start date must differ from the source start date");
        }

        int repeats = (request.getRepeatCount() != null && request.getRepeatCount() > 1)
                ? request.getRepeatCount()
                : 1;
        long sourceSpanDays = ChronoUnit.DAYS.between(request.getSourceStart(), request.getSourceEnd()) + 1;
        LocalDate overallTargetEnd = request.getTargetStart().plusDays(sourceSpanDays * repeats - 1);
        validateRange(request.getTargetStart(), overallTargetEnd, MAX_BULK_DAYS);

        List<WorkSchedule> source = workScheduleRepository
                .search(request.getSourceStart(), request.getSourceEnd(), null, null, null);

        Set<Integer> accountIds = new LinkedHashSet<>();
        source.forEach(ws -> accountIds.add(ws.getAccount().getAccountId()));
        Map<Key, WorkSchedule> existing = loadExisting(accountIds, request.getTargetStart(), overallTargetEnd);

        BulkCollector out = new BulkCollector();
        for (int r = 0; r < repeats; r++) {
            long offset = baseOffset + (r * sourceSpanDays);
            for (WorkSchedule ws : source) {
                Account account = ws.getAccount();
                LocalDate targetDate = ws.getWorkDate().plusDays(offset);
                if (!isSchedulable(account)) {
                    out.skip(account, targetDate, "Account is no longer an active staff account");
                    continue;
                }
                // Days off carry over; attendance results (completed / absent) start fresh as SCHEDULED.
                ScheduleStatus status = ScheduleStatus.parse(ws.getStatus()) == ScheduleStatus.OFF
                        ? ScheduleStatus.OFF : ScheduleStatus.SCHEDULED;
                upsert(account, ws.getShift(), targetDate, ws.getNotes(), status,
                        request.isOverwrite(), existing, out);
            }
        }

        BulkScheduleResponse response = persist(out);
        auditLogService.log(MODULE, "COPY", TABLE, (Long) null,
                "Sao chép lịch làm việc từ " + request.getSourceStart() + " – " + request.getSourceEnd()
                        + " sang " + request.getTargetStart() + " – " + overallTargetEnd + " — " + summary(response));
        return response;
    }

    @Override
    @Transactional
    public void deleteSchedule(Integer id) {
        WorkSchedule ws = workScheduleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkSchedule", "id", id));
        if (cashierShiftRepository.existsByWorkSchedule_ScheduleId(id)) {
            throw new ConflictException("This schedule is linked to a cashier shift and cannot be deleted");
        }
        String desc = "Hủy phân ca trực ID #" + id + " của " +
                (ws.getAccount() != null ? ws.getAccount().getFullName() : "nhân viên") +
                " (ngày " + ws.getWorkDate() + ")";
        workScheduleRepository.deleteById(id);

        auditLogService.log(MODULE, "DELETE", TABLE, Long.valueOf(id), desc);
    }

    // ---------------------------------------------------------------- helpers

    /**
     * Enforces that only ADMIN or MANAGER can modify the status of a shift assignment.
     */
    private void requireAdminOrManagerForStatusChange() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Only ADMIN or MANAGER can modify shift status");
        }
        boolean allowed = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> "ROLE_ADMIN".equalsIgnoreCase(a)
                        || "ADMIN".equalsIgnoreCase(a)
                        || "ROLE_MANAGER".equalsIgnoreCase(a)
                        || "MANAGER".equalsIgnoreCase(a));
        if (!allowed) {
            throw new AccessDeniedException("Chỉ Admin và Manager mới được phép chỉnh sửa trạng thái (status) của ca làm việc");
        }
    }

    private Set<Integer> resolveAccountIds(BulkScheduleRequest request) {
        Set<Integer> ids = new LinkedHashSet<>();
        if (request.getAccountIds() != null) {
            for (Integer id : request.getAccountIds()) {
                if (id != null) ids.add(id);
            }
        }
        if (request.getAccountId() != null) {
            ids.add(request.getAccountId());
        }
        return ids;
    }

    /**
     * Resolves endDate from explicit endDate, repeatWeeks (n weeks), repeatMonths (n months),
     * or repeatCount + repeatUnit (DAY/WEEK/MONTH).
     */
    private LocalDate resolveRecurringEndDate(BulkScheduleRequest request) {
        LocalDate start = request.getStartDate();
        if (request.getEndDate() != null) {
            return request.getEndDate();
        }
        if (request.getRepeatWeeks() != null && request.getRepeatWeeks() > 0) {
            return start.plusWeeks(request.getRepeatWeeks()).minusDays(1);
        }
        if (request.getRepeatMonths() != null && request.getRepeatMonths() > 0) {
            return start.plusMonths(request.getRepeatMonths()).minusDays(1);
        }
        if (request.getRepeatCount() != null && request.getRepeatCount() > 0) {
            int count = request.getRepeatCount();
            String unit = request.getRepeatUnit() != null
                    ? request.getRepeatUnit().trim().toUpperCase(Locale.ROOT)
                    : "WEEK";
            return switch (unit) {
                case "DAY", "DAYS" -> start.plusDays(count).minusDays(1);
                case "MONTH", "MONTHS" -> start.plusMonths(count).minusDays(1);
                default -> start.plusWeeks(count).minusDays(1);
            };
        }
        // Fallback: single day on startDate if no endDate or repeat parameter was provided
        return start;
    }

    /**
     * Expands dates between [from, to] supporting:
     * - daysOfWeek filter (MONDAY..SUNDAY)
     * - repeatInterval (e.g. every K weeks or every K months)
     */
    private List<LocalDate> expandRecurringDates(LocalDate from, LocalDate to, BulkScheduleRequest request) {
        Set<DayOfWeek> daysOfWeek = request.getDaysOfWeek();
        int interval = (request.getRepeatInterval() != null && request.getRepeatInterval() > 1)
                ? request.getRepeatInterval()
                : 1;

        boolean isMonthlyInterval = interval > 1 && (
                (request.getRepeatMonths() != null && request.getRepeatMonths() > 0)
                        || (request.getRepeatUnit() != null && request.getRepeatUnit().trim().toUpperCase(Locale.ROOT).startsWith("MONTH"))
        );

        // If the user asked for monthly recurrence without specifying daysOfWeek,
        // and interval > 1 (or repeatMonths > 0 with same-day-of-month intent when daysOfWeek is null),
        // we still include all days matching daysOfWeek (or every day if daysOfWeek is empty).
        Set<DayOfWeek> effectiveDays = (daysOfWeek != null && !daysOfWeek.isEmpty())
                ? EnumSet.copyOf(daysOfWeek)
                : null;

        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (effectiveDays != null && !effectiveDays.contains(d.getDayOfWeek())) {
                continue;
            }
            if (interval > 1) {
                if (isMonthlyInterval) {
                    long monthsBetween = ChronoUnit.MONTHS.between(from.withDayOfMonth(1), d.withDayOfMonth(1));
                    if (monthsBetween % interval != 0) {
                        continue;
                    }
                } else {
                    long weeksBetween = ChronoUnit.DAYS.between(from, d) / 7;
                    if (weeksBetween % interval != 0) {
                        continue;
                    }
                }
            }
            dates.add(d);
        }
        return dates;
    }

    /** Creates, or (with overwrite) updates, one staff/day entry. Never touches attendance records. */
    private void upsert(Account account, Shift shift, LocalDate date, String notes, ScheduleStatus status,
                        boolean overwrite, Map<Key, WorkSchedule> existing, BulkCollector out) {
        Key key = new Key(account.getAccountId(), date);
        WorkSchedule current = existing.get(key);

        if (current == null) {
            WorkSchedule created = WorkSchedule.builder()
                    .account(account)
                    .shift(shift)
                    .workDate(date)
                    .status(status.name())
                    .notes(notes)
                    .build();
            out.created.add(created);
            existing.put(key, created);
            return;
        }

        if (current.getScheduleId() == null) {
            out.skip(account, date, "Duplicate entry in the same request");
            return;
        }
        if (!overwrite) {
            out.skip(account, date, "Already scheduled (" + shiftLabel(current.getShift()) + ")");
            return;
        }
        if (ScheduleStatus.parse(current.getStatus()).isAttendanceRecord()) {
            out.skip(account, date, "Already marked " + ScheduleStatus.parse(current.getStatus()).name());
            return;
        }
        boolean sameShift = Objects.equals(idOfShift(current.getShift()), shift.getShiftId());
        boolean sameStatus = ScheduleStatus.parse(current.getStatus()) == status;
        if (sameShift && sameStatus) {
            out.skip(account, date, "Already assigned to this shift");
            return;
        }
        if (cashierShiftRepository.existsByWorkSchedule_ScheduleId(current.getScheduleId())) {
            out.skip(account, date, "Linked to a cashier shift and cannot be replaced");
            return;
        }

        current.setShift(shift);
        current.setStatus(status.name());
        if (notes != null) {
            current.setNotes(notes);
        }
        out.updated.add(current);
    }

    private BulkScheduleResponse persist(BulkCollector out) {
        List<WorkSchedule> toSave = new ArrayList<>(out.created);
        toSave.addAll(out.updated);
        List<WorkSchedule> saved = toSave.isEmpty() ? List.of() : workScheduleRepository.saveAll(toSave);

        List<WorkScheduleResponse> schedules = saved.stream()
                .sorted(Comparator.comparing(WorkSchedule::getWorkDate)
                        .thenComparing(ws -> ws.getAccount().getFullName(),
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(WorkScheduleResponse::fromEntity)
                .toList();

        return BulkScheduleResponse.builder()
                .createdCount(out.created.size())
                .updatedCount(out.updated.size())
                .skippedCount(out.skipped.size())
                .schedules(schedules)
                .skipped(out.skipped)
                .build();
    }

    private Map<Key, WorkSchedule> loadExisting(Set<Integer> accountIds, LocalDate from, LocalDate to) {
        Map<Key, WorkSchedule> map = new HashMap<>();
        if (accountIds.isEmpty()) {
            return map;
        }
        for (WorkSchedule ws : workScheduleRepository
                .findByAccount_AccountIdInAndWorkDateBetween(accountIds, from, to)) {
            map.putIfAbsent(new Key(ws.getAccount().getAccountId(), ws.getWorkDate()), ws);
        }
        return map;
    }

    private List<Account> loadAccounts(Set<Integer> ids) {
        Map<Integer, Account> byId = new LinkedHashMap<>();
        accountRepository.findAllById(ids).forEach(a -> byId.put(a.getAccountId(), a));
        for (Integer id : ids) {
            if (!byId.containsKey(id)) {
                throw new ResourceNotFoundException("Account", "id", id);
            }
        }
        return ids.stream().map(byId::get).toList();
    }

    private Account loadAccount(Integer id) {
        return accountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", id));
    }

    private Shift loadShift(Integer id) {
        return shiftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Shift", "id", id));
    }

    private boolean hasScheduleOnDate(Integer accountId, LocalDate date, Integer ignoreScheduleId) {
        return workScheduleRepository.findByAccount_AccountIdAndWorkDate(accountId, date).stream()
                .anyMatch(ws -> !Objects.equals(ws.getScheduleId(), ignoreScheduleId));
    }

    private void requireSchedulable(Account account) {
        if (!isSchedulable(account)) {
            throw new IllegalArgumentException(
                    staffLabel(account) + " cannot be scheduled: only active staff accounts can be assigned shifts");
        }
    }

    private boolean isSchedulable(Account account) {
        if (account == null || account.getRole() == null || account.getRole().getRoleCode() == null) {
            return false;
        }
        if ("ROLE_CUSTOMER".equalsIgnoreCase(account.getRole().getRoleCode())) {
            return false;
        }
        String status = account.getStatus();
        return status == null
                || !("INACTIVE".equalsIgnoreCase(status) || "LOCKED".equalsIgnoreCase(status));
    }

    private ConflictException alreadyScheduled(Account account, LocalDate date) {
        return new ConflictException(account.getFullName() + " already has a shift scheduled on " + date);
    }

    private void validateRange(LocalDate from, LocalDate to, int maxDays) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("Both a start date and an end date are required");
        }
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("The end date must not be before the start date");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > maxDays) {
            throw new IllegalArgumentException("The date range must not exceed " + maxDays + " days");
        }
    }

    /** Accepts "RECEPTIONIST" or "ROLE_RECEPTIONIST"; blank means no role filter. */
    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        String code = role.trim().toUpperCase(Locale.ROOT);
        return code.startsWith("ROLE_") ? code : "ROLE_" + code;
    }

    private Integer idOf(Account account) {
        return account != null ? account.getAccountId() : null;
    }

    private Integer idOfShift(Shift shift) {
        return shift != null ? shift.getShiftId() : null;
    }

    private String shiftLabel(Shift shift) {
        if (shift == null) {
            return "(không rõ ca)";
        }
        return shift.getShiftName() + " (" + shift.getStartTime() + " - " + shift.getEndTime() + ")";
    }

    private String staffLabel(Account account) {
        return account.getFullName() + " (" + account.getUsername() + ")";
    }

    private String describe(WorkSchedule ws) {
        return (ws.getAccount() != null ? staffLabel(ws.getAccount()) : "?")
                + " | " + ws.getWorkDate()
                + " | " + shiftLabel(ws.getShift())
                + " | " + ScheduleStatus.parse(ws.getStatus()).name();
    }

    private String summary(BulkScheduleResponse r) {
        return "tạo " + r.getCreatedCount() + ", cập nhật " + r.getUpdatedCount() + ", bỏ qua " + r.getSkippedCount();
    }

    private record Key(Integer accountId, LocalDate date) {
    }

    private static final class BulkCollector {
        final List<WorkSchedule> created = new ArrayList<>();
        final List<WorkSchedule> updated = new ArrayList<>();
        final List<BulkScheduleResponse.SkippedItem> skipped = new ArrayList<>();

        void skip(Account account, LocalDate date, String reason) {
            skipped.add(BulkScheduleResponse.SkippedItem.builder()
                    .accountId(account.getAccountId())
                    .accountFullName(account.getFullName())
                    .workDate(date)
                    .reason(reason)
                    .build());
        }
    }
}
