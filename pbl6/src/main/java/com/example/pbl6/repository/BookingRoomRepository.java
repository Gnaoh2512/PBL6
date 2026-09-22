package com.example.pbl6.repository;

import com.example.pbl6.entity.BookingRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingRoomRepository extends JpaRepository<BookingRoom, Integer> {
    List<BookingRoom> findByBooking_BookingId(Integer bookingId);
    List<BookingRoom> findByRoom_RoomId(Integer roomId);
}
