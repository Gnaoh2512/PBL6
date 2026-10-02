package com.example.pbl6.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cashier_shift")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashierShift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cashier_shift_id")
    private Integer cashierShiftId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id")
    private WorkSchedule workSchedule;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "opening_cash", precision = 15, scale = 2)
    private BigDecimal openingCash;

    @Column(name = "closing_cash_actual", precision = 15, scale = 2)
    private BigDecimal closingCashActual;

    @Column(name = "status", length = 50)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "received_by")
    private Account receivedBy;

    @Column(name = "handover_note", columnDefinition = "TEXT")
    private String handoverNote;
}
