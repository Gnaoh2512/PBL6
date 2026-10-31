package com.example.pbl6.repository;

import com.example.pbl6.entity.VoucherRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VoucherRedemptionRepository extends JpaRepository<VoucherRedemption, Integer> {
    List<VoucherRedemption> findByCustomer_CustomerId(Integer customerId);
    List<VoucherRedemption> findByBooking_BookingId(Integer bookingId);
    long countByVoucher_VoucherId(Integer voucherId);
    long countByVoucher_VoucherIdAndCustomer_CustomerId(Integer voucherId, Integer customerId);
}
