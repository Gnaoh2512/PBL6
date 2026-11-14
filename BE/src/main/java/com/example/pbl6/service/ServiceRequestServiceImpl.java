package com.example.pbl6.service;

import com.example.pbl6.dto.servicerequest.CreateServiceRequestDto;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.BenefitRedemption;
import com.example.pbl6.entity.Booking;
import com.example.pbl6.entity.BookingRoom;
import com.example.pbl6.entity.Customer;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.ServiceRequest;
import com.example.pbl6.entity.ServiceUsage;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.BookingRepository;
import com.example.pbl6.repository.BenefitRedemptionRepository;
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
    private final BenefitRedemptionRepository benefitRedemptionRepository;
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

        return toResponse(saved);
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
                .map(this::toResponse)
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

        return toResponse(saved);
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
                .sorted(Comparator.comparing(ServiceRequest::getRequestedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
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

        return toResponse(saved);
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

        return toResponse(saved);
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

        return toResponse(saved);
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

        return toResponse(saved);
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
                .map(this::toResponse)
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
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<ServiceRequestResponse> getRequestsByBookingCode(String bookingCode) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode.trim().toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));
        return getRequestsByBookingId(booking.getBookingId());
    }

    private ServiceRequestResponse toResponse(ServiceRequest request) {
        BenefitRedemption redemption = benefitRedemptionRepository
                .findFirstByServiceRequest_ServiceRequestId(request.getServiceRequestId())
                .orElseGet(() -> request.getServiceUsage() == null ? null
                        : benefitRedemptionRepository.findFirstByServiceUsage_UsageId(request.getServiceUsage().getUsageId()).orElse(null));
        return ServiceRequestResponse.fromEntity(request, redemption);
    }

    private void linkUsageRedemption(ServiceRequest request, ServiceUsage usage) {
        benefitRedemptionRepository.findFirstByServiceUsage_UsageId(usage.getUsageId()).ifPresent(redemption -> {
            if (redemption.getServiceRequest() == null) {
                redemption.setServiceRequest(request);
                benefitRedemptionRepository.save(redemption);
            }
        });
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

        for (ServiceUsage u : usages) {
            if (u.getBooking() == null || u.getService() == null) continue;

            List<ServiceRequest> matchingRequests = existingRequests.stream().filter(r -> {
                try {
                    return r.getBooking() != null && u.getBooking() != null
                            && r.getBooking().getBookingId().equals(u.getBooking().getBookingId())
                            && r.getService() != null && u.getService() != null
                            && r.getService().getServiceId().equals(u.getService().getServiceId());
                } catch (Exception ignored) {
                    return false;
                }
            }).toList();
            boolean exists = !matchingRequests.isEmpty();

            if (matchingRequests.size() == 1 && matchingRequests.get(0).getServiceUsage() == null) {
                ServiceRequest matched = matchingRequests.get(0);
                matched.setServiceUsage(u);
                serviceRequestRepository.save(matched);
                linkUsageRedemption(matched, u);
            }

            if (!exists) {
                Room room = null;
                List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(u.getBooking().getBookingId());
                for (BookingRoom br : bookingRooms) {
                    if (br.getRoom() != null) {
                        room = br.getRoom();
                        break;
                    }
                }
                if (room == null) {
                    room = roomRepository.findAll().stream().findFirst().orElse(null);
                }

                Customer customer = u.getBooking().getCustomer();
                if (customer == null) {
                    customer = customerRepository.findAll().stream().findFirst().orElse(null);
                }

                if (room != null && customer != null) {
                    int qty = u.getQuantity() != null && u.getQuantity() > 0 ? u.getQuantity() : 1;
                    BigDecimal fee = u.getTotalPrice() != null ? u.getTotalPrice() : BigDecimal.ZERO;
                    String initialStatus = (u.getStatus() != null && !u.getStatus().isBlank()) ? u.getStatus().toUpperCase() : "PENDING";
                    if ("CHARGED_TO_ROOM".equalsIgnoreCase(initialStatus)) {
                        initialStatus = "PENDING";
                    } else if ("IN_PROGRESS".equalsIgnoreCase(initialStatus)) {
                        initialStatus = "DELIVERING";
                    }

                    ServiceRequest req = ServiceRequest.builder()
                            .booking(u.getBooking())
                            .room(room)
                            .service(u.getService())
                            .customer(customer)
                            .quantity(qty)
                            .feeAmount(fee)
                            .status(initialStatus)
                            .note("Yêu cầu dịch vụ phòng")
                            .invoice(u.getInvoice())
                            .serviceUsage(u)
                            .requestedAt(u.getUsedAt() != null ? u.getUsedAt() : LocalDateTime.now())
                            .build();

                    ServiceRequest saved = serviceRequestRepository.save(req);
                    existingRequests.add(saved);
                    linkUsageRedemption(saved, u);
                    log.info("Tự động đồng bộ ServiceUsage #{} sang ServiceRequest #{}", u.getUsageId(), saved.getServiceRequestId());
                }
            }
        }
    }

    private void updateMatchingServiceUsageStatus(ServiceRequest req, String status) {
        try {
            if (req.getBooking() != null && req.getService() != null) {
                List<ServiceUsage> usages = serviceUsageRepository.findByBooking_BookingId(req.getBooking().getBookingId());
                ServiceUsage target = null;
                for (ServiceUsage u : usages) {
                    if (u.getService() != null && u.getService().getServiceId().equals(req.getService().getServiceId())
                            && !"SETTLED".equalsIgnoreCase(u.getStatus())) {
                        if (!status.equalsIgnoreCase(u.getStatus())) {
                            target = u;
                            break;
                        }
                    }
                }
                if (target == null && !usages.isEmpty()) {
                    for (ServiceUsage u : usages) {
                        if (u.getService() != null && u.getService().getServiceId().equals(req.getService().getServiceId())) {
                            target = u;
                            break;
                        }
                    }
                }
                if (target != null) {
                    target.setStatus(status);
                    serviceUsageRepository.save(target);
                    log.info("Đã đồng bộ ServiceUsage #{} sang trạng thái {}", target.getUsageId(), status);
                    recalculateActiveInvoice(req.getBooking());
                }
            }
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
