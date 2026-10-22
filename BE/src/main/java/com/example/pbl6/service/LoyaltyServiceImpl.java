package com.example.pbl6.service;

import com.example.pbl6.dto.loyalty.*;
import com.example.pbl6.entity.*;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Override
    @Transactional
    public LoyaltyProfileResponse getProfile(String username) {
        Customer customer = getCustomerByUsername(username);
        CustomerLoyalty loyalty = getOrCreateLoyalty(customer);

        // Tìm hạng tiếp theo
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
    @Transactional(readOnly = true)
    public List<LoyaltyTransactionResponse> getTransactions(String username) {
        Customer customer = getCustomerByUsername(username);
        return loyaltyTransactionRepository.findByCustomer_CustomerIdOrderByCreatedAtDesc(customer.getCustomerId())
                .stream()
                .map(LoyaltyTransactionResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<TierBenefitResponse> getAvailableBenefits(String username) {
        Customer customer = getCustomerByUsername(username);
        CustomerLoyalty loyalty = getOrCreateLoyalty(customer);

        Integer currentLevel = loyalty.getTier().getTierLevel();
        List<TierBenefit> eligibleBenefits = tierBenefitRepository.findByTier_TierLevelLessThanEqualAndIsActiveTrue(currentLevel);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfYear = LocalDateTime.of(now.getYear(), 1, 1, 0, 0);
        LocalDateTime startOfMonth = LocalDateTime.of(now.getYear(), now.getMonthValue(), 1, 0, 0);

        return eligibleBenefits.stream().map(b -> {
            Integer remaining = null;
            if (b.getQuota() != null) {
                LocalDateTime periodStart = "MONTH".equalsIgnoreCase(b.getPeriodType()) ? startOfMonth : startOfYear;
                long used = benefitRedemptionRepository.countByCustomer_CustomerIdAndTierBenefit_TierBenefitIdAndRedeemedAtAfter(
                        customer.getCustomerId(), b.getTierBenefitId(), periodStart);
                remaining = Math.max(0, b.getQuota() - (int) used);
            }
            return TierBenefitResponse.fromEntity(b, remaining);
        }).collect(Collectors.toList());
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

        // Tính số ngày lưu trú
        int stayDays = 1;
        if (booking.getCheckInDate() != null && booking.getCheckOutDate() != null) {
            long days = ChronoUnit.DAYS.between(booking.getCheckInDate(), booking.getCheckOutDate());
            stayDays = Math.max(1, (int) days);
        }

        BigDecimal amountSpent = invoice.getTotalAmount() != null ? invoice.getTotalAmount() : BigDecimal.ZERO;

        // Công thức: số ngày lưu trú × 0.4 + (chi tiêu triệu VNĐ) × 0.6
        BigDecimal daysComponent = BigDecimal.valueOf(stayDays * 0.4);
        BigDecimal spentMillion = amountSpent.divide(BigDecimal.valueOf(1_000_000), 4, RoundingMode.HALF_UP);
        BigDecimal spentComponent = spentMillion.multiply(BigDecimal.valueOf(0.6));
        BigDecimal scoreEarned = daysComponent.add(spentComponent).setScale(2, RoundingMode.HALF_UP);

        // Lưu transaction
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

        // Cập nhật customer_loyalty
        loyalty.setTotalStayDays(loyalty.getTotalStayDays() + stayDays);
        loyalty.setTotalSpent(loyalty.getTotalSpent().add(amountSpent));
        loyalty.setTotalScore(loyalty.getTotalScore().add(scoreEarned));

        // Kiểm tra tự động thăng hạng
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

        return getProfile(customer.getEmail() != null ? customer.getEmail() : adminUsername);
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

        return customerRepository.findAll().stream()
                .filter(c -> c.getAccount() != null && c.getAccount().getAccountId().equals(account.getAccountId()))
                .findFirst()
                .orElseGet(() -> customerRepository.findByEmail(account.getEmail())
                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin khách hàng")));
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
