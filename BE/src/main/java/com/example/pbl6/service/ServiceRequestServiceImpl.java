package com.example.pbl6.service;

import com.example.pbl6.dto.servicerequest.CreateServiceRequestDto;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Booking;
import com.example.pbl6.entity.BookingRoom;
import com.example.pbl6.entity.Customer;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.ServiceRequest;
import com.example.pbl6.entity.ServiceUsage;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.BookingRepository;
import com.example.pbl6.repository.BookingRoomRepository;
import com.example.pbl6.repository.CustomerRepository;
import com.example.pbl6.repository.InvoiceRepository;
import com.example.pbl6.repository.RoomRepository;
import com.example.pbl6.repository.ServiceRepository;
import com.example.pbl6.repository.ServiceRequestRepository;
import com.example.pbl6.repository.ServiceUsageRepository;
import com.example.pbl6.service.financial.FinancialCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceRequestServiceImpl implements ServiceRequestService {

    private final ServiceRequestRepository serviceRequestRepository;
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final RoomRepository roomRepository;
    private final ServiceRepository serviceRepository;
    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;
    private final ServiceUsageRepository serviceUsageRepository;
    private final FinancialCalculator financialCalculator;
    private final WorkScheduleService workScheduleService;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public ServiceRequestResponse createRequest(CreateServiceRequestDto dto, String username) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + username));

        Booking booking = bookingRepository.findById(dto.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin đặt phòng: " + dto.getBookingId()));

        Customer customer = booking.getCustomer();
        if (customer == null) {
            customer = customerRepository.findByEmail(account.getEmail())
                    .orElseGet(() -> customerRepository.findByAccount_AccountId(account.getAccountId())
                            .orElseThrow(() -> new ResourceNotFoundException("Tài khoản chưa được liên kết thông tin khách hàng")));
        }

        Room room = roomRepository.findById(dto.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin phòng: " + dto.getRoomId()));

        com.example.pbl6.entity.Service service = serviceRepository.findById(dto.getServiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ: " + dto.getServiceId()));

        int qty = dto.getQuantity() != null && dto.getQuantity() > 0 ? dto.getQuantity() : 1;
        BigDecimal fee = service.getUnitPrice() != null
                ? service.getUnitPrice().multiply(BigDecimal.valueOf(qty))
                : BigDecimal.ZERO;

        Account assignedStaff = null;
        if (dto.getAssignedToId() != null) {
            assignedStaff = accountRepository.findById(dto.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên phục vụ #" + dto.getAssignedToId()));
            validateShiftIfScheduledDataExists(assignedStaff);
        }

        // Luồng trạng thái: Nếu được phân công nhân viên (assigned_to != null), đổi trạng thái thành DELIVERING ngay
        String initialStatus = assignedStaff != null ? "DELIVERING" : "PENDING";

        ServiceRequest request = ServiceRequest.builder()
                .booking(booking)
                .room(room)
                .service(service)
                .customer(customer)
                .assignedTo(assignedStaff)
                .quantity(qty)
                .feeAmount(fee)
                .status(initialStatus)
                .note(dto.getNote())
                .build();

        ServiceRequest saved = serviceRequestRepository.save(request);
        log.info("Created service request #{} for room {} with status {}", saved.getServiceRequestId(), room.getRoomNumber(), initialStatus);

        auditLogService.log(account, "YÊU CẦU DỊCH VỤ", "ORDER", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Đặt dịch vụ: " + service.getServiceName() + " x" + qty + " cho phòng " + room.getRoomNumber() + " (Đơn đặt: " + booking.getBookingCode() + ")");

        return ServiceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ServiceRequestResponse> getMyRequests(String username) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + username));

        return serviceRequestRepository.findAll().stream()
                .filter(r -> r.getCustomer() != null && (
                        (r.getCustomer().getAccount() != null && r.getCustomer().getAccount().getAccountId().equals(account.getAccountId()))
                        || (account.getEmail() != null && account.getEmail().equalsIgnoreCase(r.getCustomer().getEmail()))
                ))
                .sorted(Comparator.comparing(ServiceRequest::getServiceRequestId, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(ServiceRequestResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ServiceRequestResponse cancelRequest(Integer requestId, String username) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        if ("COMPLETED".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Không thể hủy yêu cầu dịch vụ đã hoàn tất");
        }

        request.setStatus("CANCELED");
        ServiceRequest saved = serviceRequestRepository.save(request);
        updateMatchingServiceUsageStatus(saved, "CANCELED");

        auditLogService.log("YÊU CẦU DỊCH VỤ", "CANCEL", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Hủy yêu cầu dịch vụ #" + requestId + " bởi " + username);

        return ServiceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public List<ServiceRequestResponse> getAllRequests(String status) {
        try {
            syncServiceUsagesToRequests();
        } catch (Exception e) {
            log.warn("Không thể đồng bộ ServiceUsage sang ServiceRequest: {}", e.getMessage());
        }

        List<ServiceRequest> list;
        if (status != null && !status.isBlank()) {
            String upperStatus = status.trim().toUpperCase();
            if ("DELIVERING".equalsIgnoreCase(upperStatus)) {
                list = serviceRequestRepository.findAll().stream()
                        .filter(r -> "DELIVERING".equalsIgnoreCase(r.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(r.getStatus()))
                        .collect(Collectors.toList());
            } else {
                list = serviceRequestRepository.findByStatus(upperStatus);
            }
        } else {
            list = serviceRequestRepository.findAll();
        }

        return list.stream()
                .sorted((a, b) -> {
                    if (a.getServiceRequestId() != null && b.getServiceRequestId() != null) {
                        return b.getServiceRequestId().compareTo(a.getServiceRequestId());
                    }
                    return 0;
                })
                .map(ServiceRequestResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ServiceRequestResponse assignRequest(Integer requestId, String staffUsername) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        Account staff = null;
        if (StringUtils.hasText(staffUsername)) {
            staff = accountRepository.findByUsername(staffUsername).orElse(null);
        }

        if (staff != null) {
            request.setAssignedTo(staff);
        }
        // Khi assigned_to != null -> đổi trạng thái thành DELIVERING
        request.setStatus("DELIVERING");
        ServiceRequest saved = serviceRequestRepository.save(request);
        updateMatchingServiceUsageStatus(saved, "DELIVERING");

        String staffDisplay = staff != null ? (staff.getFullName() + " (" + staffUsername + ")") : staffUsername;
        auditLogService.log(staff, "YÊU CẦU DỊCH VỤ", "ASSIGN", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Nhân viên " + staffDisplay + " tiếp nhận xử lý yêu cầu dịch vụ #" + requestId);

        return ServiceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public ServiceRequestResponse assignRequestToStaff(Integer requestId, Integer staffAccountId, String actorUsername) {
        if (staffAccountId == null) {
            return assignRequest(requestId, actorUsername);
        }

        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        Account staff = accountRepository.findById(staffAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên phục vụ #" + staffAccountId));

        validateShiftIfScheduledDataExists(staff);

        request.setAssignedTo(staff);
        // Khi được phân công nhân viên (assigned_to != null), đổi trạng thái thành DELIVERING
        request.setStatus("DELIVERING");
        ServiceRequest saved = serviceRequestRepository.save(request);
        updateMatchingServiceUsageStatus(saved, "DELIVERING");

        auditLogService.log("YÊU CẦU DỊCH VỤ", "ASSIGN", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Phân công nhân viên " + staff.getFullName() + " phục vụ yêu cầu dịch vụ #" + requestId + " (bởi " + actorUsername + ")");

        return ServiceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public ServiceRequestResponse completeRequest(Integer requestId, String staffUsername) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        if (request.getAssignedTo() == null && StringUtils.hasText(staffUsername)) {
            accountRepository.findByUsername(staffUsername).ifPresent(request::setAssignedTo);
        }

        request.setStatus("COMPLETED");
        request.setCompletedAt(LocalDateTime.now());

        // Tự động gắn invoice của booking nếu có
        if (request.getInvoice() == null && request.getBooking() != null) {
            invoiceRepository.findByBooking_BookingId(request.getBooking().getBookingId()).stream()
                    .findFirst()
                    .ifPresent(request::setInvoice);
        }

        ServiceRequest saved = serviceRequestRepository.save(request);
        updateMatchingServiceUsageStatus(saved, "COMPLETED");

        auditLogService.log("YÊU CẦU DỊCH VỤ", "COMPLETE", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Hoàn thành phục vụ yêu cầu dịch vụ #" + requestId + " bởi nhân viên " + staffUsername);

        return ServiceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public ServiceRequestResponse updateStatus(Integer requestId, String newStatus, String staffUsername) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        String upper = (newStatus != null && !newStatus.isBlank()) ? newStatus.trim().toUpperCase() : "PENDING";
        if ("IN_PROGRESS".equalsIgnoreCase(upper)) {
            upper = "DELIVERING";
        }
        request.setStatus(upper);

        if (StringUtils.hasText(staffUsername) && request.getAssignedTo() == null
                && ("DELIVERING".equalsIgnoreCase(upper) || "COMPLETED".equalsIgnoreCase(upper))) {
            accountRepository.findByUsername(staffUsername).ifPresent(request::setAssignedTo);
        }

        if ("COMPLETED".equalsIgnoreCase(upper)) {
            request.setCompletedAt(LocalDateTime.now());
            if (request.getInvoice() == null && request.getBooking() != null) {
                invoiceRepository.findByBooking_BookingId(request.getBooking().getBookingId()).stream()
                        .findFirst()
                        .ifPresent(request::setInvoice);
            }
        }

        ServiceRequest saved = serviceRequestRepository.save(request);
        updateMatchingServiceUsageStatus(saved, upper);

        auditLogService.log("YÊU CẦU DỊCH VỤ", "UPDATE_STATUS", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Đổi trạng thái yêu cầu #" + requestId + " sang " + upper + " bởi " + staffUsername);

        return ServiceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public List<ServiceRequestResponse> getRequestsByCustomerId(Integer customerId) {
        try {
            syncServiceUsagesToRequests();
        } catch (Exception ignored) {
        }
        return serviceRequestRepository.findByCustomer_CustomerId(customerId).stream()
                .sorted(Comparator.comparing(ServiceRequest::getRequestedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(ServiceRequestResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<ServiceRequestResponse> getRequestsByAccountId(Integer accountId) {
        try {
            syncServiceUsagesToRequests();
        } catch (Exception ignored) {
        }
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản #" + accountId));

        Optional<Customer> custOpt = customerRepository.findByAccount_AccountId(accountId);
        if (custOpt.isEmpty() && StringUtils.hasText(account.getEmail())) {
            custOpt = customerRepository.findByEmail(account.getEmail());
        }
        if (custOpt.isEmpty() && StringUtils.hasText(account.getPhone())) {
            custOpt = customerRepository.findByPhone(account.getPhone());
        }

        if (custOpt.isPresent()) {
            return getRequestsByCustomerId(custOpt.get().getCustomerId());
        }
        return List.of();
    }

    @Override
    @Transactional
    public List<ServiceRequestResponse> getRequestsByBookingId(Integer bookingId) {
        try {
            syncServiceUsagesToRequests();
        } catch (Exception ignored) {
        }
        return serviceRequestRepository.findByBooking_BookingId(bookingId).stream()
                .sorted(Comparator.comparing(ServiceRequest::getRequestedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(ServiceRequestResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<ServiceRequestResponse> getRequestsByBookingCode(String bookingCode) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode.trim().toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));
        return getRequestsByBookingId(booking.getBookingId());
    }

    private void validateShiftIfScheduledDataExists(Account staff) {
        var availableStaff = workScheduleService.getAvailableStaffInShift(LocalDate.now(), LocalTime.now(), "ROLE_SERVICE_STAFF");
        if (!availableStaff.isEmpty()) {
            boolean inShift = availableStaff.stream().anyMatch(s -> s.getAccountId().equals(staff.getAccountId()));
            if (!inShift) {
                throw new IllegalArgumentException("Nhân viên " + staff.getFullName() + " hiện không có trong lịch trực ca phục vụ dịch vụ!");
            }
        }
    }

    private void syncServiceUsagesToRequests() {
        List<ServiceUsage> usages = serviceUsageRepository.findAll();
        List<ServiceRequest> existingRequests = serviceRequestRepository.findAll();
        java.util.Set<Integer> claimedRequestIds = new java.util.HashSet<>();

        for (ServiceUsage usage : usages) {
            if (usage.getBooking() == null || usage.getService() == null || usage.getUsageId() == null) {
                continue;
            }

            List<ServiceRequest> linked = serviceRequestRepository.findByServiceUsage_UsageId(usage.getUsageId());
            if (!linked.isEmpty()) {
                linked.forEach(r -> claimedRequestIds.add(r.getServiceRequestId()));
                continue;
            }

            // One-time compatibility link for legacy requests created before service_usage_id
            // was populated. Exact booking/service/quantity/amount matching prevents unrelated
            // free-benefit requests from consuming a paid usage row. Nearest timestamp resolves
            // repeated orders for the same service.
            ServiceRequest legacyMatch = existingRequests.stream()
                    .filter(r -> r.getServiceRequestId() != null && !claimedRequestIds.contains(r.getServiceRequestId()))
                    .filter(r -> r.getServiceUsage() == null)
                    .filter(r -> r.getBooking() != null
                            && usage.getBooking().getBookingId().equals(r.getBooking().getBookingId()))
                    .filter(r -> r.getService() != null
                            && usage.getService().getServiceId().equals(r.getService().getServiceId()))
                    .filter(r -> java.util.Objects.equals(
                            r.getQuantity() != null ? r.getQuantity() : 1,
                            usage.getQuantity() != null ? usage.getQuantity() : 1))
                    .filter(r -> r.getFeeAmount() != null && usage.getTotalPrice() != null
                            && r.getFeeAmount().compareTo(usage.getTotalPrice()) == 0)
                    .filter(r -> r.getRequestedAt() != null && usage.getUsedAt() != null
                            && Math.abs(java.time.temporal.ChronoUnit.MINUTES.between(usage.getUsedAt(), r.getRequestedAt())) <= 30)
                    .min(Comparator.comparingLong(r -> {
                        if (r.getRequestedAt() == null || usage.getUsedAt() == null) return Long.MAX_VALUE;
                        return Math.abs(java.time.temporal.ChronoUnit.MILLIS.between(usage.getUsedAt(), r.getRequestedAt()));
                    }))
                    .orElse(null);

            if (legacyMatch != null) {
                legacyMatch.setServiceUsage(usage);
                ServiceRequest saved = serviceRequestRepository.save(legacyMatch);
                claimedRequestIds.add(saved.getServiceRequestId());
                log.info("Linked legacy ServiceRequest #{} to ServiceUsage #{}", saved.getServiceRequestId(), usage.getUsageId());
                continue;
            }

            List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(usage.getBooking().getBookingId());
            Room room = bookingRooms.stream()
                    .filter(br -> br.getRoom() != null && "CHECKED_IN".equalsIgnoreCase(br.getStatus()))
                    .sorted(Comparator.comparing(br -> br.getRoom().getRoomId()))
                    .map(BookingRoom::getRoom)
                    .findFirst()
                    .orElseGet(() -> bookingRooms.stream()
                            .filter(br -> br.getRoom() != null)
                            .sorted(Comparator.comparing(br -> br.getRoom().getRoomId()))
                            .map(BookingRoom::getRoom)
                            .findFirst().orElse(null));
            Customer customer = usage.getBooking().getCustomer();

            // Never fabricate a room/customer by selecting the first unrelated database row.
            if (room == null || customer == null) {
                log.warn("Skipping ServiceUsage #{} sync: booking has no resolvable room/customer", usage.getUsageId());
                continue;
            }

            int qty = usage.getQuantity() != null && usage.getQuantity() > 0 ? usage.getQuantity() : 1;
            BigDecimal fee = usage.getTotalPrice() != null ? usage.getTotalPrice() : BigDecimal.ZERO;
            String initialStatus = (usage.getStatus() != null && !usage.getStatus().isBlank())
                    ? usage.getStatus().toUpperCase() : "PENDING";
            if ("CHARGED_TO_ROOM".equalsIgnoreCase(initialStatus)) {
                initialStatus = "PENDING";
            } else if ("IN_PROGRESS".equalsIgnoreCase(initialStatus)) {
                initialStatus = "DELIVERING";
            }

            ServiceRequest saved = serviceRequestRepository.save(ServiceRequest.builder()
                    .booking(usage.getBooking())
                    .room(room)
                    .service(usage.getService())
                    .customer(customer)
                    .serviceUsage(usage)
                    .quantity(qty)
                    .feeAmount(fee)
                    .status(initialStatus)
                    .note("Yêu cầu dịch vụ phòng")
                    .invoice(usage.getInvoice())
                    .requestedAt(usage.getUsedAt() != null ? usage.getUsedAt() : LocalDateTime.now())
                    .build());
            existingRequests.add(saved);
            claimedRequestIds.add(saved.getServiceRequestId());
            log.info("Synced ServiceUsage #{} to ServiceRequest #{}", usage.getUsageId(), saved.getServiceRequestId());
        }
    }

    private void updateMatchingServiceUsageStatus(ServiceRequest req, String status) {
        try {
            ServiceUsage usage = req.getServiceUsage();
            if (usage == null) return;
            usage.setStatus(status);
            serviceUsageRepository.save(usage);
            log.info("Đã đồng bộ ServiceUsage #{} sang trạng thái {}", usage.getUsageId(), status);
            recalculateActiveInvoice(req.getBooking());
        } catch (Exception e) {
            log.warn("Không thể cập nhật ServiceUsage đồng bộ: {}", e.getMessage());
        }
    }

    private void recalculateActiveInvoice(Booking booking) {
        if (booking == null) return;
        try {
            List<com.example.pbl6.entity.Invoice> invoices = invoiceRepository.findByBooking_BookingId(booking.getBookingId());
            com.example.pbl6.entity.Invoice activeInvoice = invoices.stream()
                    .filter(inv -> !"CANCELED".equalsIgnoreCase(inv.getStatus()))
                    .findFirst()
                    .orElse(null);
            if (activeInvoice != null) {
                List<ServiceUsage> usages = serviceUsageRepository.findByBooking_BookingId(booking.getBookingId());
                BigDecimal activeServiceCharge = usages.stream()
                        .filter(u -> !"CANCELED".equalsIgnoreCase(u.getStatus()) && !"CANCELLED".equalsIgnoreCase(u.getStatus()))
                        .map(u -> u.getTotalPrice() != null ? u.getTotalPrice() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                activeInvoice.setServiceCharge(activeServiceCharge);
                BigDecimal roomCharge = activeInvoice.getRoomCharge() != null ? activeInvoice.getRoomCharge() : BigDecimal.ZERO;
                BigDecimal subtotal = roomCharge.add(activeServiceCharge);
                BigDecimal tax = financialCalculator.calculateTax(subtotal);
                activeInvoice.setTaxAmount(tax);

                BigDecimal depositApplied = activeInvoice.getDepositApplied() != null ? activeInvoice.getDepositApplied() : BigDecimal.ZERO;
                BigDecimal discount = activeInvoice.getDiscountAmount() != null ? activeInvoice.getDiscountAmount() : BigDecimal.ZERO;
                BigDecimal finalTotal = subtotal.add(tax).subtract(discount).subtract(depositApplied);
                activeInvoice.setTotalAmount(finalTotal.compareTo(BigDecimal.ZERO) > 0 ? finalTotal : BigDecimal.ZERO);
                invoiceRepository.save(activeInvoice);
                log.info("Đã tính lại Invoice #{} sau khi cập nhật dịch vụ. Phí dịch vụ: {}", activeInvoice.getInvoiceNumber(), activeServiceCharge);
            }
        } catch (Exception e) {
            log.warn("Lỗi tính lại Invoice: {}", e.getMessage());
        }
    }
}
