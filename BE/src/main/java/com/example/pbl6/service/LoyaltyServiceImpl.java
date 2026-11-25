package com.example.pbl6.service;

import com.example.pbl6.dto.loyalty.*;
import com.example.pbl6.entity.*;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoyaltyServiceImpl implements LoyaltyService {

    private static final String BENEFIT_ROOM_DISCOUNT = "ROOM_DISCOUNT";
    private static final String BENEFIT_FREE_SERVICE = "FREE_SERVICE";

    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final LoyaltyTierRepository loyaltyTierRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final TierBenefitRepository tierBenefitRepository;
    private final BenefitRedemptionRepository benefitRedemptionRepository;
    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final ServiceRepository serviceRepository;
    private final ServiceRequestRepository serviceRequestRepository;

    @Override
    @Transactional
    public LoyaltyProfileResponse getProfile(String username) {
        Customer customer = getCustomerByUsername(username);
        CustomerLoyalty loyalty = getOrCreateLoyalty(customer);

        List<LoyaltyTier> tiers = loyaltyTierRepository.findAll().stream()
                .sorted(Comparator.comparingInt(LoyaltyTier::getTierLevel))
                .toList();

        LoyaltyTier currentTier = loyalty.getTier();
        LoyaltyTier nextTier = tiers.stream()
                .filter(t -> t.getTierLevel() > currentTier.getTierLevel())
                .findFirst()
                .orElse(null);

        BigDecimal pointsToNextTier = BigDecimal.ZERO;
        String nextTierCode = null;
        String nextTierName = null;

        if (nextTier != null) {
            nextTierCode = nextTier.getTierCode();
            nextTierName = nextTier.getTierName();
            pointsToNextTier = nextTier.getMinScore().subtract(loyalty.getTotalScore()).max(BigDecimal.ZERO);
        }

        return LoyaltyProfileResponse.builder()
                .customerId(customer.getCustomerId())
                .fullName(customer.getFullName())
                .email(customer.getEmail())
                .phone(customer.getPhone())
                .tierCode(currentTier.getTierCode())
                .tierName(currentTier.getTierName())
                .tierLevel(currentTier.getTierLevel())
                .currentScore(loyalty.getTotalScore())
                .totalStayDays(loyalty.getTotalStayDays())
                .totalSpent(loyalty.getTotalSpent())
                .tierUpdatedAt(loyalty.getTierUpdatedAt())
                .memberSince(loyalty.getJoinedAt())
                .nextTierCode(nextTierCode)
                .nextTierName(nextTierName)
                .pointsToNextTier(pointsToNextTier)
                .build();
    }

    @Override
    @Transactional
    public List<LoyaltyTransactionResponse> getTransactions(String username) {
        Customer customer = getCustomerByUsername(username);
        return loyaltyTransactionRepository.findByCustomer_CustomerIdOrderByCreatedAtDesc(customer.getCustomerId())
                .stream()
                .map(LoyaltyTransactionResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<TierBenefitResponse> getAvailableBenefits(String username) {
        Customer customer = getCustomerByUsername(username);
        CustomerLoyalty loyalty = getOrCreateLoyalty(customer);

        // Show only manually usable benefits belonging to the customer's exact current tier.
        // ROOM_DISCOUNT is applied automatically by the billing calculation, not redeemed here.
        Integer currentTierId = loyalty.getTier() != null ? loyalty.getTier().getTierId() : null;
        List<TierBenefit> eligibleBenefits = currentTierId == null ? List.of()
                : tierBenefitRepository.findByTier_TierIdAndIsActiveTrue(currentTierId).stream()
                    .filter(b -> !BENEFIT_ROOM_DISCOUNT.equalsIgnoreCase(b.getBenefitType()))
                    .sorted(Comparator.comparing(TierBenefit::getTierBenefitId))
                    .toList();

        return eligibleBenefits.stream()
                .map(b -> toResponse(b, remainingQuota(customer.getCustomerId(), b)))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public TierBenefitResponse redeemBenefit(RedeemBenefitRequest req, String username) {
        Customer customer = getCustomerByUsername(username);

        // Row lock on the customer's loyalty record: two simultaneous requests are processed one
        // after the other, so the quota check below always sees the previous request.
        getOrCreateLoyalty(customer);
        CustomerLoyalty loyalty = customerLoyaltyRepository.findByCustomerIdForUpdate(customer.getCustomerId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hồ sơ thành viên"));

        TierBenefit benefit = tierBenefitRepository.findById(req.getTierBenefitId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đặc quyền: " + req.getTierBenefitId()));

        // A double click or retry carries the same key: answer with the first result, create nothing new.
        if (StringUtils.hasText(req.getIdempotencyKey())
                && benefitRedemptionRepository
                        .findFirstByCustomer_CustomerIdAndIdempotencyKey(customer.getCustomerId(), req.getIdempotencyKey().trim())
                        .isPresent()) {
            return toResponse(benefit, remainingQuota(customer.getCustomerId(), benefit));
        }

        if (Boolean.FALSE.equals(benefit.getIsActive())) {
            throw new IllegalStateException("Đặc quyền này hiện đang tạm ngưng áp dụng");
        }
        if (BENEFIT_ROOM_DISCOUNT.equalsIgnoreCase(benefit.getBenefitType())) {
            throw new IllegalArgumentException("Ưu đãi giảm giá phòng được tự động áp dụng vào hóa đơn, không cần yêu cầu thủ công");
        }
        if (loyalty.getTier() == null || benefit.getTier() == null
                || !loyalty.getTier().getTierId().equals(benefit.getTier().getTierId())) {
            throw new IllegalArgumentException("Chỉ có thể sử dụng đặc quyền thuộc hạng thành viên hiện tại của bạn");
        }
        if (benefit.getService() == null) {
            throw new IllegalStateException("Đặc quyền này chưa được gắn với dịch vụ cụ thể");
        }

        Integer remaining = remainingQuota(customer.getCustomerId(), benefit);
        if (remaining != null && remaining <= 0) {
            throw new IllegalStateException("Bạn đã sử dụng hết hạn mức ưu đãi này trong kỳ hiện tại");
        }

        if (!StringUtils.hasText(req.getBookingCode())) {
            throw new IllegalArgumentException("Vui lòng chọn đơn đặt phòng đang lưu trú để sử dụng dịch vụ miễn phí");
        }
        Booking booking = bookingRepository.findByBookingCode(req.getBookingCode().trim().toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + req.getBookingCode()));
        if (booking.getCustomer() == null || !customer.getCustomerId().equals(booking.getCustomer().getCustomerId())) {
            throw new IllegalArgumentException("Đơn đặt phòng không thuộc tài khoản của bạn");
        }
        if (!"CHECKED_IN".equalsIgnoreCase(booking.getStatus())) {
            throw new IllegalStateException("Chỉ có thể yêu cầu dịch vụ miễn phí khi đơn đặt phòng đã nhận phòng");
        }

        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        List<BookingRoom> checkedInRooms = bookingRooms.stream()
                .filter(br -> br.getRoom() != null && "CHECKED_IN".equalsIgnoreCase(br.getStatus()))
                .sorted(Comparator.comparing(br -> br.getRoom().getRoomId()))
                .toList();
        BookingRoom selectedRoom = checkedInRooms.size() == 1 ? checkedInRooms.get(0)
                : checkedInRooms.isEmpty() && bookingRooms.size() == 1 && bookingRooms.get(0).getRoom() != null
                    ? bookingRooms.get(0) : null;
        if (selectedRoom == null) {
            throw new IllegalStateException("Không xác định được duy nhất phòng đang lưu trú cho đơn đặt phòng này");
        }

        ServiceRequest serviceRequest = serviceRequestRepository.save(ServiceRequest.builder()
                .booking(booking)
                .room(selectedRoom.getRoom())
                .service(benefit.getService())
                .customer(customer)
                .quantity(1)
                .feeAmount(BigDecimal.ZERO)
                .status("PENDING")
                .note(LoyaltyBenefitSupport.buildNote(benefit, req.getNote()))
                .build());

        BigDecimal waivedValue = benefit.getService().getUnitPrice() != null ? benefit.getService().getUnitPrice() : BigDecimal.ZERO;
        benefitRedemptionRepository.save(BenefitRedemption.builder()
                .customer(customer)
                .tierBenefit(benefit)
                .booking(booking)
                .serviceRequest(serviceRequest)
                .idempotencyKey(StringUtils.hasText(req.getIdempotencyKey()) ? req.getIdempotencyKey().trim() : null)
                .valueAmount(waivedValue)
                .note(StringUtils.hasText(req.getNote()) ? req.getNote().trim() : null)
                .build());

        log.info("Khách hàng {} đã sử dụng đặc quyền #{} ({}) - Giá trị ưu đãi: {}",
                username, benefit.getTierBenefitId(), benefit.getBenefitName(), waivedValue);

        return toResponse(benefit, remaining != null ? remaining - 1 : null);
    }

    // ------------------------------------------------------------------ Quota helpers

    /** A free service may never be unlimited: with no quota configured it can be used once per period. */
    private static Integer effectiveQuota(TierBenefit benefit) {
        if (benefit.getQuota() != null) return benefit.getQuota();
        return BENEFIT_FREE_SERVICE.equalsIgnoreCase(benefit.getBenefitType()) ? Integer.valueOf(1) : null;
    }

    private static LocalDateTime periodStart(String periodType, LocalDateTime now) {
        if ("DAY".equalsIgnoreCase(periodType)) return now.toLocalDate().atStartOfDay();
        if ("MONTH".equalsIgnoreCase(periodType)) return LocalDateTime.of(now.getYear(), now.getMonthValue(), 1, 0, 0);
        return LocalDateTime.of(now.getYear(), 1, 1, 0, 0);
    }

    /** Uses left in the current period (voided uses do not count); null when the benefit has no limit. */
    private Integer remainingQuota(Integer customerId, TierBenefit benefit) {
        Integer quota = effectiveQuota(benefit);
        if (quota == null) return null;
        long used = benefitRedemptionRepository
                .countByCustomer_CustomerIdAndTierBenefit_TierBenefitIdAndStatusAndRedeemedAtGreaterThanEqual(
                        customerId, benefit.getTierBenefitId(), BenefitRedemption.STATUS_APPLIED,
                        periodStart(benefit.getPeriodType(), LocalDateTime.now()));
        return Math.max(0, quota - (int) used);
    }

    private static TierBenefitResponse toResponse(TierBenefit benefit, Integer remaining) {
        TierBenefitResponse response = TierBenefitResponse.fromEntity(benefit, remaining);
        response.setQuota(effectiveQuota(benefit));
        return response;
    }

    // ------------------------------------------------------------------ Admin CRUD for TierBenefit

    @Override
    @Transactional(readOnly = true)
    public List<TierBenefitResponse> getAllTierBenefits(Integer tierId) {
        List<TierBenefit> list = tierBenefitRepository.findAll();
        if (tierId != null) {
            list = list.stream()
                    .filter(b -> b.getTier() != null && tierId.equals(b.getTier().getTierId()))
                    .collect(Collectors.toList());
        }
        return list.stream()
                .sorted(Comparator.comparing((TierBenefit b) -> b.getTier() != null ? b.getTier().getTierLevel() : 0)
                        .thenComparing(TierBenefit::getTierBenefitId))
                .map(b -> toResponse(b, effectiveQuota(b)))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public TierBenefitResponse createTierBenefit(TierBenefitRequest req) {
        TierBenefit benefit = TierBenefit.builder()
                .tier(resolveTier(req.getTierId(), req.getTierCode()))
                .service(req.getServiceId() != null ? findService(req.getServiceId()) : null)
                .benefitType(req.getBenefitType().trim().toUpperCase())
                .benefitName(req.getBenefitName().trim())
                .discountPercent(req.getDiscountPercent())
                .quota(req.getQuota())
                .periodType(StringUtils.hasText(req.getPeriodType()) ? req.getPeriodType().trim().toUpperCase() : "YEAR")
                .isActive(req.getIsActive() != null ? req.getIsActive() : true)
                .description(req.getDescription())
                .build();
        validateBenefit(benefit);

        TierBenefit saved = tierBenefitRepository.save(benefit);
        return toResponse(saved, effectiveQuota(saved));
    }

    @Override
    @Transactional
    public TierBenefitResponse updateTierBenefit(Integer benefitId, TierBenefitRequest req) {
        TierBenefit benefit = tierBenefitRepository.findById(benefitId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đặc quyền #" + benefitId));

        if (req.getTierId() != null || StringUtils.hasText(req.getTierCode())) {
            benefit.setTier(resolveTier(req.getTierId(), req.getTierCode()));
        }
        if (req.getServiceId() != null) {
            benefit.setService(findService(req.getServiceId()));
        }
        if (StringUtils.hasText(req.getBenefitType())) {
            benefit.setBenefitType(req.getBenefitType().trim().toUpperCase());
        }
        if (StringUtils.hasText(req.getBenefitName())) {
            benefit.setBenefitName(req.getBenefitName().trim());
        }
        if (req.getDiscountPercent() != null) {
            benefit.setDiscountPercent(req.getDiscountPercent());
        }
        benefit.setQuota(req.getQuota());
        if (StringUtils.hasText(req.getPeriodType())) {
            benefit.setPeriodType(req.getPeriodType().trim().toUpperCase());
        }
        if (req.getIsActive() != null) {
            benefit.setIsActive(req.getIsActive());
        }
        if (req.getDescription() != null) {
            benefit.setDescription(req.getDescription());
        }
        validateBenefit(benefit);

        TierBenefit saved = tierBenefitRepository.save(benefit);
        return toResponse(saved, effectiveQuota(saved));
    }

    private com.example.pbl6.entity.Service findService(Integer serviceId) {
        return serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ #" + serviceId));
    }

    /** Only room discounts and free services exist; each has its own required fields. */
    private void validateBenefit(TierBenefit benefit) {
        String type = benefit.getBenefitType();
        if (BENEFIT_ROOM_DISCOUNT.equals(type)) {
            BigDecimal pct = benefit.getDiscountPercent();
            if (pct == null || pct.signum() <= 0 || pct.compareTo(BigDecimal.valueOf(100)) > 0) {
                throw new IllegalArgumentException("Phần trăm giảm giá phòng phải từ 1% đến 100%");
            }
            benefit.setService(null);
            benefit.setQuota(null);
        } else if (BENEFIT_FREE_SERVICE.equals(type)) {
            if (benefit.getService() == null) {
                throw new IllegalArgumentException("Đặc quyền dịch vụ miễn phí phải chọn dịch vụ áp dụng");
            }
            if (benefit.getQuota() == null || benefit.getQuota() < 1) {
                throw new IllegalArgumentException("Đặc quyền dịch vụ miễn phí phải có số lượt sử dụng tối thiểu là 1");
            }
            benefit.setDiscountPercent(null);
        } else {
            throw new IllegalArgumentException("Loại đặc quyền không hợp lệ (chỉ hỗ trợ giảm giá phòng hoặc dịch vụ miễn phí)");
        }
        if (!"DAY".equals(benefit.getPeriodType()) && !"MONTH".equals(benefit.getPeriodType()) && !"YEAR".equals(benefit.getPeriodType())) {
            throw new IllegalArgumentException("Chu kỳ áp dụng chỉ có thể là ngày, tháng hoặc năm");
        }
    }

    @Override
    @Transactional
    public void deleteTierBenefit(Integer benefitId) {
        TierBenefit benefit = tierBenefitRepository.findById(benefitId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đặc quyền #" + benefitId));
        try {
            tierBenefitRepository.delete(benefit);
            tierBenefitRepository.flush();
        } catch (Exception e) {
            // Nếu đã phát sinh lịch sử sử dụng (benefit_redemption), chuyển sang ngưng kích hoạt (soft delete)
            benefit.setIsActive(false);
            tierBenefitRepository.save(benefit);
        }
    }

    private LoyaltyTier resolveTier(Integer tierId, String tierCode) {
        if (tierId != null) {
            return loyaltyTierRepository.findById(tierId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng thành viên #" + tierId));
        }
        if (StringUtils.hasText(tierCode)) {
            return loyaltyTierRepository.findByTierCode(tierCode.trim().toUpperCase())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng thành viên: " + tierCode));
        }
        throw new IllegalArgumentException("Phải cung cấp tierId hoặc tierCode cho đặc quyền");
    }

    @Override
    @Transactional
    public void recordStayAndEarnPoints(Invoice invoice) {
        if (invoice == null || invoice.getBooking() == null) {
            return;
        }

        Booking booking = invoice.getBooking();
        Customer customer = booking.getCustomer();
        if (customer == null) {
            return;
        }

        CustomerLoyalty loyalty = getOrCreateLoyalty(customer);

        int stayDays = 1;
        if (booking.getCheckInDate() != null && booking.getCheckOutDate() != null) {
            long days = ChronoUnit.DAYS.between(booking.getCheckInDate(), booking.getCheckOutDate());
            stayDays = Math.max(1, (int) days);
        }

        BigDecimal amountSpent = invoice.getTotalAmount() != null ? invoice.getTotalAmount() : BigDecimal.ZERO;

        BigDecimal daysComponent = BigDecimal.valueOf(stayDays * 0.4);
        BigDecimal spentMillion = amountSpent.divide(BigDecimal.valueOf(1_000_000), 4, RoundingMode.HALF_UP);
        BigDecimal spentComponent = spentMillion.multiply(BigDecimal.valueOf(0.6));
        BigDecimal scoreEarned = daysComponent.add(spentComponent).setScale(2, RoundingMode.HALF_UP);

        LoyaltyTransaction txn = LoyaltyTransaction.builder()
                .customer(customer)
                .invoice(invoice)
                .txnType("EARN")
                .stayDays(stayDays)
                .amountSpent(amountSpent)
                .scoreEarned(scoreEarned)
                .note("Tích điểm tự động sau kỳ lưu trú mã " + booking.getBookingCode())
                .build();
        loyaltyTransactionRepository.save(txn);

        loyalty.setTotalStayDays(loyalty.getTotalStayDays() + stayDays);
        loyalty.setTotalSpent(loyalty.getTotalSpent().add(amountSpent));
        loyalty.setTotalScore(loyalty.getTotalScore().add(scoreEarned));

        evaluateAndUpgradeTier(loyalty);
        customerLoyaltyRepository.save(loyalty);

        log.info("Earned {} points for customer {} on invoice #{}", scoreEarned, customer.getCustomerId(), invoice.getInvoiceId());
    }

    @Override
    @Transactional
    public LoyaltyProfileResponse adjustPoints(AdjustPointsRequest req, String adminUsername) {
        Customer customer = customerRepository.findById(req.getCustomerId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khách hàng #" + req.getCustomerId()));

        Account admin = accountRepository.findByUsername(adminUsername)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản quản trị: " + adminUsername));

        CustomerLoyalty loyalty = getOrCreateLoyalty(customer);

        BigDecimal adjusted = req.getPoints() != null ? req.getPoints() : BigDecimal.ZERO;

        LoyaltyTransaction txn = LoyaltyTransaction.builder()
                .customer(customer)
                .createdBy(admin)
                .txnType("ADJUST")
                .scoreEarned(adjusted)
                .note(req.getNote() != null ? req.getNote() : "Quản trị viên điều chỉnh điểm thủ công")
                .build();
        loyaltyTransactionRepository.save(txn);

        loyalty.setTotalScore(loyalty.getTotalScore().add(adjusted).max(BigDecimal.ZERO));
        evaluateAndUpgradeTier(loyalty);
        customerLoyaltyRepository.save(loyalty);

        return LoyaltyProfileResponse.builder()
                .customerId(customer.getCustomerId())
                .fullName(customer.getFullName())
                .email(customer.getEmail())
                .phone(customer.getPhone())
                .tierCode(loyalty.getTier().getTierCode())
                .tierName(loyalty.getTier().getTierName())
                .tierLevel(loyalty.getTier().getTierLevel())
                .currentScore(loyalty.getTotalScore())
                .totalStayDays(loyalty.getTotalStayDays())
                .totalSpent(loyalty.getTotalSpent())
                .tierUpdatedAt(loyalty.getTierUpdatedAt())
                .memberSince(loyalty.getJoinedAt())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LoyaltyTier> getAllTiers() {
        return loyaltyTierRepository.findAll().stream()
                .sorted(Comparator.comparingInt(LoyaltyTier::getTierLevel))
                .collect(Collectors.toList());
    }

    private void evaluateAndUpgradeTier(CustomerLoyalty loyalty) {
        List<LoyaltyTier> tiers = loyaltyTierRepository.findAll().stream()
                .sorted(Comparator.comparingInt(LoyaltyTier::getTierLevel).reversed())
                .toList();

        for (LoyaltyTier tier : tiers) {
            if (loyalty.getTotalScore().compareTo(tier.getMinScore()) >= 0) {
                if (!tier.getTierId().equals(loyalty.getTier().getTierId())) {
                    if (tier.getTierLevel() > loyalty.getTier().getTierLevel()) {
                        log.info("Customer {} upgraded to tier {}", loyalty.getCustomerId(), tier.getTierCode());
                    }
                    loyalty.setTier(tier);
                    loyalty.setTierUpdatedAt(LocalDateTime.now());
                }
                break;
            }
        }
    }

    private Customer getCustomerByUsername(String username) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + username));

        Customer customer = customerRepository.findByAccount_Username(username).orElse(null);
        if (customer == null && account.getEmail() != null && !account.getEmail().isBlank()) {
            customer = customerRepository.findByEmail(account.getEmail()).orElse(null);
        }
        if (customer != null) {
            if (customer.getAccount() == null) {
                customer.setAccount(account);
                customerRepository.save(customer);
            }
            return customer;
        }
        if (account.getRole() == null || !"ROLE_CUSTOMER".equalsIgnoreCase(account.getRole().getRoleCode())) {
            throw new ResourceNotFoundException("Không tìm thấy thông tin khách hàng");
        }
        return customerRepository.save(Customer.builder()
                .account(account)
                .fullName(account.getFullName() != null ? account.getFullName() : account.getUsername())
                .email(account.getEmail())
                .phone(account.getPhone())
                .build());
    }

    private CustomerLoyalty getOrCreateLoyalty(Customer customer) {
        return customerLoyaltyRepository.findByCustomer_CustomerId(customer.getCustomerId())
                .orElseGet(() -> {
                    LoyaltyTier defaultTier = loyaltyTierRepository.findByTierCode("SEASHELL")
                            .orElseGet(() -> loyaltyTierRepository.findAll().get(0));

                    CustomerLoyalty cl = CustomerLoyalty.builder()
                            .customer(customer)
                            .tier(defaultTier)
                            .totalStayDays(0)
                            .totalSpent(BigDecimal.ZERO)
                            .totalScore(BigDecimal.ZERO)
                            .build();
                    return customerLoyaltyRepository.save(cl);
                });
    }
}
