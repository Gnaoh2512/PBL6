package com.example.pbl6.repository;

import com.example.pbl6.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Integer> {
    List<Payment> findByBooking_BookingId(Integer bookingId);
    List<Payment> findByInvoice_InvoiceId(Integer invoiceId);
    List<Payment> findByCashierShift_CashierShiftId(Integer cashierShiftId);
}
