package com.example.pbl6.repository;

import com.example.pbl6.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Integer> {
    List<Payment> findByBooking_BookingId(Integer bookingId);
    List<Payment> findByInvoice_InvoiceId(Integer invoiceId);
    List<Payment> findByCashierShift_CashierShiftId(Integer cashierShiftId);

    @Query("""
            SELECT p FROM Payment p
            LEFT JOIN FETCH p.booking b
            LEFT JOIN FETCH p.invoice i
            LEFT JOIN FETCH p.receivedBy r
            WHERE p.cashierShift.cashierShiftId = :shiftId
               OR (p.cashierShift IS NULL AND p.paidAt >= :startTime AND p.paidAt <= :endTime)
            ORDER BY p.paidAt DESC
            """)
    List<Payment> findPaymentsForShift(@Param("shiftId") Integer shiftId,
                                       @Param("startTime") LocalDateTime startTime,
                                       @Param("endTime") LocalDateTime endTime);
}
