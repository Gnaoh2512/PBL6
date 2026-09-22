package com.example.pbl6.service;

import com.example.pbl6.common.enums.*;
import com.example.pbl6.dto.billing.CancellationRefundResponse;
import com.example.pbl6.dto.billing.LiveFolioResponse;
import com.example.pbl6.dto.billing.SettlementRequest;
import com.example.pbl6.dto.booking.BankTransferQrResponse;
import com.example.pbl6.dto.service.ServiceOrderRequest;
import com.example.pbl6.dto.service.ServiceResponse;
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
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerBillingServiceImpl implements CustomerBillingService {

    private final ServiceRepository serviceRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final ServiceUsageRepository serviceUsageRepository;
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final RoomRepository roomRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final AccountRepository accountRepository;
    private final FinancialCalculator financialCalculator;
    private final VietQrService vietQrService;

    @Override
    @Transactional(readOnly = true)
    public List<ServiceResponse> getActiveServices(Integer categoryId) {
        List<com.example.pbl6.entity.Service> services;
        if (categoryId != null && categoryId > 0) {
            services = serviceRepository.findByCategory_CategoryIdAndIsActiveTrue(categoryId);
        } else {
            services = serviceRepository.findByIsActiveTrue();
        }

        return services.stream()
                .map(s -> ServiceResponse.builder()
                        .serviceId(s.getServiceId())
                        .categoryName(s.getCategory() != null ? s.getCategory().getCategoryName() : "Khác")
                        .serviceName(s.getServiceName())
                        .unitPrice(s.getUnitPrice())
                        .unit(s.getUnit())
                        .isActive(s.getIsActive())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ServiceUsageResponse orderInStayService(ServiceOrderRequest request, String username) {
        Booking booking = bookingRepository.findByBookingCode(request.getBookingCode())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + request.getBookingCode()));

        if (BookingStatus.CANCELED.name().equalsIgnoreCase(booking.getStatus()) ||
                BookingStatus.EXPIRED.name().equalsIgnoreCase(booking.getStatus()) ||
                BookingStatus.CHECKED_OUT.name().equalsIgnoreCase(booking.getStatus())) {
            throw new IllegalStateException("Không thể gọi dịch vụ cho đơn ở trạng thái: " + booking.getStatus());
        }

        com.example.pbl6.entity.Service serviceEntity = serviceRepository.findById(request.getServiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ với ID: " + request.getServiceId()));

        if (Boolean.FALSE.equals(serviceEntity.getIsActive())) {
            throw new IllegalArgumentException("Dịch vụ này hiện đang tạm ngưng cung cấp");
        }

        Account recordedByAccount = null;
        if (StringUtils.hasText(username)) {
            recordedByAccount = accountRepository.findByUsername(username).orElse(null);
        }

        int quantity = request.getQuantity() != null && request.getQuantity() > 0 ? request.getQuantity() : 1;
        BigDecimal unitPrice = serviceEntity.getUnitPrice() != null ? serviceEntity.getUnitPrice() : BigDecimal.ZERO;
        BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);

        // Tìm hóa đơn DRAFT liên kết với đơn nếu có
        List<Invoice> invoices = invoiceRepository.findByBooking_BookingId(booking.getBookingId());
        Invoice activeInvoice = invoices.stream()
                .filter(inv -> !InvoiceStatus.CANCELED.name().equalsIgnoreCase(inv.getStatus()))
                .findFirst()
                .orElse(null);

        ServiceUsage usage = ServiceUsage.builder()
                .booking(booking)
                .service(serviceEntity)
                .invoice(activeInvoice)
                .quantity(quantity)
                .unitPriceApplied(unitPrice)
                .discountAmount(BigDecimal.ZERO)
                .totalPrice(totalPrice)
                .status("CHARGED_TO_ROOM")
                .recordedBy(recordedByAccount)
                .build();

        ServiceUsage savedUsage = serviceUsageRepository.save(usage);

        // Nếu đã có Invoice, cập nhật trường serviceCharge và totalAmount
        if (activeInvoice != null) {
            BigDecimal currentServiceCharge = activeInvoice.getServiceCharge() != null ? activeInvoice.getServiceCharge() : BigDecimal.ZERO;
            BigDecimal newServiceCharge = currentServiceCharge.add(totalPrice);
            activeInvoice.setServiceCharge(newServiceCharge);

            BigDecimal roomCharge = activeInvoice.getRoomCharge() != null ? activeInvoice.getRoomCharge() : BigDecimal.ZERO;
            BigDecimal subtotal = roomCharge.add(newServiceCharge);
            BigDecimal tax = financialCalculator.calculateTax(subtotal);
            activeInvoice.setTaxAmount(tax);

            BigDecimal depositApplied = activeInvoice.getDepositApplied() != null ? activeInvoice.getDepositApplied() : BigDecimal.ZERO;
            BigDecimal discount = activeInvoice.getDiscountAmount() != null ? activeInvoice.getDiscountAmount() : BigDecimal.ZERO;
            BigDecimal finalTotal = subtotal.add(tax).subtract(discount).subtract(depositApplied);
            activeInvoice.setTotalAmount(finalTotal.compareTo(BigDecimal.ZERO) > 0 ? finalTotal : BigDecimal.ZERO);

            invoiceRepository.save(activeInvoice);
        }

        log.info("Khách phòng {} (Đơn {}) đã order {} x {} (Tổng: {}đ)",
                booking.getBookingCode(), serviceEntity.getServiceName(), quantity, totalPrice);

        return mapToServiceUsageResponse(savedUsage);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ServiceUsageResponse> getServicesUsed(String bookingCode) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        return serviceUsageRepository.findByBooking_BookingId(booking.getBookingId()).stream()
                .map(this::mapToServiceUsageResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public LiveFolioResponse getLiveFolio(String bookingCode) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        Room room = (!bookingRooms.isEmpty() && bookingRooms.get(0).getRoom() != null) ? bookingRooms.get(0).getRoom() : null;

        String roomNumber = room != null ? room.getRoomNumber() : "N/A";
        String roomTypeName = (room != null && room.getRoomType() != null) ? room.getRoomType().getTypeName() : "N/A";
        BigDecimal pricePerNight = (room != null && room.getRoomType() != null && room.getRoomType().getBasePrice() != null)
                ? room.getRoomType().getBasePrice()
                : BigDecimal.ZERO;

        long nights = financialCalculator.calculateNights(booking.getCheckInDate(), booking.getCheckOutDate());
        BigDecimal roomCharge = financialCalculator.calculateTotalRoomCharge(pricePerNight, nights);

        // Lấy danh sách dịch vụ đã dùng
        List<ServiceUsage> usages = serviceUsageRepository.findByBooking_BookingId(booking.getBookingId());
        List<ServiceUsageResponse> usageResponses = usages.stream()
                .map(this::mapToServiceUsageResponse)
                .collect(Collectors.toList());

        BigDecimal serviceCharge = usages.stream()
                .map(u -> u.getTotalPrice() != null ? u.getTotalPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal subtotal = roomCharge.add(serviceCharge);
        BigDecimal taxAmount = financialCalculator.calculateTax(subtotal);
        BigDecimal discountAmount = BigDecimal.ZERO;
        BigDecimal totalAmount = subtotal.add(taxAmount).subtract(discountAmount);

        // Tiền cọc đã nộp và tiền tất toán đã nộp
        List<Payment> payments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
        BigDecimal depositPaid = payments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal settlementPaid = payments.stream()
                .filter(p -> PaymentType.SETTLEMENT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal remainingBalance = totalAmount.subtract(depositPaid).subtract(settlementPaid);
        if (remainingBalance.compareTo(BigDecimal.ZERO) < 0) {
            remainingBalance = BigDecimal.ZERO;
        }

        boolean isFullySettled = remainingBalance.compareTo(BigDecimal.ZERO) <= 0;

        BankTransferQrResponse settlementQr = null;
        if (!isFullySettled && !BookingStatus.CANCELED.name().equalsIgnoreCase(booking.getStatus())) {
            settlementQr = vietQrService.generateSettlementQr(booking.getBookingCode(), remainingBalance);
        }

        Customer customer = booking.getCustomer();

        return LiveFolioResponse.builder()
                .bookingCode(booking.getBookingCode())
                .bookingStatus(booking.getStatus())
                .customerName(customer != null ? customer.getFullName() : "N/A")
                .customerPhone(customer != null ? customer.getPhone() : "N/A")
                .roomNumber(roomNumber)
                .roomTypeName(roomTypeName)
                .checkInDate(booking.getCheckInDate())
                .checkOutDate(booking.getCheckOutDate())
                .nights(nights)
                .pricePerNight(pricePerNight)
                .roomCharge(roomCharge)
                .serviceCharge(serviceCharge)
                .subtotal(subtotal)
                .taxRate(BigDecimal.valueOf(10.0))
                .taxAmount(taxAmount)
                .discountAmount(discountAmount)
                .totalAmount(totalAmount)
                .depositPaid(depositPaid)
                .remainingBalance(remainingBalance)
                .isFullySettled(isFullySettled)
                .services(usageResponses)
                .settlementQr(settlementQr)
                .build();
    }

    @Override
    @Transactional
    public void checkInGuest(String bookingCode, String staffUsername) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        if (!BookingStatus.CONFIRMED.name().equalsIgnoreCase(booking.getStatus())) {
            throw new IllegalStateException("Đơn đặt phòng chỉ có thể Check-in khi đã được xác nhận cọc (CONFIRMED). Hiện tại: " + booking.getStatus());
        }

        booking.setStatus(BookingStatus.CHECKED_IN.name());
        bookingRepository.save(booking);

        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        for (BookingRoom br : bookingRooms) {
            br.setStatus(BookingStatus.CHECKED_IN.name());
            bookingRoomRepository.save(br);

            Room room = br.getRoom();
            if (room != null) {
                room.setStatus(RoomStatus.OCCUPIED.name());
                roomRepository.save(room);
            }
        }

        log.info("Check-in thành công cho khách đơn {}. Phòng chuyển sang OCCUPIED.", bookingCode);
    }

    @Override
    @Transactional
    public LiveFolioResponse settleCheckout(String bookingCode, SettlementRequest request, String cashierUsername) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        if (BookingStatus.CHECKED_OUT.name().equalsIgnoreCase(booking.getStatus())) {
            throw new IllegalStateException("Đơn đặt phòng này đã hoàn tất thủ tục Check-out trước đó");
        }

        LiveFolioResponse folio = getLiveFolio(bookingCode);
        BigDecimal remaining = folio.getRemainingBalance();

        BigDecimal paymentAmount = (request != null && request.getAmount() != null && request.getAmount().compareTo(BigDecimal.ZERO) > 0)
                ? request.getAmount()
                : remaining;

        Account cashierAccount = null;
        if (StringUtils.hasText(cashierUsername)) {
            cashierAccount = accountRepository.findByUsername(cashierUsername).orElse(null);
        }

        // Tìm hoặc tạo Invoice
        List<Invoice> invoices = invoiceRepository.findByBooking_BookingId(booking.getBookingId());
        Invoice invoice = invoices.stream()
                .filter(inv -> !InvoiceStatus.CANCELED.name().equalsIgnoreCase(inv.getStatus()))
                .findFirst()
                .orElse(null);

        if (invoice == null) {
            invoice = Invoice.builder()
                    .invoiceNumber("INV-" + booking.getBookingCode())
                    .booking(booking)
                    .build();
        }

        // Tạo bản ghi Payment SETTLEMENT nếu có số tiền thanh toán
        if (paymentAmount.compareTo(BigDecimal.ZERO) > 0) {
            String method = (request != null && StringUtils.hasText(request.getPaymentMethod()))
                    ? request.getPaymentMethod()
                    : PaymentMethod.CASH.name();

            Payment payment = Payment.builder()
                    .booking(booking)
                    .invoice(invoice)
                    .type(PaymentType.SETTLEMENT.name())
                    .method(method)
                    .amount(paymentAmount)
                    .receivedBy(cashierAccount)
                    .approvedBy(cashierAccount)
                    .note((request != null && StringUtils.hasText(request.getNote()))
                            ? request.getNote()
                            : "Thanh toán tất toán khi trả phòng")
                    .paidAt(LocalDateTime.now())
                    .build();
            paymentRepository.save(payment);
        }

        // Cập nhật Invoice sang PAID
        invoice.setRoomCharge(folio.getRoomCharge());
        invoice.setServiceCharge(folio.getServiceCharge());
        invoice.setTaxAmount(folio.getTaxAmount());
        invoice.setDiscountAmount(folio.getDiscountAmount());
        invoice.setDepositApplied(folio.getDepositPaid());
        invoice.setTotalAmount(folio.getTotalAmount());
        invoice.setStatus(InvoiceStatus.PAID.name());
        invoice.setIssuedBy(cashierAccount);
        invoice.setIssuedAt(LocalDateTime.now());
        invoiceRepository.save(invoice);

        // Cập nhật trạng thái tất cả ServiceUsage sang BILLED
        List<ServiceUsage> usages = serviceUsageRepository.findByBooking_BookingId(booking.getBookingId());
        for (ServiceUsage u : usages) {
            u.setInvoice(invoice);
            u.setStatus("BILLED");
            serviceUsageRepository.save(u);
        }

        // Cập nhật Booking sang CHECKED_OUT
        booking.setStatus(BookingStatus.CHECKED_OUT.name());
        bookingRepository.save(booking);

        // Cập nhật BookingRoom sang CHECKED_OUT và Room sang CLEANING
        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        for (BookingRoom br : bookingRooms) {
            br.setStatus(BookingStatus.CHECKED_OUT.name());
            bookingRoomRepository.save(br);

            Room room = br.getRoom();
            if (room != null) {
                room.setStatus(RoomStatus.CLEANING.name());
                roomRepository.save(room);
            }
        }

        log.info("Đã tất toán hóa đơn và Check-out thành công cho đơn {}. Phòng chuyển sang CLEANING để dọn dẹp.", bookingCode);
        return getLiveFolio(bookingCode);
    }

    @Override
    @Transactional
    public boolean processSettlementWebhook(String bookingCode, BigDecimal amount, String referenceCode) {
        log.info("Xử lý webhook tất toán: bookingCode={}, amount={}, ref={}", bookingCode, amount, referenceCode);
        Optional<Booking> optBooking = bookingRepository.findByBookingCode(bookingCode);
        if (optBooking.isEmpty()) {
            log.warn("Không tìm thấy đơn khi xử lý webhook tất toán: {}", bookingCode);
            return false;
        }

        Booking booking = optBooking.get();
        SettlementRequest request = SettlementRequest.builder()
                .paymentMethod(PaymentMethod.BANK_TRANSFER.name())
                .amount(amount)
                .note("Tất toán tự động qua SePay Webhook (Ref: " + referenceCode + ")")
                .build();

        settleCheckout(booking.getBookingCode(), request, "SYSTEM_WEBHOOK");
        return true;
    }

    @Override
    @Transactional
    public CancellationRefundResponse cancelWithRefundPolicy(String bookingCode, String reason, String username) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        if (BookingStatus.CHECKED_IN.name().equalsIgnoreCase(booking.getStatus()) ||
                BookingStatus.CHECKED_OUT.name().equalsIgnoreCase(booking.getStatus()) ||
                BookingStatus.CANCELED.name().equalsIgnoreCase(booking.getStatus())) {
            throw new IllegalStateException("Không thể hủy đơn đặt phòng ở trạng thái: " + booking.getStatus());
        }

        Account userAccount = null;
        if (StringUtils.hasText(username)) {
            userAccount = accountRepository.findByUsername(username).orElse(null);
        }

        // Tính tiền cọc đã nộp
        List<Payment> payments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
        BigDecimal depositPaid = payments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int refundPercentage = financialCalculator.calculateRefundPercentage(booking.getCheckInDate(), LocalDate.now());
        BigDecimal refundAmount = depositPaid.multiply(BigDecimal.valueOf(refundPercentage))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
        BigDecimal penaltyFee = depositPaid.subtract(refundAmount);

        // Tạo Payment REFUND nếu có hoàn tiền
        if (refundAmount.compareTo(BigDecimal.ZERO) > 0) {
            Payment refundPayment = Payment.builder()
                    .booking(booking)
                    .type(PaymentType.REFUND.name())
                    .method(PaymentMethod.BANK_TRANSFER.name())
                    .amount(refundAmount)
                    .receivedBy(userAccount)
                    .approvedBy(userAccount)
                    .note("Hoàn cọc hủy phòng (" + refundPercentage + "%) do: " + reason)
                    .paidAt(LocalDateTime.now())
                    .build();
            paymentRepository.save(refundPayment);
        }

        // Cập nhật Booking sang CANCELED
        booking.setStatus(BookingStatus.CANCELED.name());
        booking.setCancelReason(reason);
        booking.setCanceledBy(userAccount);
        booking.setCanceledAt(LocalDateTime.now());
        bookingRepository.save(booking);

        // Cập nhật BookingRoom và trả lại Room AVAILABLE
        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        for (BookingRoom br : bookingRooms) {
            br.setStatus(BookingStatus.CANCELED.name());
            bookingRoomRepository.save(br);

            Room room = br.getRoom();
            if (room != null && RoomStatus.OCCUPIED.name().equalsIgnoreCase(room.getStatus())) {
                room.setStatus(RoomStatus.AVAILABLE.name());
                roomRepository.save(room);
            }
        }

        // Cập nhật hóa đơn nếu có
        List<Invoice> invoices = invoiceRepository.findByBooking_BookingId(booking.getBookingId());
        for (Invoice inv : invoices) {
            inv.setStatus(InvoiceStatus.CANCELED.name());
            inv.setCancelReason(reason);
            inv.setCanceledBy(userAccount);
            inv.setCanceledAt(LocalDateTime.now());
            invoiceRepository.save(inv);
        }

        String msg = String.format("Hủy đơn thành công. Tỷ lệ hoàn cọc: %d%% (Hoàn lại: %sđ, Phí phạt: %sđ)",
                refundPercentage, refundAmount, penaltyFee);
        log.info("Đơn {}: {}", bookingCode, msg);

        return CancellationRefundResponse.builder()
                .bookingCode(bookingCode)
                .depositPaid(depositPaid)
                .refundPercentage(refundPercentage)
                .refundAmount(refundAmount)
                .penaltyFee(penaltyFee)
                .status("CANCELED")
                .message(msg)
                .build();
    }

    private ServiceUsageResponse mapToServiceUsageResponse(ServiceUsage u) {
        return ServiceUsageResponse.builder()
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
                .build();
    }
}
