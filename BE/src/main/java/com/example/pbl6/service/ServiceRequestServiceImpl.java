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
import com.example.pbl6.repository.BenefitRedemptionRepository;
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
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceRequestServiceImpl implements ServiceRequestService {

    private final LoyaltyBenefitSupport loyaltyBenefitSupport;
    private final BenefitRedemptionRepository benefitRedemptionRepository;
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
    private final AuditLogService auditLogService;
    private final ShiftGuard shiftGuard;

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
            shiftGuard.ensureOnShift(assignedStaff, "ROLE_SERVICE_STAFF", account, "YÊU CẦU DỊCH VỤ", "service_request", null);
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

        return loyaltyBenefitSupport.toResponse(saved);
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
                .collect(Collectors.collectingAndThen(Collectors.toList(), loyaltyBenefitSupport::toResponses));
    }

    @Override
    @Transactional
    public List<ServiceRequestResponse> getAllRequests(String status) {
        return getAllRequests(status, null, false);
    }

    @Override
    @Transactional
    public List<ServiceRequestResponse> getAllRequests(String status, String actorUsername, boolean ownOnly) {
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

        if (ownOnly) {
            list = list.stream()
                    // own tasks + the shared pool of unassigned pending requests that can be claimed
                    .filter(r -> (r.getAssignedTo() != null && r.getAssignedTo().getUsername() != null
                            && r.getAssignedTo().getUsername().equalsIgnoreCase(actorUsername))
                            || (r.getAssignedTo() == null && "PENDING".equalsIgnoreCase(r.getStatus())))
                    .collect(Collectors.toList());
        }

        return list.stream()
                .sorted((a, b) -> {
                    if (a.getServiceRequestId() != null && b.getServiceRequestId() != null) {
                        return b.getServiceRequestId().compareTo(a.getServiceRequestId());
                    }
                    return 0;
                })
                .collect(Collectors.collectingAndThen(Collectors.toList(), loyaltyBenefitSupport::toResponses));
    }

    @Override
    @Transactional
    public ServiceRequestResponse completeRequest(Integer requestId, String staffUsername) {
        return completeRequest(requestId, staffUsername, false);
    }

    @Override
    @Transactional
    public ServiceRequestResponse completeRequest(Integer requestId, String staffUsername, boolean ownOnly) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        if (ownOnly && (request.getAssignedTo() == null || request.getAssignedTo().getUsername() == null
                || !request.getAssignedTo().getUsername().equalsIgnoreCase(staffUsername))) {
            throw new org.springframework.security.access.AccessDeniedException("Bạn chỉ có thể hoàn tất yêu cầu được phân công cho mình");
        }

        if (!isDelivering(request.getStatus())) {
            throw new IllegalStateException("Chỉ có thể hoàn tất yêu cầu đang ở trạng thái Đang giao (hiện tại: " + request.getStatus() + ")");
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
                "Hoàn thành phục vụ yêu cầu dịch vụ #" + requestId + " (Đang giao → Hoàn tất) bởi nhân viên " + staffUsername);

        return loyaltyBenefitSupport.toResponse(saved);
    }

    private static boolean isDelivering(String status) {
        return "DELIVERING".equalsIgnoreCase(status) || "IN_PROGRESS".equalsIgnoreCase(status);
    }

    private Account findActor(String username) {
        return StringUtils.hasText(username) ? accountRepository.findByUsername(username).orElse(null) : null;
    }

    @Override
    @Transactional
    public ServiceRequestResponse assignRequest(Integer requestId, String staffUsername) {
        // Legacy self-assign path: same rules as claiming a request from the pool
        return claimRequest(requestId, staffUsername);
    }

    @Override
    @Transactional
    public ServiceRequestResponse claimRequest(Integer requestId, String actorUsername) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));
        Account staff = accountRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + actorUsername));

        if (!"PENDING".equalsIgnoreCase(request.getStatus()) || request.getAssignedTo() != null) {
            throw new IllegalStateException("Yêu cầu này đã được nhận hoặc không còn ở trạng thái chờ xử lý");
        }
        shiftGuard.ensureOnShift(staff, "ROLE_SERVICE_STAFF", staff, "YÊU CẦU DỊCH VỤ", "service_request", requestId);

        request.setAssignedTo(staff);
        request.setStatus("DELIVERING");
        ServiceRequest saved = serviceRequestRepository.save(request);
        updateMatchingServiceUsageStatus(saved, "DELIVERING");

        auditLogService.log(staff, "YÊU CẦU DỊCH VỤ", "CLAIM", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Nhân viên " + staff.getFullName() + " (" + staff.getUsername() + ") nhận yêu cầu dịch vụ #" + requestId + " (Chờ xử lý → Đang giao)");
        return loyaltyBenefitSupport.toResponse(saved);
    }

    @Override
    @Transactional
    public ServiceRequestResponse assignRequestToStaff(Integer requestId, Integer staffAccountId, String actorUsername) {
        if (staffAccountId == null) {
            throw new IllegalArgumentException("Vui lòng chọn nhân viên phục vụ để phân công");
        }

        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        String oldStatus = request.getStatus();
        if (!"PENDING".equalsIgnoreCase(oldStatus) && !isDelivering(oldStatus)) {
            throw new IllegalStateException("Chỉ có thể phân công yêu cầu đang chờ xử lý hoặc đang giao (hiện tại: " + oldStatus + ")");
        }

        Account staff = accountRepository.findById(staffAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên phục vụ #" + staffAccountId));
        shiftGuard.ensureOnShift(staff, "ROLE_SERVICE_STAFF", findActor(actorUsername), "YÊU CẦU DỊCH VỤ", "service_request", requestId);

        request.setAssignedTo(staff);
        request.setStatus("DELIVERING");
        ServiceRequest saved = serviceRequestRepository.save(request);
        updateMatchingServiceUsageStatus(saved, "DELIVERING");

        auditLogService.log("YÊU CẦU DỊCH VỤ", "ASSIGN", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Phân công nhân viên " + staff.getFullName() + " phục vụ yêu cầu dịch vụ #" + requestId + " (" + oldStatus + " → DELIVERING, bởi " + actorUsername + ")");
        return loyaltyBenefitSupport.toResponse(saved);
    }

    @Override
    @Transactional
    public ServiceRequestResponse cancelRequest(Integer requestId, String username) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        String oldStatus = request.getStatus();
        if ("COMPLETED".equalsIgnoreCase(oldStatus)) {
            throw new IllegalStateException("Không thể hủy yêu cầu dịch vụ đã hoàn tất");
        }
        if ("CANCELED".equalsIgnoreCase(oldStatus) || "CANCELLED".equalsIgnoreCase(oldStatus)) {
            throw new IllegalStateException("Yêu cầu dịch vụ này đã được hủy trước đó");
        }

        request.setStatus("CANCELED");
        ServiceRequest saved = serviceRequestRepository.save(request);
        updateMatchingServiceUsageStatus(saved, "CANCELED");
        voidBenefitRedemption(saved, username);

        auditLogService.log("YÊU CẦU DỊCH VỤ", "CANCEL", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Hủy yêu cầu dịch vụ #" + requestId + " (" + oldStatus + " → CANCELED) bởi " + username);
        return loyaltyBenefitSupport.toResponse(saved);
    }

    /** A cancelled free-benefit request gives the guest that use of the benefit back. */
    private void voidBenefitRedemption(ServiceRequest request, String username) {
        benefitRedemptionRepository.findFirstByServiceRequest_ServiceRequestId(request.getServiceRequestId())
                .filter(r -> BenefitRedemption.STATUS_APPLIED.equals(r.getStatus()))
                .ifPresent(r -> {
                    r.setStatus(BenefitRedemption.STATUS_VOIDED);
                    r.setVoidedAt(LocalDateTime.now());
                    r.setVoidReason("Yêu cầu dịch vụ đã bị hủy");
                    r.setVoidedBy(findActor(username));
                    benefitRedemptionRepository.save(r);
                });
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
