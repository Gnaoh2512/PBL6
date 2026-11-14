package com.example.pbl6.dto.servicerequest;

import com.example.pbl6.entity.ServiceRequest;
import com.example.pbl6.entity.BenefitRedemption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceRequestResponse {
    private Integer serviceRequestId;
    private Integer bookingId;
    private String bookingCode;
    private Integer roomId;
    private String roomNumber;
    private Integer serviceId;
    private String serviceName;
    private Integer customerId;
    private String customerName;
    private Integer assignedToId;
    private String assignedToStaff;
    private Integer quantity;
    private BigDecimal feeAmount;
    private String status;
    private String note;
    private LocalDateTime requestedAt;
    private LocalDateTime completedAt;
    private Boolean isLoyaltyBenefit;
    private Integer benefitRedemptionId;
    private Integer tierBenefitId;
    private String benefitName;
    private String benefitType;

    public static ServiceRequestResponse fromEntity(ServiceRequest entity) {
        return fromEntity(entity, null);
    }

    public static ServiceRequestResponse fromEntity(ServiceRequest entity, BenefitRedemption redemption) {
        if (entity == null) {
            return null;
        }
        return ServiceRequestResponse.builder()
                .serviceRequestId(entity.getServiceRequestId())
                .bookingId(entity.getBooking() != null ? entity.getBooking().getBookingId() : null)
                .bookingCode(entity.getBooking() != null ? entity.getBooking().getBookingCode() : null)
                .roomId(entity.getRoom() != null ? entity.getRoom().getRoomId() : null)
                .roomNumber(entity.getRoom() != null ? entity.getRoom().getRoomNumber() : null)
                .serviceId(entity.getService() != null ? entity.getService().getServiceId() : null)
                .serviceName(entity.getService() != null ? entity.getService().getServiceName() : null)
                .customerId(entity.getCustomer() != null ? entity.getCustomer().getCustomerId() : null)
                .customerName(entity.getCustomer() != null ? entity.getCustomer().getFullName() : null)
                .assignedToId(entity.getAssignedTo() != null ? entity.getAssignedTo().getAccountId() : null)
                .assignedToStaff(entity.getAssignedTo() != null ? entity.getAssignedTo().getFullName() : null)
                .quantity(entity.getQuantity())
                .feeAmount(entity.getFeeAmount())
                .status(entity.getStatus())
                .note(entity.getNote())
                .requestedAt(entity.getRequestedAt())
                .completedAt(entity.getCompletedAt())
                .isLoyaltyBenefit(redemption != null
                        && redemption.getTierBenefit() != null
                        && "FREE_SERVICE".equalsIgnoreCase(redemption.getTierBenefit().getBenefitType()))
                .benefitRedemptionId(redemption != null ? redemption.getRedemptionId() : null)
                .tierBenefitId(redemption != null && redemption.getTierBenefit() != null
                        ? redemption.getTierBenefit().getTierBenefitId() : null)
                .benefitName(redemption != null && redemption.getTierBenefit() != null
                        ? redemption.getTierBenefit().getBenefitName() : null)
                .benefitType(redemption != null && redemption.getTierBenefit() != null
                        ? redemption.getTierBenefit().getBenefitType() : null)
                .build();
    }
}
