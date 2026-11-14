package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.loyalty.AdjustPointsRequest;
import com.example.pbl6.dto.loyalty.LoyaltyProfileResponse;
import com.example.pbl6.entity.LoyaltyTier;
import com.example.pbl6.entity.Customer;
import com.example.pbl6.entity.CustomerLoyalty;
import com.example.pbl6.repository.CustomerRepository;
import com.example.pbl6.repository.CustomerLoyaltyRepository;
import com.example.pbl6.repository.LoyaltyTransactionRepository;
import com.example.pbl6.repository.LoyaltyTierRepository;
import com.example.pbl6.dto.loyalty.LoyaltyTransactionResponse;
import com.example.pbl6.service.LoyaltyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/admin/loyalty")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class AdminLoyaltyController {

    private final LoyaltyService loyaltyService;
    private final CustomerRepository customerRepository;
    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final LoyaltyTierRepository loyaltyTierRepository;

    @GetMapping("/customers")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getCustomers() {
        List<Map<String, Object>> customers = customerRepository.findAll().stream().map(customer -> {
            CustomerLoyalty loyalty = customerLoyaltyRepository.findByCustomer_CustomerId(customer.getCustomerId()).orElse(null);
            Map<String, Object> row = new HashMap<>();
            row.put("customerId", customer.getCustomerId()); row.put("customerName", customer.getFullName());
            row.put("fullName", customer.getFullName()); row.put("phone", customer.getPhone()); row.put("email", customer.getEmail());
            row.put("idType", customer.getIdType()); row.put("idNumber", customer.getIdNumber());
            row.put("idIssueDate", customer.getIdIssueDate()); row.put("idIssuePlace", customer.getIdIssuePlace());
            row.put("nationality", customer.getNationality());
            row.put("tierCode", loyalty != null ? loyalty.getTier().getTierCode() : "SEASHELL");
            row.put("tierName", loyalty != null ? loyalty.getTier().getTierName() : "Seashell");
            row.put("totalScore", loyalty != null ? loyalty.getTotalScore() : java.math.BigDecimal.ZERO);
            row.put("totalStayDays", loyalty != null ? loyalty.getTotalStayDays() : 0);
            row.put("totalSpent", loyalty != null ? loyalty.getTotalSpent() : java.math.BigDecimal.ZERO);
            return row;
        }).toList();
        return ResponseEntity.ok(ApiResponse.ok(customers));
    }

    @GetMapping("/customers/{id}/transactions")
    public ResponseEntity<ApiResponse<List<LoyaltyTransactionResponse>>> getCustomerTransactions(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok(loyaltyTransactionRepository.findByCustomer_CustomerIdOrderByCreatedAtDesc(id)
                .stream().map(LoyaltyTransactionResponse::fromEntity).toList()));
    }

    @PutMapping("/customers/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateCustomer(@PathVariable Integer id, @RequestBody Map<String, String> changes) {
        Customer customer = customerRepository.findById(id).orElseThrow(() -> new com.example.pbl6.exception.ResourceNotFoundException("Customer not found"));
        customer.setFullName(changes.get("fullName")); customer.setPhone(changes.get("phone")); customer.setEmail(changes.get("email"));
        customer.setIdType(changes.get("idType")); customer.setIdNumber(changes.get("idNumber"));
        customer.setIdIssuePlace(changes.get("idIssuePlace")); customer.setNationality(changes.get("nationality"));
        String issueDate = changes.get("idIssueDate");
        customer.setIdIssueDate(issueDate == null || issueDate.isBlank() ? null : java.time.LocalDate.parse(issueDate));
        customerRepository.save(customer);
        String tierCode = changes.get("tierCode");
        if (tierCode != null && !tierCode.isBlank()) {
            CustomerLoyalty loyalty = customerLoyaltyRepository.findByCustomer_CustomerId(id).orElseGet(() -> CustomerLoyalty.builder()
                    .customer(customer).tier(loyaltyTierRepository.findByTierCode("SEASHELL").orElseGet(() -> loyaltyTierRepository.findAll().get(0)))
                    .totalScore(java.math.BigDecimal.ZERO).totalStayDays(0).totalSpent(java.math.BigDecimal.ZERO).build());
            loyalty.setTier(loyaltyTierRepository.findByTierCode(tierCode).orElseThrow(() -> new com.example.pbl6.exception.ResourceNotFoundException("Loyalty tier not found")));
            customerLoyaltyRepository.save(loyalty);
        }
        return ResponseEntity.ok(ApiResponse.ok(Map.of("customerId", id)));
    }

    @GetMapping("/tiers")
    public ResponseEntity<ApiResponse<List<LoyaltyTier>>> getAllTiers() {
        List<LoyaltyTier> tiers = loyaltyService.getAllTiers();
        return ResponseEntity.ok(ApiResponse.ok(tiers));
    }

    @PostMapping("/adjust-points")
    public ResponseEntity<ApiResponse<LoyaltyProfileResponse>> adjustPoints(
            @Valid @RequestBody AdjustPointsRequest req,
            Authentication authentication
    ) {
        LoyaltyProfileResponse response = loyaltyService.adjustPoints(req, authentication.getName());
        return ResponseEntity.ok(ApiResponse.ok("Điều chỉnh điểm thành viên thành công", response));
    }
}
