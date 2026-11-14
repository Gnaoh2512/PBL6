package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.dto.customer.CustomerCreateRequest;
import com.example.pbl6.dto.customer.CustomerResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Customer;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.CustomerRepository;
import com.example.pbl6.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/staff/customers", "/api/v1/customers"})
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('RECEPTIONIST', 'MANAGER', 'ADMIN')")
public class StaffCustomerController {

    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final AuditLogService auditLogService;

    /**
     * Tra cứu danh sách hồ sơ khách hàng (kể cả khách vãng lai không có account)
     */
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<CustomerResponse>>> getCustomers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String idNumber
    ) {
        List<Customer> customers = customerRepository.findAll();

        if (StringUtils.hasText(phone)) {
            String p = phone.trim();
            customers = customers.stream()
                    .filter(c -> c.getPhone() != null && c.getPhone().contains(p))
                    .collect(Collectors.toList());
        }
        if (StringUtils.hasText(idNumber)) {
            String idn = idNumber.trim();
            customers = customers.stream()
                    .filter(c -> c.getIdNumber() != null && c.getIdNumber().contains(idn))
                    .collect(Collectors.toList());
        }
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim().toLowerCase();
            customers = customers.stream()
                    .filter(c -> (c.getFullName() != null && c.getFullName().toLowerCase().contains(kw))
                            || (c.getPhone() != null && c.getPhone().toLowerCase().contains(kw))
                            || (c.getIdNumber() != null && c.getIdNumber().toLowerCase().contains(kw))
                            || (c.getEmail() != null && c.getEmail().toLowerCase().contains(kw)))
                    .collect(Collectors.toList());
        }

        List<CustomerResponse> responses = customers.stream()
                .sorted(Comparator.comparing(Customer::getCustomerId, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(CustomerResponse::fromEntity)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách khách hàng thành công", responses));
    }

    /**
     * Lấy chi tiết hồ sơ khách hàng theo ID
     */
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<CustomerResponse>> getCustomerById(@PathVariable Integer id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khách hàng #" + id));
        return ResponseEntity.ok(ApiResponse.ok(CustomerResponse.fromEntity(customer)));
    }

    /**
     * Tạo mới hoặc cập nhật hồ sơ khách hàng vãng lai (không bắt buộc liên kết với account)
     * phục vụ khách đặt trực tiếp tại quầy (Walk-in).
     */
    @PostMapping
    @Transactional
    public ResponseEntity<ApiResponse<CustomerResponse>> createWalkInCustomer(
            @Valid @RequestBody CustomerCreateRequest request
    ) {
        Customer existing = null;
        if (StringUtils.hasText(request.getIdNumber())) {
            existing = customerRepository.findByIdNumber(request.getIdNumber().trim()).orElse(null);
        }
        if (existing == null && StringUtils.hasText(request.getPhone())) {
            existing = customerRepository.findByPhone(request.getPhone().trim()).orElse(null);
        }

        Account linkedAccount = null;
        if (request.getAccountId() != null) {
            linkedAccount = accountRepository.findById(request.getAccountId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản #" + request.getAccountId()));
        }

        if (existing != null) {
            existing.setFullName(request.getFullName().trim());
            existing.setPhone(request.getPhone().trim());
            if (StringUtils.hasText(request.getEmail())) {
                existing.setEmail(request.getEmail().trim());
            }
            if (StringUtils.hasText(request.getIdType())) {
                existing.setIdType(request.getIdType().trim());
            }
            if (StringUtils.hasText(request.getIdNumber())) {
                existing.setIdNumber(request.getIdNumber().trim());
            }
            if (request.getIdIssueDate() != null) {
                existing.setIdIssueDate(request.getIdIssueDate());
            }
            if (StringUtils.hasText(request.getIdIssuePlace())) {
                existing.setIdIssuePlace(request.getIdIssuePlace().trim());
            }
            if (StringUtils.hasText(request.getNationality())) {
                existing.setNationality(request.getNationality().trim());
            }
            if (linkedAccount != null && existing.getAccount() == null) {
                existing.setAccount(linkedAccount);
            }

            Customer updated = customerRepository.save(existing);
            return ResponseEntity.ok(ApiResponse.ok("Đã cập nhật hồ sơ khách hàng vãng lai hiện có", CustomerResponse.fromEntity(updated)));
        }

        Customer customer = Customer.builder()
                .account(linkedAccount) // null for walk-in guest
                .fullName(request.getFullName().trim())
                .phone(request.getPhone().trim())
                .email(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null)
                .idType(StringUtils.hasText(request.getIdType()) ? request.getIdType().trim() : "CCCD")
                .idNumber(StringUtils.hasText(request.getIdNumber()) ? request.getIdNumber().trim() : null)
                .idIssueDate(request.getIdIssueDate())
                .idIssuePlace(StringUtils.hasText(request.getIdIssuePlace()) ? request.getIdIssuePlace().trim() : null)
                .nationality(StringUtils.hasText(request.getNationality()) ? request.getNationality().trim() : "Việt Nam")
                .build();

        Customer saved = customerRepository.save(customer);
        auditLogService.log("KHÁCH HÀNG", "CREATE_WALKIN", "customer", Long.valueOf(saved.getCustomerId()),
                "Tạo hồ sơ khách hàng tại quầy: " + saved.getFullName() + " (SĐT: " + saved.getPhone() + ")");

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Tạo hồ sơ khách hàng vãng lai thành công", CustomerResponse.fromEntity(saved)));
    }
}
