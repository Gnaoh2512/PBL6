package com.example.pbl6.repository;

import com.example.pbl6.entity.ServiceUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceUsageRepository extends JpaRepository<ServiceUsage, Integer> {
    List<ServiceUsage> findByBooking_BookingId(Integer bookingId);
    List<ServiceUsage> findByInvoice_InvoiceId(Integer invoiceId);
}
