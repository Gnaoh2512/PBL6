package com.example.pbl6.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "room_type")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_type_id")
    private Integer roomTypeId;

    @Column(name = "type_name", nullable = false, length = 100)
    private String typeName;

    @Column(name = "capacity")
    private Integer capacity;

    @Column(name = "base_price", precision = 15, scale = 2)
    private BigDecimal basePrice;

    @Column(name = "amenities", columnDefinition = "TEXT")
    private String amenities;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
}
