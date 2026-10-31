package com.example.pbl6.service;

import com.example.pbl6.common.enums.*;
import com.example.pbl6.dto.billing.CancelBookingRequest;
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
import org.springframework.security.access.AccessDeniedException;
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
    private final LoyaltyService loyaltyService;
    private final VoucherRepository voucherRepository;
    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final LoyaltyTierRepository loyaltyTierRepository;
    private final AuditLogService auditLogService;

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
        auditLogService.log("ĐẶT PHÒNG", "CHECK_IN", "booking", Long.valueOf(booking.getBookingId()),
                "Lễ tân " + staffUsername + " thực hiện Check-in nhận phòng cho đơn đặt phòng " + bookingCode);
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
        auditLogService.log(cashierAccount, "ĐẶT PHÒNG", "CHECK_OUT", "booking", Long.valueOf(booking.getBookingId()),
                "Tất toán hóa đơn & Check-out phòng cho đơn " + bookingCode + " (Thu ngân: " + (cashierAccount != null ? cashierAccount.getUsername() : cashierUsername) +
                        ", Phương thức: " + (request != null ? request.getPaymentMethod() : "CASH") + ", Tổng thanh toán: " + folio.getTotalAmount() + " VNĐ)");

        // Tự động tích điểm và nâng hạng hội viên Coastal Bay Club
        try {
            loyaltyService.recordStayAndEarnPoints(invoice);
        } catch (Exception e) {
            log.error("Lỗi khi tích điểm khách hàng thân thiết cho hóa đơn #{}: {}", invoice.getInvoiceId(), e.getMessage());
        }

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
        CancelBookingRequest request = CancelBookingRequest.builder()
                .reason(reason)
                .refundOption("CASH_REFUND")
                .build();
        return cancelWithFlexibleOptions(bookingCode, request, username);
    }

    @Override
    @Transactional
    public CancellationRefundResponse cancelWithFlexibleOptions(String bookingCode, CancelBookingRequest request, String username) {
        if (request == null) {
            request = CancelBookingRequest.builder().build();
        }
        String reason = StringUtils.hasText(request.getReason()) ? request.getReason() : "Khách hàng yêu cầu hủy phòng";
        String option = StringUtils.hasText(request.getRefundOption()) ? request.getRefundOption().trim().toUpperCase() : "CASH_REFUND";

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

        // Kiểm tra phân quyền: Nếu là Khách hàng thì chỉ được hủy đơn của chính mình
        if (userAccount != null) {
            String roleCode = userAccount.getRole() != null ? userAccount.getRole().getRoleCode() : "";
            boolean isStaffOrAdmin = roleCode.toUpperCase().contains("ADMIN")
                    || roleCode.toUpperCase().contains("STAFF")
                    || roleCode.toUpperCase().contains("RECEPTIONIST")
                    || roleCode.toUpperCase().contains("MANAGER");
            if (!isStaffOrAdmin) {
                Customer bookingCustomer = booking.getCustomer();
                boolean isOwner = false;
                if (bookingCustomer != null) {
                    if (bookingCustomer.getAccount() != null && bookingCustomer.getAccount().getUsername().equalsIgnoreCase(username)) {
                        isOwner = true;
                    } else if (bookingCustomer.getEmail() != null && bookingCustomer.getEmail().equalsIgnoreCase(userAccount.getEmail())) {
                        isOwner = true;
                    }
                }
                if (!isOwner) {
                    throw new AccessDeniedException("Bạn không có quyền thao tác hủy đơn đặt phòng này");
                }
            }
        }

        // Tính tổng tiền cọc đã nộp
        List<Payment> payments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
        BigDecimal depositPaid = payments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int refundPercentage = 0;
        BigDecimal refundAmount = BigDecimal.ZERO;
        BigDecimal penaltyFee = BigDecimal.ZERO;
        String creditVoucherCode = null;
        BigDecimal loyaltyPointsCredited = BigDecimal.ZERO;
        String messageDetail;

        if (depositPaid.compareTo(BigDecimal.ZERO) <= 0) {
            messageDetail = "Đơn chưa thanh toán tiền cọc, hủy phòng thành công mà không phát sinh hoàn tiền/bảo lưu.";
        } else if ("CREDIT_VOUCHER".equalsIgnoreCase(option)) {
            // Tùy chọn 1: Bảo lưu 100% cọc thành Voucher nghỉ dưỡng 6 tháng
            refundPercentage = 100;
            refundAmount = depositPaid;
            penaltyFee = BigDecimal.ZERO;

            creditVoucherCode = "VCH-RF-" + booking.getBookingCode().toUpperCase();
            if (voucherRepository.existsByCodeIgnoreCase(creditVoucherCode)) {
                creditVoucherCode = "VCH-RF-" + booking.getBookingCode().toUpperCase() + "-" + (System.currentTimeMillis() % 10000);
            }

            Voucher creditVoucher = Voucher.builder()
                    .voucherCode(creditVoucherCode)
                    .voucherName("Voucher bảo lưu cọc đơn " + booking.getBookingCode())
                    .description("Bảo lưu 100% cọc (" + depositPaid + "đ) từ đơn hủy " + booking.getBookingCode() + ". Có giá trị trong 6 tháng.")
                    .discountType("FIXED_AMOUNT")
                    .discountValue(depositPaid)
                    .minOrderAmount(BigDecimal.ZERO)
                    .maxDiscountAmount(depositPaid)
                    .validFrom(LocalDateTime.now())
                    .validTo(LocalDateTime.now().plusMonths(6))
                    .usageLimit(1)
                    .usageLimitPerCustomer(1)
                    .isActive(true)
                    .createdBy(userAccount)
                    .build();
            voucherRepository.save(creditVoucher);

            messageDetail = String.format("Đã bảo lưu 100%% tiền cọc (%sđ) thành Voucher ưu đãi mã [%s] có thời hạn sử dụng 6 tháng.",
                    depositPaid, creditVoucherCode);

        } else if ("LOYALTY_POINTS".equalsIgnoreCase(option)) {
            // Tùy chọn 2: Quy đổi 100% cọc sang Điểm thưởng Coastal Bay Club (Tỷ lệ: 100.000đ = 1.0 điểm)
            refundPercentage = 100;
            refundAmount = depositPaid;
            penaltyFee = BigDecimal.ZERO;

            Customer customer = booking.getCustomer();
            if (customer == null) {
                throw new IllegalArgumentException("Đơn đặt phòng này không liên kết với hồ sơ hội viên để quy đổi điểm thưởng");
            }

            // Quy đổi: 100.000 VNĐ cọc = 1.00 điểm Loyalty
            loyaltyPointsCredited = depositPaid.divide(BigDecimal.valueOf(100_000), 2, RoundingMode.HALF_UP);

            CustomerLoyalty loyalty = customerLoyaltyRepository.findByCustomer_CustomerId(customer.getCustomerId())
                    .orElseGet(() -> {
                        LoyaltyTier defaultTier = loyaltyTierRepository.findByTierCode("SEASHELL")
                                .orElseGet(() -> loyaltyTierRepository.findAll().get(0));
                        return customerLoyaltyRepository.save(CustomerLoyalty.builder()
                                .customer(customer)
                                .tier(defaultTier)
                                .totalStayDays(0)
                                .totalSpent(BigDecimal.ZERO)
                                .totalScore(BigDecimal.ZERO)
                                .build());
                    });

            LoyaltyTransaction txn = LoyaltyTransaction.builder()
                    .customer(customer)
                    .createdBy(userAccount)
                    .txnType("ADJUST")
                    .amountSpent(depositPaid)
                    .scoreEarned(loyaltyPointsCredited)
                    .note("Bảo lưu 100% cọc đơn " + booking.getBookingCode() + " quy đổi thành điểm thưởng hội viên Coastal Bay Club")
                    .build();
            loyaltyTransactionRepository.save(txn);

            loyalty.setTotalScore(loyalty.getTotalScore().add(loyaltyPointsCredited));

            // Tự động thăng hạng nếu đủ điểm
            List<LoyaltyTier> tiers = loyaltyTierRepository.findAll();
            tiers.sort((a, b) -> b.getTierLevel().compareTo(a.getTierLevel()));
            for (LoyaltyTier tier : tiers) {
                if (loyalty.getTotalScore().compareTo(tier.getMinScore()) >= 0) {
                    if (!tier.getTierId().equals(loyalty.getTier().getTierId()) && tier.getTierLevel() > loyalty.getTier().getTierLevel()) {
                        loyalty.setTier(tier);
                        loyalty.setTierUpdatedAt(LocalDateTime.now());
                        log.info("Khách hàng {} được nâng hạng lên {} khi quy đổi cọc hủy phòng", customer.getCustomerId(), tier.getTierName());
                    }
                    break;
                }
            }
            customerLoyaltyRepository.save(loyalty);

            messageDetail = String.format("Đã quy đổi 100%% tiền cọc (%sđ) thành %s điểm thưởng Coastal Bay Club cộng trực tiếp vào tài khoản hội viên.",
                    depositPaid, loyaltyPointsCredited);

        } else {
            // Tùy chọn 3: Hoàn tiền mặt/chuyển khoản theo chính sách thời gian (>=3 ngày: 100%, 1-2 ngày: 50%, 0 ngày: 0%)
            option = "CASH_REFUND";
            refundPercentage = financialCalculator.calculateRefundPercentage(booking.getCheckInDate(), LocalDate.now());
            refundAmount = depositPaid.multiply(BigDecimal.valueOf(refundPercentage))
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            penaltyFee = depositPaid.subtract(refundAmount);

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

            messageDetail = String.format("Tỷ lệ hoàn tiền: %d%% (Hoàn lại: %sđ, Phí phạt hủy muộn: %sđ).",
                    refundPercentage, refundAmount, penaltyFee);
        }

        // Cập nhật trạng thái Booking sang CANCELED
        booking.setStatus(BookingStatus.CANCELED.name());
        booking.setCancelReason(reason + " [Chính sách: " + option + "]");
        booking.setCanceledBy(userAccount);
        booking.setCanceledAt(LocalDateTime.now());
        bookingRepository.save(booking);

        // Cập nhật trạng thái BookingRoom sang CANCELED và giải phóng phòng thành AVAILABLE
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

        // Hủy các hóa đơn liên quan nếu có
        List<Invoice> invoices = invoiceRepository.findByBooking_BookingId(booking.getBookingId());
        for (Invoice inv : invoices) {
            inv.setStatus(InvoiceStatus.CANCELED.name());
            inv.setCancelReason(reason);
            inv.setCanceledBy(userAccount);
            inv.setCanceledAt(LocalDateTime.now());
            invoiceRepository.save(inv);
        }

        String finalMessage = "Hủy đơn đặt phòng thành công. " + messageDetail;
        log.info("Đơn {}: {}", bookingCode, finalMessage);

        return CancellationRefundResponse.builder()
                .bookingCode(bookingCode)
                .depositPaid(depositPaid)
                .refundPercentage(refundPercentage)
                .refundAmount(refundAmount)
                .penaltyFee(penaltyFee)
                .refundOption(option)
                .creditVoucherCode(creditVoucherCode)
                .loyaltyPointsCredited(loyaltyPointsCredited)
                .status("CANCELED")
                .message(finalMessage)
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
