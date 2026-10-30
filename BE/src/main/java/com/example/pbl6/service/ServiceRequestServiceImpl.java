package com.example.pbl6.service;

import com.example.pbl6.dto.servicerequest.CreateServiceRequestDto;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.Booking;
import com.example.pbl6.entity.Customer;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.ServiceRequest;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.BookingRepository;
import com.example.pbl6.repository.CustomerRepository;
import com.example.pbl6.repository.InvoiceRepository;
import com.example.pbl6.repository.RoomRepository;
import com.example.pbl6.repository.ServiceRepository;
import com.example.pbl6.repository.ServiceRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceRequestServiceImpl implements ServiceRequestService {

    private final ServiceRequestRepository serviceRequestRepository;
    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final ServiceRepository serviceRepository;
    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public ServiceRequestResponse createRequest(CreateServiceRequestDto dto, String username) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + username));

        Customer customer = customerRepository.findByEmail(account.getEmail())
                .orElseGet(() -> customerRepository.findAll().stream()
                        .filter(c -> c.getAccount() != null && c.getAccount().getAccountId().equals(account.getAccountId()))
                        .findFirst()
                        .orElseThrow(() -> new ResourceNotFoundException("Tài khoản chưa được liên kết thông tin khách hàng")));

        Booking booking = bookingRepository.findById(dto.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin đặt phòng: " + dto.getBookingId()));

        Room room = roomRepository.findById(dto.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin phòng: " + dto.getRoomId()));

        com.example.pbl6.entity.Service service = serviceRepository.findById(dto.getServiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ: " + dto.getServiceId()));

        int qty = dto.getQuantity() != null && dto.getQuantity() > 0 ? dto.getQuantity() : 1;
        BigDecimal fee = service.getUnitPrice() != null 
                ? service.getUnitPrice().multiply(BigDecimal.valueOf(qty)) 
                : BigDecimal.ZERO;

        ServiceRequest request = ServiceRequest.builder()
                .booking(booking)
                .room(room)
                .service(service)
                .customer(customer)
                .quantity(qty)
                .feeAmount(fee)
                .status("PENDING")
                .note(dto.getNote())
                .build();

        ServiceRequest saved = serviceRequestRepository.save(request);
        log.info("Created service request #{} for room {}", saved.getServiceRequestId(), room.getRoomNumber());

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
                .filter(r -> r.getCustomer() != null && r.getCustomer().getAccount() != null 
                        && r.getCustomer().getAccount().getAccountId().equals(account.getAccountId()))
                .map(ServiceRequestResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ServiceRequestResponse cancelRequest(Integer requestId, String username) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        if (!"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Chỉ có thể hủy yêu cầu khi đang ở trạng thái PENDING");
        }

        request.setStatus("CANCELED");
        ServiceRequest saved = serviceRequestRepository.save(request);

        auditLogService.log("YÊU CẦU DỊCH VỤ", "CANCEL", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Hủy yêu cầu dịch vụ #" + requestId + " bởi " + username);

        return ServiceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ServiceRequestResponse> getAllRequests(String status) {
        List<ServiceRequest> list = (status != null && !status.isBlank())
                ? serviceRequestRepository.findByStatus(status.toUpperCase())
                : serviceRequestRepository.findAll();

        return list.stream()
                .map(ServiceRequestResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ServiceRequestResponse assignRequest(Integer requestId, String staffUsername) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        Account staff = accountRepository.findByUsername(staffUsername)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên: " + staffUsername));

        request.setAssignedTo(staff);
        request.setStatus("IN_PROGRESS");
        ServiceRequest saved = serviceRequestRepository.save(request);

        auditLogService.log(staff, "YÊU CẦU DỊCH VỤ", "ASSIGN", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Nhân viên " + staff.getFullName() + " (" + staffUsername + ") tiếp nhận xử lý yêu cầu dịch vụ #" + requestId);

        return ServiceRequestResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public ServiceRequestResponse completeRequest(Integer requestId, String staffUsername) {
        ServiceRequest request = serviceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu dịch vụ #" + requestId));

        request.setStatus("COMPLETED");
        request.setCompletedAt(LocalDateTime.now());

        // Tự động gắn invoice của booking nếu có
        if (request.getInvoice() == null && request.getBooking() != null) {
            invoiceRepository.findByBooking_BookingId(request.getBooking().getBookingId()).stream()
                    .findFirst()
                    .ifPresent(request::setInvoice);
        }

        ServiceRequest saved = serviceRequestRepository.save(request);

        auditLogService.log("YÊU CẦU DỊCH VỤ", "COMPLETE", "service_request", Long.valueOf(saved.getServiceRequestId()),
                "Hoàn thành phục vụ yêu cầu dịch vụ #" + requestId + " bởi nhân viên " + staffUsername);

        return ServiceRequestResponse.fromEntity(saved);
    }
}
