package com.example.pbl6.service;

import com.example.pbl6.common.enums.BookingStatus;
import com.example.pbl6.common.enums.PaymentType;
import com.example.pbl6.dto.booking.BankTransferQrResponse;
import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;
import com.example.pbl6.dto.history.PaymentHistoryResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.example.pbl6.entity.*;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.*;
import com.example.pbl6.service.financial.FinancialCalculator;
import com.example.pbl6.service.financial.VietQrService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerHistoryServiceImpl implements CustomerHistoryService {

    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final ServiceUsageRepository serviceUsageRepository;
    private final FinancialCalculator financialCalculator;
    private final VietQrService vietQrService;

    @Override
    @Transactional(readOnly = true)
    public List<CustomerBookingHistorySummaryResponse> getMemberHistory(String username, String status) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản người dùng: " + username));

        Integer customerId = resolveCustomerId(account);
        if (customerId == null) {
            return Collections.emptyList();
        }

        List<Booking> bookings;
        boolean hasStatusFilter = StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status.trim());
        if (hasStatusFilter) {
            bookings = bookingRepository.findByCustomer_CustomerIdAndStatusOrderByCreatedAtDesc(customerId, status.trim().toUpperCase());
        } else {
            bookings = bookingRepository.findByCustomer_CustomerIdOrderByCreatedAtDesc(customerId);
        }

        return bookings.stream().map(this::mapToSummaryResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerBookingHistoryDetailResponse getMemberBookingDetail(String username, String bookingCode) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + username));

        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        // Kiểm tra quyền sở hữu đơn đặt phòng của tài khoản thành viên
        Integer customerId = resolveCustomerId(account);
        if (booking.getCustomer() == null || !booking.getCustomer().getCustomerId().equals(customerId)) {
            // Trường hợp tài khoản khớp qua SĐT hoặc Email
            boolean matchPhone = StringUtils.hasText(account.getPhone()) &&
                    account.getPhone().equals(booking.getCustomer() != null ? booking.getCustomer().getPhone() : null);
            boolean matchEmail = StringUtils.hasText(account.getEmail()) &&
                    account.getEmail().equalsIgnoreCase(booking.getCustomer() != null ? booking.getCustomer().getEmail() : null);
            if (!matchPhone && !matchEmail) {
                throw new IllegalArgumentException("Bạn không có quyền truy cập thông tin đơn đặt phòng này");
            }
        }

        return buildDetailResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerBookingHistorySummaryResponse> lookupPublicHistoryByPhone(String phone, String status) {
        if (!StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("Số điện thoại không được để trống khi tra cứu lịch sử");
        }

        String cleanPhone = phone.trim();
        List<Booking> bookings;
        boolean hasStatusFilter = StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status.trim());
        if (hasStatusFilter) {
            bookings = bookingRepository.findByCustomer_PhoneAndStatusOrderByCreatedAtDesc(cleanPhone, status.trim().toUpperCase());
        } else {
            bookings = bookingRepository.findByCustomer_PhoneOrderByCreatedAtDesc(cleanPhone);
        }

        return bookings.stream().map(this::mapToSummaryResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerBookingHistoryDetailResponse lookupPublicBookingDetail(String bookingCode, String phone) {
        if (!StringUtils.hasText(bookingCode) || !StringUtils.hasText(phone)) {
            throw new IllegalArgumentException("Vui lòng cung cấp cả Mã đơn và Số điện thoại để tra cứu");
        }

        Booking booking = bookingRepository.findByBookingCode(bookingCode.trim().toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng với mã: " + bookingCode));

        // Kiểm tra đối soát bảo mật: Số điện thoại phải khớp với hồ sơ khách của đơn
        Customer customer = booking.getCustomer();
        if (customer == null || !phone.trim().equals(customer.getPhone() != null ? customer.getPhone().trim() : "")) {
            throw new IllegalArgumentException("Số điện thoại không trùng khớp với thông tin đơn đặt phòng");
        }

        return buildDetailResponse(booking);
    }

    private Integer resolveCustomerId(Account account) {
        if (StringUtils.hasText(account.getEmail())) {
            Optional<Customer> custOpt = customerRepository.findByEmail(account.getEmail());
            if (custOpt.isPresent()) return custOpt.get().getCustomerId();
        }
        if (StringUtils.hasText(account.getPhone())) {
            Optional<Customer> custOpt = customerRepository.findByPhone(account.getPhone());
            if (custOpt.isPresent()) return custOpt.get().getCustomerId();
        }
        return account.getAccountId();
    }

    private CustomerBookingHistorySummaryResponse mapToSummaryResponse(Booking booking) {
        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        Room room = (!bookingRooms.isEmpty() && bookingRooms.get(0).getRoom() != null) ? bookingRooms.get(0).getRoom() : null;

        String roomNumber = room != null ? room.getRoomNumber() : "N/A";
        String roomTypeName = (room != null && room.getRoomType() != null) ? room.getRoomType().getTypeName() : "N/A";
        BigDecimal basePrice = (room != null && room.getRoomType() != null && room.getRoomType().getBasePrice() != null)
                ? room.getRoomType().getBasePrice()
                : BigDecimal.ZERO;

        long nights = financialCalculator.calculateNights(booking.getCheckInDate(), booking.getCheckOutDate());
        BigDecimal totalRoomCharge = financialCalculator.calculateTotalRoomCharge(basePrice, nights);
        BigDecimal tax = financialCalculator.calculateTax(totalRoomCharge);
        BigDecimal estimatedTotal = totalRoomCharge.add(tax);

        List<Payment> payments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
        BigDecimal depositPaid = payments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal settlementPaid = payments.stream()
                .filter(p -> PaymentType.SETTLEMENT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        boolean isPaidFull = BookingStatus.CHECKED_OUT.name().equalsIgnoreCase(booking.getStatus()) ||
                (depositPaid.add(settlementPaid).compareTo(estimatedTotal) >= 0 && estimatedTotal.compareTo(BigDecimal.ZERO) > 0);

        return CustomerBookingHistorySummaryResponse.builder()
                .bookingCode(booking.getBookingCode())
                .roomNumber(roomNumber)
                .roomTypeName(roomTypeName)
                .checkInDate(booking.getCheckInDate())
                .checkOutDate(booking.getCheckOutDate())
                .nights(nights)
                .guestCount(booking.getGuestCount())
                .bookingStatus(booking.getStatus())
                .depositRequired(booking.getDepositRequired())
                .depositPaid(depositPaid)
                .totalAmount(estimatedTotal)
                .isPaidFull(isPaidFull)
                .createdAt(booking.getCreatedAt())
                .build();
    }

    private CustomerBookingHistoryDetailResponse buildDetailResponse(Booking booking) {
        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        Room room = (!bookingRooms.isEmpty() && bookingRooms.get(0).getRoom() != null) ? bookingRooms.get(0).getRoom() : null;
        RoomType roomType = room != null ? room.getRoomType() : null;

        String roomNumber = room != null ? room.getRoomNumber() : "N/A";
        Integer floor = room != null ? room.getFloor() : null;
        String roomTypeName = roomType != null ? roomType.getTypeName() : "N/A";
        BigDecimal basePrice = roomType != null && roomType.getBasePrice() != null ? roomType.getBasePrice() : BigDecimal.ZERO;
        String amenities = roomType != null ? roomType.getAmenities() : "";

        long nights = financialCalculator.calculateNights(booking.getCheckInDate(), booking.getCheckOutDate());
        BigDecimal roomCharge = financialCalculator.calculateTotalRoomCharge(basePrice, nights);

        // Lấy dịch vụ đã sử dụng
        List<ServiceUsage> usages = serviceUsageRepository.findByBooking_BookingId(booking.getBookingId());
        List<ServiceUsageResponse> servicesUsed = usages.stream().map(u -> ServiceUsageResponse.builder()
                .usageId(u.getUsageId())
                .serviceId(u.getService() != null ? u.getService().getServiceId() : null)
                .serviceName(u.getService() != null ? u.getService().getServiceName() : "Dịch vụ")
                .categoryName((u.getService() != null && u.getService().getCategory() != null)
                        ? u.getService().getCategory().getCategoryName()
                        : "Khác")
                .quantity(u.getQuantity())
                .unit(u.getService() != null ? u.getService().getUnit() : "")
                .unitPriceApplied(u.getUnitPriceApplied())
                .discountAmount(u.getDiscountAmount())
                .totalPrice(u.getTotalPrice())
                .status(u.getStatus())
                .usedAt(u.getUsedAt())
                .build()).collect(Collectors.toList());

        BigDecimal serviceCharge = usages.stream()
                .map(u -> u.getTotalPrice() != null ? u.getTotalPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal subtotal = roomCharge.add(serviceCharge);
        BigDecimal taxAmount = financialCalculator.calculateTax(subtotal);
        BigDecimal discountAmount = BigDecimal.ZERO;
        BigDecimal totalAmount = subtotal.add(taxAmount).subtract(discountAmount);

        // Lấy lịch sử giao dịch thanh toán
        List<Payment> payments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
        List<PaymentHistoryResponse> paymentTransactions = payments.stream().map(p -> PaymentHistoryResponse.builder()
                .paymentId(p.getPaymentId())
                .type(p.getType())
                .method(p.getMethod())
                .amount(p.getAmount())
                .note(p.getNote())
                .paidAt(p.getPaidAt())
                .build()).collect(Collectors.toList());

        BigDecimal depositPaid = payments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal settlementPaid = payments.stream()
                .filter(p -> PaymentType.SETTLEMENT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal refundPaid = payments.stream()
                .filter(p -> PaymentType.REFUND.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal remainingBalance = totalAmount.subtract(depositPaid).subtract(settlementPaid);
        if (remainingBalance.compareTo(BigDecimal.ZERO) < 0) {
            remainingBalance = BigDecimal.ZERO;
        }

        boolean isFullySettled = BookingStatus.CHECKED_OUT.name().equalsIgnoreCase(booking.getStatus()) ||
                remainingBalance.compareTo(BigDecimal.ZERO) <= 0;

        // Lấy hóa đơn nếu có
        List<Invoice> invoices = invoiceRepository.findByBooking_BookingId(booking.getBookingId());
        Invoice invoice = invoices.isEmpty() ? null : invoices.get(0);

        // Mã VietQR nếu đơn còn cần thanh toán
        BankTransferQrResponse qrCode = null;
        if (BookingStatus.PENDING_DEPOSIT.name().equalsIgnoreCase(booking.getStatus())) {
            qrCode = vietQrService.generateDepositQr(booking.getBookingCode(), booking.getDepositRequired());
        } else if (BookingStatus.CHECKED_IN.name().equalsIgnoreCase(booking.getStatus()) && !isFullySettled) {
            qrCode = vietQrService.generateSettlementQr(booking.getBookingCode(), remainingBalance);
        }

        Customer customer = booking.getCustomer();

        return CustomerBookingHistoryDetailResponse.builder()
                .bookingCode(booking.getBookingCode())
                .bookingStatus(booking.getStatus())
                .createdAt(booking.getCreatedAt())
                .customerName(customer != null ? customer.getFullName() : "N/A")
                .customerPhone(customer != null ? customer.getPhone() : "N/A")
                .customerEmail(customer != null ? customer.getEmail() : "N/A")
                .roomNumber(roomNumber)
                .floor(floor)
                .roomTypeName(roomTypeName)
                .pricePerNight(basePrice)
                .amenities(amenities)
                .checkInDate(booking.getCheckInDate())
                .checkOutDate(booking.getCheckOutDate())
                .nights(nights)
                .guestCount(booking.getGuestCount())
                .note(booking.getNote())
                .roomCharge(roomCharge)
                .serviceCharge(serviceCharge)
                .subtotal(subtotal)
                .taxRate(BigDecimal.valueOf(10.0))
                .taxAmount(taxAmount)
                .discountAmount(discountAmount)
                .totalAmount(totalAmount)
                .depositRequired(booking.getDepositRequired())
                .depositPaid(depositPaid)
                .settlementPaid(settlementPaid)
                .remainingBalance(remainingBalance)
                .isFullySettled(isFullySettled)
                .servicesUsed(servicesUsed)
                .paymentTransactions(paymentTransactions)
                .invoiceNumber(invoice != null ? invoice.getInvoiceNumber() : null)
                .invoiceStatus(invoice != null ? invoice.getStatus() : null)
                .invoiceIssuedAt(invoice != null ? invoice.getIssuedAt() : null)
                .canceledAt(booking.getCanceledAt())
                .cancelReason(booking.getCancelReason())
                .refundAmount(refundPaid)
                .qrCode(qrCode)
                .build();
    }
}
