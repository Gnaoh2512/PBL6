package com.example.pbl6.service;

import com.example.pbl6.common.enums.ScheduleStatus;
import com.example.pbl6.dto.schedule.BulkScheduleRequest;
import com.example.pbl6.dto.schedule.BulkScheduleResponse;
import com.example.pbl6.dto.schedule.CopyScheduleRequest;
import com.example.pbl6.dto.schedule.ScheduleStaffResponse;
import com.example.pbl6.dto.schedule.WorkScheduleRequest;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
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

    /** Longest range a calendar query may cover (a month view with padding is at most ~42 days). */
    private static final int MAX_QUERY_DAYS = 93;
    /** Longest range a bulk assign / copy may cover. */
    private static final int MAX_BULK_DAYS = 62;

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
        return workScheduleRepository.findByWorkDate(workDate).stream()
                .map(WorkScheduleResponse::fromEntity)
                .toList();
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

    // ----------------------------------------------------------------- writes

    @Override
    @Transactional
    public WorkScheduleResponse createSchedule(WorkScheduleRequest request) {
        Account account = loadAccount(request.getAccountId());
        Shift shift = loadShift(request.getShiftId());
        requireSchedulable(account);
        ScheduleStatus status = ScheduleStatus.parse(request.getStatus());

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

        Account newAccount = request.getAccountId() != null ? loadAccount(request.getAccountId()) : ws.getAccount();
        Shift newShift = request.getShiftId() != null ? loadShift(request.getShiftId()) : ws.getShift();
        LocalDate newDate = request.getWorkDate() != null ? request.getWorkDate() : ws.getWorkDate();
        ScheduleStatus newStatus = request.getStatus() != null
                ? ScheduleStatus.parse(request.getStatus())
                : ScheduleStatus.parse(ws.getStatus());

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
    public BulkScheduleResponse bulkAssign(BulkScheduleRequest request) {
        validateRange(request.getStartDate(), request.getEndDate(), MAX_BULK_DAYS);

        Shift shift = loadShift(request.getShiftId());
        Set<Integer> accountIds = new LinkedHashSet<>(request.getAccountIds());
        List<Account> accounts = loadAccounts(accountIds);
        accounts.forEach(this::requireSchedulable);

        List<LocalDate> dates = expandDates(request.getStartDate(), request.getEndDate(), request.getDaysOfWeek());
        if (dates.isEmpty()) {
            throw new IllegalArgumentException("No dates in the selected range match the chosen days of the week");
        }

        Map<Key, WorkSchedule> existing = loadExisting(accountIds, request.getStartDate(), request.getEndDate());
        BulkCollector out = new BulkCollector();
        for (Account account : accounts) {
            for (LocalDate date : dates) {
                upsert(account, shift, date, request.getNotes(), ScheduleStatus.SCHEDULED,
                        request.isOverwrite(), existing, out);
            }
        }

        BulkScheduleResponse response = persist(out);
        auditLogService.log(MODULE, "BULK_ASSIGN", TABLE, (Long) null,
                "Phân ca hàng loạt: " + shiftLabel(shift) + " cho " + accounts.size() + " nhân viên từ "
                        + request.getStartDate() + " đến " + request.getEndDate() + " — " + summary(response));
        return response;
    }

    @Override
    @Transactional
    public BulkScheduleResponse copySchedules(CopyScheduleRequest request) {
        validateRange(request.getSourceStart(), request.getSourceEnd(), MAX_BULK_DAYS);
        long offset = ChronoUnit.DAYS.between(request.getSourceStart(), request.getTargetStart());
        if (offset == 0) {
            throw new IllegalArgumentException("The target start date must differ from the source start date");
        }

        List<WorkSchedule> source = workScheduleRepository
                .search(request.getSourceStart(), request.getSourceEnd(), null, null, null);

        LocalDate targetEnd = request.getSourceEnd().plusDays(offset);
        Set<Integer> accountIds = new LinkedHashSet<>();
        source.forEach(ws -> accountIds.add(ws.getAccount().getAccountId()));
        Map<Key, WorkSchedule> existing = loadExisting(accountIds, request.getTargetStart(), targetEnd);

        BulkCollector out = new BulkCollector();
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

        BulkScheduleResponse response = persist(out);
        auditLogService.log(MODULE, "COPY", TABLE, (Long) null,
                "Sao chép lịch làm việc từ " + request.getSourceStart() + " – " + request.getSourceEnd()
                        + " sang " + request.getTargetStart() + " – " + targetEnd + " — " + summary(response));
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

    private List<LocalDate> expandDates(LocalDate from, LocalDate to, Set<DayOfWeek> daysOfWeek) {
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (daysOfWeek == null || daysOfWeek.isEmpty() || daysOfWeek.contains(d.getDayOfWeek())) {
                dates.add(d);
            }
        }
        return dates;
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
