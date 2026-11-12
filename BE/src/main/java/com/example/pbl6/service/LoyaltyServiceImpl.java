package com.example.pbl6.service;

import com.example.pbl6.dto.loyalty.*;
import com.example.pbl6.entity.*;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.*;
import com.example.pbl6.service.financial.FinancialCalculator;
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

    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final LoyaltyTierRepository loyaltyTierRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final TierBenefitRepository tierBenefitRepository;
    private final BenefitRedemptionRepository benefitRedemptionRepository;
    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final InvoiceRepository invoiceRepository;
    private final ServiceRepository serviceRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final ServiceUsageRepository serviceUsageRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final FinancialCalculator financialCalculator;

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

        Integer currentLevel = loyalty.getTier().getTierLevel();
        List<TierBenefit> eligibleBenefits = tierBenefitRepository.findByTier_TierLevelLessThanEqualAndIsActiveTrue(currentLevel);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfYear = LocalDateTime.of(now.getYear(), 1, 1, 0, 0);
        LocalDateTime startOfMonth = LocalDateTime.of(now.getYear(), now.getMonthValue(), 1, 0, 0);
        LocalDateTime startOfDay = now.toLocalDate().atStartOfDay();

        return eligibleBenefits.stream().map(b -> {
            Integer remaining = null;
            if (b.getQuota() != null) {
                String periodType = b.getPeriodType();
                LocalDateTime periodStart = "DAY".equalsIgnoreCase(periodType) ? startOfDay
                        : "MONTH".equalsIgnoreCase(periodType) ? startOfMonth
                        : startOfYear;
                long used = benefitRedemptionRepository.countByCustomer_CustomerIdAndTierBenefit_TierBenefitIdAndRedeemedAtAfter(
                        customer.getCustomerId(), b.getTierBenefitId(), periodStart);
                remaining = Math.max(0, b.getQuota() - (int) used);
            }
            return TierBenefitResponse.fromEntity(b, remaining);
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public TierBenefitResponse redeemBenefit(RedeemBenefitRequest req, String username) {
        Customer customer = getCustomerByUsername(username);
        CustomerLoyalty loyalty = getOrCreateLoyalty(customer);

        TierBenefit benefit = tierBenefitRepository.findById(req.getTierBenefitId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đặc quyền: " + req.getTierBenefitId()));

        if (Boolean.FALSE.equals(benefit.getIsActive())) {
            throw new IllegalStateException("Đặc quyền này hiện đang tạm ngưng áp dụng");
        }

        if (loyalty.getTier() != null && loyalty.getTier().getTierLevel() < benefit.getTier().getTierLevel()) {
            throw new IllegalArgumentException("Hạng thành viên của bạn chưa đủ điều kiện sử dụng đặc quyền này");
        }

        LocalDateTime now = LocalDateTime.now();
        String periodType = benefit.getPeriodType();
        LocalDateTime periodStart = "DAY".equalsIgnoreCase(periodType) ? now.toLocalDate().atStartOfDay()
                : "MONTH".equalsIgnoreCase(periodType) ? LocalDateTime.of(now.getYear(), now.getMonthValue(), 1, 0, 0)
                : LocalDateTime.of(now.getYear(), 1, 1, 0, 0);

        long used = benefitRedemptionRepository.countByCustomer_CustomerIdAndTierBenefit_TierBenefitIdAndRedeemedAtAfter(
                customer.getCustomerId(), benefit.getTierBenefitId(), periodStart);

        if (benefit.getQuota() != null && used >= benefit.getQuota()) {
            throw new IllegalStateException("Bạn đã sử dụng hết hạn mức ưu đãi này trong kỳ hiện tại");
        }

        Booking booking = null;
        if (req.getBookingId() != null) {
            booking = bookingRepository.findById(req.getBookingId()).orElse(null);
        } else if (req.getBookingCode() != null && !req.getBookingCode().isBlank()) {
            booking = bookingRepository.findByBookingCode(req.getBookingCode().trim().toUpperCase()).orElse(null);
        }

        ServiceUsage serviceUsage = null;
        if (req.getServiceUsageId() != null) {
            serviceUsage = serviceUsageRepository.findById(req.getServiceUsageId()).orElse(null);
            if (serviceUsage != null && booking == null) {
                booking = serviceUsage.getBooking();
            }
        }

        Invoice activeInvoice = null;
        if (booking != null) {
            activeInvoice = invoiceRepository.findByBooking_BookingId(booking.getBookingId()).stream()
                    .filter(inv -> !"CANCELED".equalsIgnoreCase(inv.getStatus()))
                    .findFirst()
                    .orElse(null);
        }

        // Tính toán giá trị ưu đãi thực tế áp dụng vào đơn đặt phòng hoặc dịch vụ
        BigDecimal discountedValue = calculateAndApplyBenefitDiscount(benefit, booking, activeInvoice, serviceUsage, req.getServiceRequestId());

        BenefitRedemption redemption = BenefitRedemption.builder()
                .customer(customer)
                .tierBenefit(benefit)
                .booking(booking)
                .invoice(activeInvoice)
                .serviceUsage(serviceUsage)
                .valueAmount(discountedValue)
                .note(req.getNote() != null ? req.getNote() : "Áp dụng đặc quyền hội viên: " + benefit.getBenefitName())
                .build();
        benefitRedemptionRepository.save(redemption);

        log.info("Khách hàng {} đã sử dụng đặc quyền #{} ({}) - Giá trị ưu đãi: {}",
                username, benefit.getTierBenefitId(), benefit.getBenefitName(), discountedValue);

        Integer remaining = benefit.getQuota() != null ? Math.max(0, benefit.getQuota() - (int) used - 1) : null;
        return TierBenefitResponse.fromEntity(benefit, remaining);
    }

    private BigDecimal calculateAndApplyBenefitDiscount(
            TierBenefit benefit,
            Booking booking,
            Invoice activeInvoice,
            ServiceUsage serviceUsage,
            Integer serviceRequestId
    ) {
        String type = benefit.getBenefitType() != null ? benefit.getBenefitType().toUpperCase() : "";
        BigDecimal valueAmount = BigDecimal.ZERO;

        if ("FREE_SERVICE".equalsIgnoreCase(type)) {
            if (serviceUsage != null) {
                valueAmount = serviceUsage.getTotalPrice() != null ? serviceUsage.getTotalPrice() : BigDecimal.ZERO;
                serviceUsage.setDiscountAmount(valueAmount);
                serviceUsage.setTotalPrice(BigDecimal.ZERO);
                serviceUsageRepository.save(serviceUsage);
            } else if (serviceRequestId != null) {
                ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId).orElse(null);
                if (sr != null) {
                    valueAmount = sr.getFeeAmount() != null ? sr.getFeeAmount() : BigDecimal.ZERO;
                    sr.setFeeAmount(BigDecimal.ZERO);
                    serviceRequestRepository.save(sr);
                }
            } else if (benefit.getService() != null && benefit.getService().getUnitPrice() != null) {
                valueAmount = benefit.getService().getUnitPrice();
            }
        } else if ("FREE_NIGHT".equalsIgnoreCase(type) && booking != null) {
            List<BookingRoom> brs = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
            if (!brs.isEmpty() && brs.get(0).getPriceApplied() != null) {
                valueAmount = brs.get(0).getPriceApplied();
            } else if (benefit.getRoomType() != null && benefit.getRoomType().getBasePrice() != null) {
                valueAmount = benefit.getRoomType().getBasePrice();
            }
        } else if ("ROOM_DISCOUNT".equalsIgnoreCase(type)) {
            BigDecimal pct = benefit.getDiscountPercent() != null ? benefit.getDiscountPercent() : BigDecimal.ZERO;
            if (booking != null) {
                List<BookingRoom> brs = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
                BigDecimal pricePerNight = (!brs.isEmpty() && brs.get(0).getPriceApplied() != null)
                        ? brs.get(0).getPriceApplied()
                        : BigDecimal.ZERO;
                long nights = financialCalculator.calculateNights(booking.getCheckInDate(), booking.getCheckOutDate());
                BigDecimal roomCharge = financialCalculator.calculateTotalRoomCharge(pricePerNight, nights);
                valueAmount = roomCharge.multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            } else {
                valueAmount = pct;
            }
        }

        // Nếu có Invoice đang mở, cộng dồn chiết khấu vào Invoice
        if (activeInvoice != null && valueAmount.compareTo(BigDecimal.ZERO) > 0 && !"FREE_SERVICE".equalsIgnoreCase(type)) {
            BigDecimal currentDiscount = activeInvoice.getDiscountAmount() != null ? activeInvoice.getDiscountAmount() : BigDecimal.ZERO;
            BigDecimal newDiscount = currentDiscount.add(valueAmount);
            activeInvoice.setDiscountAmount(newDiscount);

            BigDecimal roomCharge = activeInvoice.getRoomCharge() != null ? activeInvoice.getRoomCharge() : BigDecimal.ZERO;
            BigDecimal serviceCharge = activeInvoice.getServiceCharge() != null ? activeInvoice.getServiceCharge() : BigDecimal.ZERO;
            BigDecimal subtotal = roomCharge.add(serviceCharge);
            BigDecimal tax = financialCalculator.calculateTax(subtotal);
            activeInvoice.setTaxAmount(tax);

            BigDecimal depositApplied = activeInvoice.getDepositApplied() != null ? activeInvoice.getDepositApplied() : BigDecimal.ZERO;
            BigDecimal finalTotal = subtotal.add(tax).subtract(newDiscount).subtract(depositApplied);
            activeInvoice.setTotalAmount(finalTotal.compareTo(BigDecimal.ZERO) > 0 ? finalTotal : BigDecimal.ZERO);
            invoiceRepository.save(activeInvoice);
        }

        if (booking != null && valueAmount.compareTo(BigDecimal.ZERO) > 0) {
            String noteAppend = "Áp dụng đặc quyền " + benefit.getBenefitName() + " (-" + valueAmount.longValue() + "đ)";
            booking.setNote(StringUtils.hasText(booking.getNote()) ? booking.getNote() + " | " + noteAppend : noteAppend);
            bookingRepository.save(booking);
        }

        return valueAmount;
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
                .map(b -> TierBenefitResponse.fromEntity(b, b.getQuota()))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public TierBenefitResponse getTierBenefitById(Integer benefitId) {
        TierBenefit benefit = tierBenefitRepository.findById(benefitId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đặc quyền #" + benefitId));
        return TierBenefitResponse.fromEntity(benefit, benefit.getQuota());
    }

    @Override
    @Transactional
    public TierBenefitResponse createTierBenefit(TierBenefitRequest req) {
        LoyaltyTier tier = resolveTier(req.getTierId(), req.getTierCode());

        com.example.pbl6.entity.Service service = null;
        if (req.getServiceId() != null) {
            service = serviceRepository.findById(req.getServiceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ #" + req.getServiceId()));
        }

        RoomType roomType = null;
        if (req.getRoomTypeId() != null) {
            roomType = roomTypeRepository.findById(req.getRoomTypeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng #" + req.getRoomTypeId()));
        }

        TierBenefit benefit = TierBenefit.builder()
                .tier(tier)
                .service(service)
                .roomType(roomType)
                .benefitType(req.getBenefitType().trim().toUpperCase())
                .benefitName(req.getBenefitName().trim())
                .discountPercent(req.getDiscountPercent())
                .quota(req.getQuota())
                .periodType(StringUtils.hasText(req.getPeriodType()) ? req.getPeriodType().trim().toUpperCase() : "YEAR")
                .isActive(req.getIsActive() != null ? req.getIsActive() : true)
                .description(req.getDescription())
                .build();

        TierBenefit saved = tierBenefitRepository.save(benefit);
        return TierBenefitResponse.fromEntity(saved, saved.getQuota());
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
            com.example.pbl6.entity.Service service = serviceRepository.findById(req.getServiceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ #" + req.getServiceId()));
            benefit.setService(service);
        }
        if (req.getRoomTypeId() != null) {
            RoomType roomType = roomTypeRepository.findById(req.getRoomTypeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng #" + req.getRoomTypeId()));
            benefit.setRoomType(roomType);
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

        TierBenefit saved = tierBenefitRepository.save(benefit);
        return TierBenefitResponse.fromEntity(saved, saved.getQuota());
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
