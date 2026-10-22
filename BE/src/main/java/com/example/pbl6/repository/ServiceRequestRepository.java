package com.example.pbl6.repository;

import com.example.pbl6.entity.ServiceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Integer> {
    List<ServiceRequest> findByCustomer_CustomerId(Integer customerId);
    List<ServiceRequest> findByBooking_BookingId(Integer bookingId);
    List<ServiceRequest> findByRoom_RoomId(Integer roomId);
    List<ServiceRequest> findByStatus(String status);
    List<ServiceRequest> findByAssignedTo_AccountId(Integer accountId);
}
