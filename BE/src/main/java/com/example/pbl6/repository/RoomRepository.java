package com.example.pbl6.repository;

import com.example.pbl6.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Integer> {
    Optional<Room> findByRoomNumber(String roomNumber);
    boolean existsByRoomNumber(String roomNumber);
    List<Room> findByStatus(String status);

    @org.springframework.data.jpa.repository.Query("SELECT r FROM Room r " +
            "JOIN FETCH r.roomType rt " +
            "WHERE r.status = 'AVAILABLE' " +
            "AND (:roomTypeId IS NULL OR rt.roomTypeId = :roomTypeId) " +
            "AND (:guestCount IS NULL OR rt.capacity >= :guestCount) " +
            "AND (:minPrice IS NULL OR rt.basePrice >= :minPrice) " +
            "AND (:maxPrice IS NULL OR rt.basePrice <= :maxPrice) " +
            "AND r.roomId NOT IN (" +
            "    SELECT br.room.roomId FROM BookingRoom br " +
            "    JOIN br.booking b " +
            "    WHERE (b.status IS NULL OR b.status NOT IN ('CANCELED', 'EXPIRED')) " +
            "    AND br.plannedCheckin < :checkOutDate " +
            "    AND br.plannedCheckout > :checkInDate" +
            ") " +
            "ORDER BY rt.basePrice ASC, r.roomNumber ASC")
    List<Room> findAvailableRooms(
            @org.springframework.data.repository.query.Param("checkInDate") java.time.LocalDate checkInDate,
            @org.springframework.data.repository.query.Param("checkOutDate") java.time.LocalDate checkOutDate,
            @org.springframework.data.repository.query.Param("roomTypeId") Integer roomTypeId,
            @org.springframework.data.repository.query.Param("guestCount") Integer guestCount,
            @org.springframework.data.repository.query.Param("minPrice") java.math.BigDecimal minPrice,
            @org.springframework.data.repository.query.Param("maxPrice") java.math.BigDecimal maxPrice
    );
}
