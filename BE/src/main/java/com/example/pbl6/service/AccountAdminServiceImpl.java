package com.example.pbl6.service;

import com.example.pbl6.dto.adminaccount.AccountCreateRequest;
import com.example.pbl6.dto.adminaccount.AccountUpdateRequest;
import com.example.pbl6.dto.adminaccount.CustomerServiceHistoryItemResponse;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.entity.*;
import com.example.pbl6.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AccountAdminServiceImpl implements AccountAdminService {

    private final AccountRepository accountRepository;
    private final RoleRepository roleRepository;
    private final AuditLogService auditLogService;
    private final PasswordEncoder passwordEncoder;
    private final CustomerRepository customerRepository;
    private final ServiceUsageRepository serviceUsageRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final BookingRoomRepository bookingRoomRepository;

    @Override
    public List<Account> getAllAccounts() {
        return accountRepository.findAll();
    }

    @Override
    @Transactional
    public Account createAccount(AccountCreateRequest request) {
        if (accountRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists: " + request.getUsername());
        }
        if (request.getEmail() != null && !request.getEmail().isBlank() && accountRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists: " + request.getEmail());
        }

        String roleCode = request.getRole() != null ? request.getRole().trim().toUpperCase() : "ROLE_RECEPTIONIST";
        if (!roleCode.startsWith("ROLE_")) {
            roleCode = "ROLE_" + roleCode;
        }
        Role role = roleRepository.findByRoleCode(roleCode)
                .orElseGet(() -> roleRepository.findByRoleCode("ROLE_RECEPTIONIST").orElse(null));

        Account account = Account.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .role(role)
                .status(request.getStatus() != null ? request.getStatus() : "ACTIVE")
                .build();

        Account saved = accountRepository.save(account);

        auditLogService.log("QUẢN TRỊ TÀI KHOẢN", "CREATE", "account", Long.valueOf(saved.getAccountId()),
                "Tạo tài khoản mới: " + saved.getUsername() + " (Họ tên: " + saved.getFullName() + ", Vai trò: " + (role != null ? role.getRoleName() : roleCode) + ")");

        return saved;
    }

    @Override
    @Transactional
    public Account updateAccount(Integer accountId, AccountUpdateRequest request, String currentUsername) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", accountId));
        boolean isSelf = account.getUsername().equalsIgnoreCase(currentUsername);

        String email = request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail().trim() : null;
        if (email != null && !email.equalsIgnoreCase(account.getEmail()) && accountRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already exists: " + email);
        }

        if (request.getRole() != null && !request.getRole().isBlank()) {
            String roleCode = request.getRole().trim().toUpperCase();
            if (!roleCode.startsWith("ROLE_")) {
                roleCode = "ROLE_" + roleCode;
            }
            Role role = roleRepository.findByRoleCode(roleCode)
                    .orElseThrow(() -> new IllegalArgumentException("Role not found: " + request.getRole()));
            if (isSelf && account.getRole() != null && !account.getRole().getRoleCode().equals(role.getRoleCode())) {
                throw new IllegalArgumentException("Không thể tự đổi vai trò của chính mình");
            }
            account.setRole(role);
        }

        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            String status = request.getStatus().trim().toUpperCase();
            if (isSelf && !"ACTIVE".equals(status)) {
                throw new IllegalArgumentException("Không thể khóa/vô hiệu hóa tài khoản của chính mình");
            }
            account.setStatus(status);
        }

        account.setFullName(request.getFullName().trim());
        account.setEmail(email);
        account.setPhone(request.getPhone() != null && !request.getPhone().isBlank() ? request.getPhone().trim() : null);
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        Account saved = accountRepository.save(account);
        auditLogService.log("QUẢN TRỊ TÀI KHOẢN", "UPDATE", "account", Long.valueOf(saved.getAccountId()),
                "Cập nhật tài khoản: " + saved.getUsername() + " (Họ tên: " + saved.getFullName()
                        + ", Vai trò: " + (saved.getRole() != null ? saved.getRole().getRoleCode() : "—")
                        + ", Trạng thái: " + saved.getStatus() + ")");
        return saved;
    }

    /** Soft delete: accounts are referenced by audit logs, schedules, shifts and bookings, so we deactivate instead. */
    @Override
    @Transactional
    public Account deactivateAccount(Integer accountId, String currentUsername) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", accountId));
        if (account.getUsername().equalsIgnoreCase(currentUsername)) {
            throw new IllegalArgumentException("Không thể vô hiệu hóa tài khoản của chính mình");
        }
        account.setStatus("INACTIVE");
        Account saved = accountRepository.save(account);
        auditLogService.log("QUẢN TRỊ TÀI KHOẢN", "DEACTIVATE", "account", Long.valueOf(saved.getAccountId()),
                "Vô hiệu hóa tài khoản: " + saved.getUsername());
        return saved;
    }

    @Override
    public List<AuditLog> getAuditLogs() {
        return auditLogService.getAllAuditLogs();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerServiceHistoryItemResponse> getCustomerServiceHistory(Integer accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", accountId));

        Customer customer = customerRepository.findByAccount_AccountId(accountId)
                .or(() -> customerRepository.findByAccount_Username(account.getUsername()))
                .orElse(null);

        if (customer == null) {
            return Collections.emptyList();
        }

        Integer customerId = customer.getCustomerId();
        List<CustomerServiceHistoryItemResponse> result = new ArrayList<>();
        Map<Integer, String> bookingRoomCache = new HashMap<>();

        java.util.function.Function<Integer, String> getRoomNumber = (bookingId) -> {
            if (bookingId == null) return "N/A";
            return bookingRoomCache.computeIfAbsent(bookingId, bId -> {
                List<BookingRoom> brs = bookingRoomRepository.findByBooking_BookingId(bId);
                if (brs != null && !brs.isEmpty() && brs.get(0).getRoom() != null) {
                    return brs.get(0).getRoom().getRoomNumber();
                }
                return "N/A";
            });
        };

        // 1. ServiceUsage từ các đơn lưu trú của khách hàng
        List<ServiceUsage> usages = serviceUsageRepository.findByBooking_Customer_CustomerIdOrderByUsedAtDesc(customerId);
        Set<Integer> usageIds = new HashSet<>();

        for (ServiceUsage u : usages) {
            if (u.getUsageId() != null) usageIds.add(u.getUsageId());
            com.example.pbl6.entity.Service s = u.getService();
            Booking b = u.getBooking();
            Integer bId = b != null ? b.getBookingId() : null;
            String bCode = b != null ? b.getBookingCode() : "N/A";
            String roomNum = getRoomNumber.apply(bId);

            result.add(CustomerServiceHistoryItemResponse.builder()
                    .id(u.getUsageId())
                    .serviceId(s != null ? s.getServiceId() : null)
                    .serviceName(s != null ? s.getServiceName() : "Dịch vụ")
                    .categoryName(s != null && s.getCategory() != null ? s.getCategory().getCategoryName() : "Khác")
                    .bookingId(bId)
                    .bookingCode(bCode)
                    .roomNumber(roomNum)
                    .quantity(u.getQuantity() != null ? u.getQuantity() : 1)
                    .unit(s != null ? s.getUnit() : "")
                    .unitPrice(u.getUnitPriceApplied())
                    .discountAmount(u.getDiscountAmount() != null ? u.getDiscountAmount() : BigDecimal.ZERO)
                    .totalPrice(u.getTotalPrice() != null ? u.getTotalPrice() : BigDecimal.ZERO)
                    .status(u.getStatus() != null ? u.getStatus() : "COMPLETED")
                    .usedAt(u.getUsedAt())
                    .recordedBy(u.getRecordedBy() != null ? u.getRecordedBy().getFullName() : null)
                    .isLoyaltyBenefit(false)
                    .note(null)
                    .build());
        }

        // 2. ServiceRequest chưa liên kết vào usages (hoặc yêu cầu đặc quyền miễn phí / đang chờ thực hiện)
        List<ServiceRequest> requests = serviceRequestRepository.findByCustomer_CustomerId(customerId);
        for (ServiceRequest req : requests) {
            if (req.getServiceUsage() != null && usageIds.contains(req.getServiceUsage().getUsageId())) {
                continue;
            }
            com.example.pbl6.entity.Service s = req.getService();
            Booking b = req.getBooking();
            Integer bId = b != null ? b.getBookingId() : null;
            String bCode = b != null ? b.getBookingCode() : "N/A";
            String roomNum = req.getRoom() != null ? req.getRoom().getRoomNumber() : getRoomNumber.apply(bId);

            boolean isLoyalty = req.getNote() != null && (req.getNote().startsWith("[LOYALTY BENEFIT]") || req.getNote().contains("dùng ưu đãi miễn phí"));
            BigDecimal fee = req.getFeeAmount() != null ? req.getFeeAmount() : BigDecimal.ZERO;
            BigDecimal price = s != null && s.getUnitPrice() != null ? s.getUnitPrice() : fee;

            result.add(CustomerServiceHistoryItemResponse.builder()
                    .id(req.getServiceRequestId())
                    .serviceId(s != null ? s.getServiceId() : null)
                    .serviceName(s != null ? s.getServiceName() : "Yêu cầu dịch vụ #" + req.getServiceRequestId())
                    .categoryName(s != null && s.getCategory() != null ? s.getCategory().getCategoryName() : "Dịch vụ phòng")
                    .bookingId(bId)
                    .bookingCode(bCode)
                    .roomNumber(roomNum)
                    .quantity(req.getQuantity() != null ? req.getQuantity() : 1)
                    .unit(s != null ? s.getUnit() : "")
                    .unitPrice(price)
                    .discountAmount(isLoyalty ? price : BigDecimal.ZERO)
                    .totalPrice(isLoyalty ? BigDecimal.ZERO : fee)
                    .status(req.getStatus() != null ? req.getStatus() : "PENDING")
                    .usedAt(req.getRequestedAt() != null ? req.getRequestedAt() : req.getCompletedAt())
                    .recordedBy(req.getAssignedTo() != null ? req.getAssignedTo().getFullName() : null)
                    .isLoyaltyBenefit(isLoyalty)
                    .note(req.getNote())
                    .build());
        }

        result.sort(Comparator.comparing(CustomerServiceHistoryItemResponse::getUsedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return result;
    }
}
