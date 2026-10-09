package com.example.pbl6.service;

import com.example.pbl6.dto.schedule.WorkScheduleRequest;
import com.example.pbl6.dto.schedule.WorkScheduleResponse;

import java.time.LocalDate;
import java.util.List;

public interface WorkScheduleService {
    List<WorkScheduleResponse> getAllSchedules();
    List<WorkScheduleResponse> getSchedulesByDate(LocalDate workDate);
    WorkScheduleResponse createSchedule(WorkScheduleRequest request);
    void deleteSchedule(Integer id);
}