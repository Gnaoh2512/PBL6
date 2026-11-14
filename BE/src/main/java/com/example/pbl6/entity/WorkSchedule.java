package com.example.pbl6.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(
        name = "work_schedule",
        uniqueConstraints = @UniqueConstraint(name = "uq_staff_work_date", columnNames = {"account_id", "work_date"})
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_id")
    private Integer scheduleId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "account_id")
    private Account account;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "shift_id")
    private Shift shift;

    @Column(name = "work_date")
    private LocalDate workDate;

    /** SCHEDULED | COMPLETED | ABSENT | OFF (see ScheduleStatus). Null is treated as SCHEDULED. */
    @Builder.Default
    @Column(name = "status", length = 30, columnDefinition = "varchar(30) default 'SCHEDULED'")
    private String status = "SCHEDULED";

    @Column(name = "note", columnDefinition = "text")
    private String notes;
}
