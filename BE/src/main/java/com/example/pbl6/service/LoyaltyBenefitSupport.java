package com.example.pbl6.service;

import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.entity.BenefitRedemption;
import com.example.pbl6.entity.LoyaltyTier;
import com.example.pbl6.entity.ServiceRequest;
import com.example.pbl6.entity.TierBenefit;
import com.example.pbl6.repository.BenefitRedemptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Everything the screens need to know about service requests that were paid for with a
 * loyalty benefit: a readable note, the "loyalty" flag, and the zero-priced bill lines.
 */
@Component
@RequiredArgsConstructor
public class LoyaltyBenefitSupport {

    private static final String LEGACY_PREFIX = "[LOYALTY BENEFIT]";
    private static final String LEGACY_SEPARATOR = " — ";

    private final BenefitRedemptionRepository benefitRedemptionRepository;

    /** Note stored on the service request, e.g. "Hội viên hạng Ngọc Trai dùng ưu đãi miễn phí. Khách ghi chú: giao lúc 16h." */
    public static String buildNote(TierBenefit benefit, String guestNote) {
        StringBuilder note = new StringBuilder("Hội viên hạng ").append(shortTierName(benefit.getTier()))
                .append(" dùng ưu đãi miễn phí.");
        if (StringUtils.hasText(guestNote)) {
            note.append(" Khách ghi chú: ").append(guestNote.trim());
            if (!guestNote.trim().endsWith(".")) note.append('.');
        }
        return note.toString();
    }

    /** "Hạng Ngọc Trai (Pearl)" -> "Ngọc Trai" */
    static String shortTierName(LoyaltyTier tier) {
        if (tier == null || !StringUtils.hasText(tier.getTierName())) return "thành viên";
        String name = tier.getTierName().replaceAll("\\s*\\(.*\\)\\s*$", "").trim();
        if (name.regionMatches(true, 0, "Hạng ", 0, 5)) name = name.substring(5).trim();
        return name.isEmpty() ? "thành viên" : name;
    }

    /** Rows created before the note format changed look like "[LOYALTY BENEFIT] [TIER_BENEFIT #3] Name — guest note". */
    private static String displayNote(String stored, TierBenefit benefit) {
        if (stored == null || !stored.startsWith(LEGACY_PREFIX)) return stored;
        int sep = stored.indexOf(LEGACY_SEPARATOR);
        return buildNote(benefit, sep >= 0 ? stored.substring(sep + LEGACY_SEPARATOR.length()) : null);
    }

    public Map<Integer, BenefitRedemption> redemptionsByRequest(Collection<ServiceRequest> requests) {
        List<Integer> ids = requests.stream().map(ServiceRequest::getServiceRequestId).filter(i -> i != null).toList();
        Map<Integer, BenefitRedemption> map = new HashMap<>();
        if (ids.isEmpty()) return map;
        for (BenefitRedemption r : benefitRedemptionRepository.findByServiceRequest_ServiceRequestIdIn(ids)) {
            map.put(r.getServiceRequest().getServiceRequestId(), r);
        }
        return map;
    }

    public List<ServiceRequestResponse> toResponses(Collection<ServiceRequest> requests) {
        Map<Integer, BenefitRedemption> byRequest = redemptionsByRequest(requests);
        return requests.stream().map(r -> toResponse(r, byRequest.get(r.getServiceRequestId()))).collect(Collectors.toList());
    }

    public ServiceRequestResponse toResponse(ServiceRequest request) {
        return toResponses(List.of(request)).get(0);
    }

    private ServiceRequestResponse toResponse(ServiceRequest request, BenefitRedemption redemption) {
        ServiceRequestResponse response = ServiceRequestResponse.fromEntity(request);
        response.setIsLoyaltyBenefit(redemption != null);
        if (redemption != null) {
            response.setNote(displayNote(request.getNote(), redemption.getTierBenefit()));
        }
        return response;
    }

    /** Free-benefit lines for the guest bill: price 0, status follows the service request. */
    public List<ServiceUsageResponse> billLines(Integer bookingId) {
        return benefitRedemptionRepository.findByBooking_BookingIdAndServiceRequestIsNotNull(bookingId).stream()
                .map(r -> {
                    ServiceRequest sr = r.getServiceRequest();
                    com.example.pbl6.entity.Service service = sr.getService();
                    return ServiceUsageResponse.builder()
                            .serviceRequestId(sr.getServiceRequestId())
                            .serviceId(service != null ? service.getServiceId() : null)
                            .serviceName(service != null ? service.getServiceName() : r.getTierBenefit().getBenefitName())
                            .categoryName(service != null && service.getCategory() != null ? service.getCategory().getCategoryName() : "Khác")
                            .quantity(sr.getQuantity())
                            .unit(service != null ? service.getUnit() : "")
                            .unitPriceApplied(BigDecimal.ZERO)
                            .discountAmount(r.getValueAmount())
                            .totalPrice(BigDecimal.ZERO)
                            .status(sr.getStatus())
                            .usedAt(sr.getRequestedAt())
                            .loyaltyBenefit(true)
                            .benefitName(r.getTierBenefit().getBenefitName())
                            .build();
                })
                .collect(Collectors.toList());
    }

    /** Paid usages plus free-benefit lines, oldest first. */
    public List<ServiceUsageResponse> withBillLines(List<ServiceUsageResponse> usages, Integer bookingId) {
        List<ServiceUsageResponse> all = new java.util.ArrayList<>(usages);
        all.addAll(billLines(bookingId));
        all.sort(Comparator.comparing(ServiceUsageResponse::getUsedAt, Comparator.nullsLast(Comparator.naturalOrder())));
        return all;
    }
}
