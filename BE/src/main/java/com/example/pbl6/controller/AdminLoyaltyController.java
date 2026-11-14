package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.loyalty.AdjustPointsRequest;
import com.example.pbl6.dto.loyalty.LoyaltyProfileResponse;
import com.example.pbl6.dto.loyalty.LoyaltyTransactionResponse;
import com.example.pbl6.dto.loyalty.TierBenefitRequest;
import com.example.pbl6.dto.loyalty.TierBenefitResponse;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Customer;
import com.example.pbl6.entity.CustomerLoyalty;
import com.example.pbl6.entity.LoyaltyTier;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.CustomerLoyaltyRepository;
import com.example.pbl6.repository.CustomerRepository;
import com.example.pbl6.repository.LoyaltyTierRepository;
import com.example.pbl6.repository.LoyaltyTransactionRepository;
import com.example.pbl6.service.LoyaltyService;
import com.example.pbl6.service.ServiceRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/loyalty")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class AdminLoyaltyController {

    private final LoyaltyService loyaltyService;
    private final ServiceRequestService serviceRequestService;
    private final CustomerRepository customerRepository;
    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final LoyaltyTierRepository loyaltyTierRepository;
    private final AccountRepository accountRepository;

    /**
     * Lists EVERY guest. Customer accounts that never got a customer record are
     * created here, and guests without a loyalty record are shown at the lowest tier.
     */
    @GetMapping("/customers")
    @Transactional
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getCustomers() {
        syncCustomerRecordsForAccounts();

        Map<Integer, CustomerLoyalty> loyaltyByCustomer = customerLoyaltyRepository.findAll().stream()
                .collect(Collectors.toMap(CustomerLoyalty::getCustomerId, l -> l, (a, b) -> a));
        LoyaltyTier defaultTier = defaultTier();

        List<Map<String, Object>> customers = customerRepository.findAll().stream()
                .sorted(Comparator.comparing(c -> String.valueOf(c.getFullName()).toLowerCase()))
                .map(customer -> {
                    CustomerLoyalty loyalty = loyaltyByCustomer.get(customer.getCustomerId());
                    LoyaltyTier tier = loyalty != null && loyalty.getTier() != null ? loyalty.getTier() : defaultTier;

                    Map<String, Object> row = new HashMap<>();
                    row.put("customerId", customer.getCustomerId());
                    row.put("accountId", customer.getAccount() != null ? customer.getAccount().getAccountId() : null);
                    row.put("customerName", customer.getFullName());
                    row.put("fullName", customer.getFullName());
                    row.put("phone", customer.getPhone());
                    row.put("email", customer.getEmail());
                    row.put("idType", customer.getIdType());
                    row.put("idNumber", customer.getIdNumber());
                    row.put("idIssueDate", customer.getIdIssueDate() != null ? customer.getIdIssueDate().toString() : null);
                    row.put("idIssuePlace", customer.getIdIssuePlace());
                    row.put("nationality", customer.getNationality());
                    row.put("tierCode", tier != null ? tier.getTierCode() : null);
                    row.put("tierName", tier != null ? tier.getTierName() : null);
                    row.put("totalScore", loyalty != null ? loyalty.getTotalScore() : BigDecimal.ZERO);
                    row.put("totalStayDays", loyalty != null ? loyalty.getTotalStayDays() : 0);
                    row.put("totalSpent", loyalty != null ? loyalty.getTotalSpent() : BigDecimal.ZERO);
                    return row;
                }).toList();
        return ResponseEntity.ok(ApiResponse.ok(customers));
    }

    @GetMapping("/customers/{id}/transactions")
    public ResponseEntity<ApiResponse<List<LoyaltyTransactionResponse>>> getCustomerTransactions(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok(loyaltyTransactionRepository.findByCustomer_CustomerIdOrderByCreatedAtDesc(id)
                .stream().map(LoyaltyTransactionResponse::fromEntity).toList()));
    }

    /**
     * Lịch sử Dịch vụ theo Khách hàng (Admin Portal)
     */
    @GetMapping({"/customers/{id}/service-requests", "/customers/{id}/services"})
    public ResponseEntity<ApiResponse<List<ServiceRequestResponse>>> getCustomerServiceRequests(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok("Lấy lịch sử dịch vụ của khách hàng thành công",
                serviceRequestService.getRequestsByCustomerId(id)));
    }

    /**
     * Edits personal info, ID documents, tier and loyalty counters.
     * Only keys present in the body are changed.
     */
    @PutMapping("/customers/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateCustomer(@PathVariable Integer id, @RequestBody Map<String, Object> changes) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khách hàng #" + id));

        if (changes.containsKey("fullName")) {
            String name = str(changes.get("fullName"));
            if (name != null) customer.setFullName(name); // full_name is NOT NULL: ignore blank
        }
        if (changes.containsKey("phone")) customer.setPhone(str(changes.get("phone")));
        if (changes.containsKey("email")) customer.setEmail(str(changes.get("email")));
        if (changes.containsKey("idType")) customer.setIdType(str(changes.get("idType")));
        if (changes.containsKey("idNumber")) customer.setIdNumber(str(changes.get("idNumber")));
        if (changes.containsKey("idIssuePlace")) customer.setIdIssuePlace(str(changes.get("idIssuePlace")));
        if (changes.containsKey("nationality")) customer.setNationality(str(changes.get("nationality")));
        if (changes.containsKey("idIssueDate")) {
            String d = str(changes.get("idIssueDate"));
            customer.setIdIssueDate(d == null ? null : LocalDate.parse(d.length() > 10 ? d.substring(0, 10) : d));
        }
        customerRepository.save(customer);

        boolean touchesLoyalty = changes.containsKey("tierCode") || changes.containsKey("totalScore")
                || changes.containsKey("totalStayDays") || changes.containsKey("totalSpent");
        if (touchesLoyalty) {
            CustomerLoyalty loyalty = customerLoyaltyRepository.findByCustomer_CustomerId(id).orElseGet(() -> {
                LoyaltyTier tier = defaultTier();
                if (tier == null) throw new ResourceNotFoundException("Chưa cấu hình hạng thành viên");
                return CustomerLoyalty.builder().customer(customer).tier(tier).build();
            });

            if (changes.containsKey("totalScore")) {
                BigDecimal v = decimal(changes.get("totalScore"));
                if (v != null) loyalty.setTotalScore(v.max(BigDecimal.ZERO));
            }
            if (changes.containsKey("totalStayDays")) {
                BigDecimal v = decimal(changes.get("totalStayDays"));
                if (v != null) loyalty.setTotalStayDays(Math.max(0, v.intValue()));
            }
            if (changes.containsKey("totalSpent")) {
                BigDecimal v = decimal(changes.get("totalSpent"));
                if (v != null) loyalty.setTotalSpent(v.max(BigDecimal.ZERO));
            }
            String tierCode = str(changes.get("tierCode"));
            if (tierCode != null) {
                LoyaltyTier tier = loyaltyTierRepository.findByTierCode(tierCode)
                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng thành viên: " + tierCode));
                if (loyalty.getTier() == null || !tier.getTierId().equals(loyalty.getTier().getTierId())) {
                    loyalty.setTier(tier);
                    loyalty.setTierUpdatedAt(LocalDateTime.now());
                }
            }
            customerLoyaltyRepository.save(loyalty);
        }
        return ResponseEntity.ok(ApiResponse.ok(Map.of("customerId", id)));
    }

    @GetMapping("/tiers")
    public ResponseEntity<ApiResponse<List<LoyaltyTier>>> getAllTiers() {
        List<LoyaltyTier> tiers = loyaltyService.getAllTiers();
        return ResponseEntity.ok(ApiResponse.ok(tiers));
    }

    /**
     * Edits one loyalty tier. tierCode is the stable identifier (referenced by code elsewhere) and is not editable.
     * Changing minScore does not re-rank existing guests; a guest is re-evaluated the next time their points change.
     */
    @PutMapping("/tiers/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<LoyaltyTier>> updateTier(@PathVariable Integer id, @RequestBody Map<String, Object> changes) {
        LoyaltyTier tier = loyaltyTierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng thành viên #" + id));

        // Validate everything first so nothing is half-applied
        String newName = tier.getTierName();
        if (changes.containsKey("tierName")) {
            newName = str(changes.get("tierName"));
            if (newName == null) return ResponseEntity.badRequest().body(ApiResponse.error("Tên hạng không được để trống"));
        }

        Integer newLevel = tier.getTierLevel();
        if (changes.containsKey("tierLevel")) {
            BigDecimal v = decimal(changes.get("tierLevel"));
            if (v == null || v.intValue() < 1) return ResponseEntity.badRequest().body(ApiResponse.error("Cấp độ hạng phải là số nguyên từ 1 trở lên"));
            newLevel = v.intValue();
            final Integer levelToCheck = newLevel;
            boolean taken = loyaltyTierRepository.findAll().stream()
                    .anyMatch(t -> !t.getTierId().equals(id) && levelToCheck.equals(t.getTierLevel()));
            if (taken) return ResponseEntity.badRequest().body(ApiResponse.error("Cấp độ " + newLevel + " đã được hạng khác sử dụng"));
        }

        BigDecimal newMinScore = tier.getMinScore();
        if (changes.containsKey("minScore")) {
            BigDecimal v = decimal(changes.get("minScore"));
            if (v == null || v.signum() < 0) return ResponseEntity.badRequest().body(ApiResponse.error("Điểm tối thiểu phải là số không âm"));
            newMinScore = v;
        }

        tier.setTierName(newName);
        tier.setTierLevel(newLevel);
        tier.setMinScore(newMinScore);
        if (changes.containsKey("description")) tier.setDescription(str(changes.get("description")));

        LoyaltyTier saved = loyaltyTierRepository.save(tier);
        return ResponseEntity.ok(ApiResponse.ok("Đã cập nhật hạng thành viên", saved));
    }

    @PostMapping("/adjust-points")
    public ResponseEntity<ApiResponse<LoyaltyProfileResponse>> adjustPoints(
            @Valid @RequestBody AdjustPointsRequest req,
            Authentication authentication
    ) {
        LoyaltyProfileResponse response = loyaltyService.adjustPoints(req, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Điều chỉnh điểm thành viên thành công", response));
    }

    // ------------------------------------------------------------------ CRUD for TierBenefit (Admin Portal)

    @GetMapping({"/benefits", "/tier-benefits"})
    public ResponseEntity<ApiResponse<List<TierBenefitResponse>>> getAllTierBenefits(
            @RequestParam(required = false) Integer tierId
    ) {
        return ResponseEntity.ok(ApiResponse.ok(loyaltyService.getAllTierBenefits(tierId)));
    }

    @GetMapping({"/benefits/{id}", "/tier-benefits/{id}"})
    public ResponseEntity<ApiResponse<TierBenefitResponse>> getTierBenefitById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok(loyaltyService.getTierBenefitById(id)));
    }

    @PostMapping({"/benefits", "/tier-benefits"})
    public ResponseEntity<ApiResponse<TierBenefitResponse>> createTierBenefit(
            @Valid @RequestBody TierBenefitRequest request
    ) {
        TierBenefitResponse created = loyaltyService.createTierBenefit(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Tạo đặc quyền hạng thành viên thành công", created));
    }

    @PutMapping({"/benefits/{id}", "/tier-benefits/{id}"})
    public ResponseEntity<ApiResponse<TierBenefitResponse>> updateTierBenefit(
            @PathVariable Integer id,
            @RequestBody TierBenefitRequest request
    ) {
        TierBenefitResponse updated = loyaltyService.updateTierBenefit(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật đặc quyền hạng thành viên thành công", updated));
    }

    @DeleteMapping({"/benefits/{id}", "/tier-benefits/{id}"})
    public ResponseEntity<ApiResponse<Void>> deleteTierBenefit(@PathVariable Integer id) {
        loyaltyService.deleteTierBenefit(id);
        return ResponseEntity.ok(ApiResponse.ok("Đã xóa đặc quyền hạng thành viên", null));
    }

    // ---------------------------------------------------------------- helpers

    private LoyaltyTier defaultTier() {
        return loyaltyTierRepository.findByTierCode("SEASHELL")
                .orElseGet(() -> loyaltyTierRepository.findAll().stream()
                        .min(Comparator.comparingInt(LoyaltyTier::getTierLevel))
                        .orElse(null));
    }

    /** Every account with ROLE_CUSTOMER must have a customer row, otherwise it never shows up here. */
    private void syncCustomerRecordsForAccounts() {
        List<Customer> allCustomers = customerRepository.findAll();
        Set<Integer> linkedAccountIds = allCustomers.stream()
                .map(Customer::getAccount).filter(Objects::nonNull)
                .map(Account::getAccountId).collect(Collectors.toSet());
        Map<String, Customer> unlinkedByEmail = new HashMap<>();
        for (Customer c : allCustomers) {
            if (c.getAccount() == null && c.getEmail() != null && !c.getEmail().isBlank()) {
                unlinkedByEmail.putIfAbsent(c.getEmail().trim().toLowerCase(), c);
            }
        }

        List<Customer> toSave = new ArrayList<>();
        for (Account a : accountRepository.findAll()) {
            boolean isCustomer = a.getRole() != null && "ROLE_CUSTOMER".equalsIgnoreCase(a.getRole().getRoleCode());
            if (!isCustomer || linkedAccountIds.contains(a.getAccountId())) continue;

            String emailKey = a.getEmail() != null ? a.getEmail().trim().toLowerCase() : null;
            Customer existing = emailKey != null ? unlinkedByEmail.remove(emailKey) : null;
            if (existing != null) {
                existing.setAccount(a); // same guest, just link the account
                toSave.add(existing);
            } else {
                toSave.add(Customer.builder()
                        .account(a)
                        .fullName(a.getFullName() != null && !a.getFullName().isBlank() ? a.getFullName() : a.getUsername())
                        .email(a.getEmail())
                        .phone(a.getPhone())
                        .build());
            }
        }
        if (!toSave.isEmpty()) customerRepository.saveAll(toSave);
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static BigDecimal decimal(Object v) {
        String s = str(v);
        if (s == null) return null;
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
