package com.example.pbl6.repository;

import com.example.pbl6.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Integer> {
    Optional<Booking> findByBookingCode(String bookingCode);
    boolean existsByBookingCode(String bookingCode);
    List<Booking> findByCustomer_CustomerId(Integer customerId);
    List<Booking> findByCustomer_CustomerIdOrderByCreatedAtDesc(Integer customerId);
    List<Booking> findByCustomer_CustomerIdAndStatusOrderByCreatedAtDesc(Integer customerId, String status);
    List<Booking> findByCustomer_PhoneOrderByCreatedAtDesc(String phone);
    List<Booking> findByCustomer_PhoneAndStatusOrderByCreatedAtDesc(String phone, String status);
    List<Booking> findByStatus(String status);
    List<Booking> findByStatusAndCreatedAtBefore(String status, java.time.LocalDateTime time);
}
