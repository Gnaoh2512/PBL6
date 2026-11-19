package com.example.pbl6.repository;

import com.example.pbl6.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Integer> {
    List<Invoice> findByBooking_BookingId(Integer bookingId);
    List<Invoice> findByStatus(String status);
}
