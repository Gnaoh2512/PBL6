package com.example.pbl6.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "booking_room")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booking_room_id")
    private Integer bookingRoomId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @Column(name = "planned_checkin")
    private LocalDate plannedCheckin;

    @Column(name = "planned_checkout")
    private LocalDate plannedCheckout;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "actual_checkin")
    private LocalDateTime actualCheckin;

    @Column(name = "actual_checkout")
    private LocalDateTime actualCheckout;

    @Column(name = "price_applied", precision = 15, scale = 2)
    private BigDecimal priceApplied;
}
