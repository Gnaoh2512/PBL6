package com.example.pbl6.service;

import com.example.pbl6.dto.schedule.BulkScheduleRequest;
import com.example.pbl6.dto.schedule.BulkScheduleResponse;
import com.example.pbl6.dto.schedule.CopyScheduleRequest;
import com.example.pbl6.dto.schedule.ScheduleStaffResponse;
import com.example.pbl6.dto.schedule.WorkScheduleRequest;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;
import com.example.pbl6.dto.schedule.WorkScheduleUpdateRequest;

import java.time.LocalDate;
import java.util.List;

public interface WorkScheduleService {
    List<WorkScheduleResponse> getAllSchedules();

    List<WorkScheduleResponse> getSchedulesByDate(LocalDate workDate);

    /** Calendar query. accountId, shiftId and role (e.g. "RECEPTIONIST" or "ROLE_RECEPTIONIST") are optional. */
    List<WorkScheduleResponse> searchSchedules(LocalDate from, LocalDate to,
                                               Integer accountId, Integer shiftId, String role);

    List<WorkScheduleResponse> getMySchedules(Integer accountId, LocalDate from, LocalDate to);

    List<ScheduleStaffResponse> getSchedulableStaff();

    WorkScheduleResponse createSchedule(WorkScheduleRequest request);

    WorkScheduleResponse updateSchedule(Integer id, WorkScheduleUpdateRequest request);

    BulkScheduleResponse bulkAssign(BulkScheduleRequest request);

    BulkScheduleResponse copySchedules(CopyScheduleRequest request);

    void deleteSchedule(Integer id);
}
