package com.example.pbl6.service;

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

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface WorkScheduleService {
    List<WorkScheduleResponse> getAllSchedules();

    List<WorkScheduleResponse> getSchedulesByDate(LocalDate workDate);

    /**
     * Lấy bảng ca làm việc chi tiết của 1 ngày (khi nhấp vào 1 ngày trong lịch),
     * hỗ trợ lọc theo shiftId hoặc role nếu cần.
     */
    DayScheduleTableResponse getDayScheduleTable(LocalDate workDate, Integer shiftId, String role);

    /** Calendar query. accountId, shiftId and role (e.g. "RECEPTIONIST" or "ROLE_RECEPTIONIST") are optional. */
    List<WorkScheduleResponse> searchSchedules(LocalDate from, LocalDate to,
                                               Integer accountId, Integer shiftId, String role);

    List<WorkScheduleResponse> getMySchedules(Integer accountId, LocalDate from, LocalDate to);

    List<ScheduleStaffResponse> getSchedulableStaff();

    /**
     * Strict Shift Validation: Lấy danh sách nhân viên có lịch làm việc (work_schedule)
     * đang hoạt động đúng ca trực tại ngày (date), giờ (time) và vai trò (roleCode).
     */
    List<AvailableStaffInShiftResponse> getAvailableStaffInShift(LocalDate date, LocalTime time, String roleCode);

    /**
     * Kiểm tra một nhân viên cụ thể có đang trong ca trực hợp lệ hay không
     */
    boolean isStaffInActiveShift(Integer accountId, LocalDate date, LocalTime time);

    WorkScheduleResponse createSchedule(WorkScheduleRequest request);

    WorkScheduleResponse updateSchedule(Integer id, WorkScheduleUpdateRequest request);

    /**
     * Chỉ ADMIN và MANAGER được phép chỉnh sửa status của ca làm việc (SCHEDULED, COMPLETED, ABSENT, OFF).
     */
    WorkScheduleResponse updateScheduleStatus(Integer id, WorkScheduleStatusUpdateRequest request);

    /**
     * Chỉnh sửa hàng loạt (thêm/sửa/đổi status/xóa) ngay trong bảng ca làm việc của 1 ngày.
     */
    DayScheduleTableResponse batchUpdateDaySchedules(LocalDate workDate, DayScheduleBatchUpdateRequest request);

    /**
     * Đặt lịch hàng loạt hoặc lặp lại theo N tuần / N tháng.
     */
    BulkScheduleResponse bulkAssign(BulkScheduleRequest request);

    BulkScheduleResponse copySchedules(CopyScheduleRequest request);

    void deleteSchedule(Integer id);
}
