package com.example.pbl6.service;

import com.example.pbl6.common.enums.BookingStatus;
import com.example.pbl6.common.enums.InvoiceStatus;
import com.example.pbl6.common.enums.PaymentMethod;
import com.example.pbl6.common.enums.PaymentType;
import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.booking.*;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;
import com.example.pbl6.entity.*;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.*;
import com.example.pbl6.service.financial.FinancialCalculator;
import com.example.pbl6.service.financial.VietQrService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerBookingServiceImpl implements CustomerBookingService {

    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final RoomRepository roomRepository;
    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final ServiceUsageRepository serviceUsageRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final CashierShiftService cashierShiftService;

    private final FinancialCalculator financialCalculator;
    private final VietQrService vietQrService;
    private final BankConfig bankConfig;
    @org.springframework.context.annotation.Lazy
    private final CustomerBillingService customerBillingService;
    @org.springframework.context.annotation.Lazy
    private final VoucherService voucherService;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public BookingDetailResponse createBooking(BookingCreateRequest request, String currentUsername) {
        LocalDate checkInDate = request.getCheckInDate();
        LocalDate checkOutDate = request.getCheckOutDate();

        if (checkInDate == null || checkOutDate == null) {
            throw new IllegalArgumentException("Ngày nhận phòng và trả phòng không được để trống");
        }

        if (!checkOutDate.isAfter(checkInDate)) {
            throw new IllegalArgumentException("Ngày trả phòng phải sau ngày nhận phòng");
        }

        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng với ID: " + request.getRoomId()));

        if (!"AVAILABLE".equalsIgnoreCase(room.getStatus())) {
            throw new IllegalArgumentException("Phòng " + room.getRoomNumber() + " hiện đang không khả dụng để đặt");
        }

        // Kiểm tra chống trùng lịch đặt phòng (Double booking check)
        boolean isRoomBusy = bookingRoomRepository.findByRoom_RoomId(room.getRoomId()).stream()
                .anyMatch(br -> {
                    Booking b = br.getBooking();
                    boolean isActive = b != null && (b.getStatus() == null ||
                            (!b.getStatus().equalsIgnoreCase(BookingStatus.CANCELED.name()) &&
                             !b.getStatus().equalsIgnoreCase(BookingStatus.EXPIRED.name())));
                    return isActive && br.getPlannedCheckin().isBefore(checkOutDate) && br.getPlannedCheckout().isAfter(checkInDate);
                });

        if (isRoomBusy) {
            throw new IllegalArgumentException("Phòng " + room.getRoomNumber() + " đã có người đặt trong khoảng thời gian này. Vui lòng chọn phòng khác!");
        }

        // Tìm hoặc khởi tạo hồ sơ Khách hàng
        Customer customer = findOrCreateCustomer(request);

        // Tính toán số đêm và tiền cọc
        long nights = financialCalculator.calculateNights(checkInDate, checkOutDate);
        BigDecimal basePrice = room.getRoomType() != null && room.getRoomType().getBasePrice() != null
                ? room.getRoomType().getBasePrice()
                : BigDecimal.ZERO;

        BigDecimal totalRoomCharge = financialCalculator.calculateTotalRoomCharge(basePrice, nights);

        BigDecimal discountAmount = BigDecimal.ZERO;
        String appliedNote = request.getNote();
        if (StringUtils.hasText(request.getVoucherCode())) {
            Voucher voucher = voucherService.validateAndUseVoucher(request.getVoucherCode(), totalRoomCharge);
            if (voucher != null) {
                discountAmount = financialCalculator.calculateVoucherDiscount(voucher, totalRoomCharge);
                appliedNote = (StringUtils.hasText(appliedNote) ? appliedNote + " | " : "") +
                        "Áp dụng voucher " + voucher.getCode() + " (Giảm " + discountAmount.longValue() + "đ)";
            }
        }

        BigDecimal discountedCharge = totalRoomCharge.subtract(discountAmount);
        if (discountedCharge.compareTo(BigDecimal.ZERO) < 0) {
            discountedCharge = BigDecimal.ZERO;
        }

        BigDecimal depositRequired = financialCalculator.calculateDeposit(discountedCharge, bankConfig.getDepositPercentage());

        // Sinh mã booking duy nhất
        String bookingCode = generateUniqueBookingCode();

        Account createdByAccount = null;
        if (StringUtils.hasText(currentUsername)) {
            createdByAccount = accountRepository.findByUsername(currentUsername).orElse(null);
        }

        Booking booking = Booking.builder()
                .bookingCode(bookingCode)
                .customer(customer)
                .createdBy(createdByAccount)
                .checkInDate(checkInDate)
                .checkOutDate(checkOutDate)
                .guestCount(request.getGuestCount())
                .status(BookingStatus.PENDING_DEPOSIT.name())
                .depositRequired(depositRequired)
                .source("ONLINE_WEBSITE")
                .note(appliedNote)
                .build();

        Booking savedBooking = bookingRepository.save(booking);

        BookingRoom bookingRoom = BookingRoom.builder()
                .booking(savedBooking)
                .room(room)
                .plannedCheckin(checkInDate)
                .plannedCheckout(checkOutDate)
                .status("RESERVED")
                .priceApplied(basePrice)
                .build();

        bookingRoomRepository.save(bookingRoom);

        // Sinh mã VietQR cho khoản tiền cọc
        BankTransferQrResponse qrInfo = vietQrService.generateDepositQr(bookingCode, depositRequired);

        log.info("Khởi tạo đơn đặt phòng thành công: Mã đơn: {}, Phòng: {}, Tiền cọc: {}", bookingCode, room.getRoomNumber(), depositRequired);
        auditLogService.log("ĐẶT PHÒNG", "CREATE", "booking", Long.valueOf(savedBooking.getBookingId()),
                "Đặt phòng trực tuyến: " + bookingCode + " (Phòng " + room.getRoomNumber() + ", " + checkInDate + " ➔ " + checkOutDate +
                        ", Cọc: " + depositRequired + " VNĐ, Tiền phòng: " + discountedCharge + " VNĐ)");

        return mapToDetailResponse(savedBooking, bookingRoom, qrInfo);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingDetailResponse getBookingByCode(String bookingCode) {
        Booking booking = findBookingFlexible(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng với mã: " + bookingCode));

        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        BookingRoom bookingRoom = bookingRooms.isEmpty() ? null : bookingRooms.get(0);

        BankTransferQrResponse qrInfo = null;
        if (BookingStatus.PENDING_DEPOSIT.name().equalsIgnoreCase(booking.getStatus())) {
            qrInfo = vietQrService.generateDepositQr(booking.getBookingCode(), booking.getDepositRequired());
        }

        return mapToDetailResponse(booking, bookingRoom, qrInfo);
    }

    @Override
    @Transactional
    public PaymentStatusResponse getPaymentStatus(String bookingCode) {
        Booking booking = findBookingFlexible(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng với mã: " + bookingCode));

        // Kiểm tra nếu đơn PENDING_DEPOSIT đã quá 15 phút thì tự động chuyển EXPIRED
        if (BookingStatus.PENDING_DEPOSIT.name().equalsIgnoreCase(booking.getStatus())) {
            LocalDateTime timeoutThreshold = booking.getCreatedAt().plusMinutes(bankConfig.getPaymentTimeoutMinutes());
            if (LocalDateTime.now().isAfter(timeoutThreshold)) {
                booking.setStatus(BookingStatus.EXPIRED.name());
                booking.setCancelReason("Quá thời hạn " + bankConfig.getPaymentTimeoutMinutes() + " phút không thanh toán tiền cọc");
                bookingRepository.save(booking);

                List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
                for (BookingRoom br : bookingRooms) {
                    br.setStatus(BookingStatus.EXPIRED.name());
                    bookingRoomRepository.save(br);
                }

                return PaymentStatusResponse.builder()
                        .bookingCode(booking.getBookingCode())
                        .bookingStatus(BookingStatus.EXPIRED.name())
                        .isPaid(false)
                        .depositAmount(booking.getDepositRequired())
                        .message("Đơn đặt phòng đã hết hạn thanh toán cọc và phòng đã được mở lại cho khách khác.")
                        .build();
            }
        }

        boolean isConfirmed = BookingStatus.CONFIRMED.name().equalsIgnoreCase(booking.getStatus())
                || BookingStatus.CHECKED_IN.name().equalsIgnoreCase(booking.getStatus())
                || BookingStatus.CHECKED_OUT.name().equalsIgnoreCase(booking.getStatus());

        List<Payment> payments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
        Payment depositPayment = payments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .findFirst()
                .orElse(null);

        BigDecimal totalDepositPaid = payments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return PaymentStatusResponse.builder()
                .bookingCode(booking.getBookingCode())
                .bookingStatus(booking.getStatus())
                .isPaid(isConfirmed)
                .depositAmount(totalDepositPaid.compareTo(BigDecimal.ZERO) > 0 ? totalDepositPaid : booking.getDepositRequired())
                .paidAt(depositPayment != null ? depositPayment.getPaidAt() : null)
                .message(isConfirmed ? "Đã thanh toán tiền cọc thành công!" : "Đang chờ thanh toán tiền cọc qua ngân hàng.")
                .build();
    }

    @Override
    @Transactional
    public BookingDetailResponse confirmDepositManual(String bookingCode, String staffUsername) {
        Booking booking = findBookingFlexible(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        Account staffAccount = null;
        if (StringUtils.hasText(staffUsername)) {
            staffAccount = accountRepository.findByUsername(staffUsername).orElse(null);
        }

        confirmDepositInternal(
                booking,
                booking.getDepositRequired(),
                PaymentMethod.BANK_TRANSFER.name(),
                "Duyệt cọc thủ công bởi: " + (staffAccount != null ? staffAccount.getFullName() : "Nhân viên"),
                staffAccount
        );

        auditLogService.log(staffAccount, "ĐẶT PHÒNG", "CONFIRM_DEPOSIT", "booking", Long.valueOf(booking.getBookingId()),
                "Xác nhận cọc cho đơn đặt phòng " + booking.getBookingCode() + " bởi " + (staffAccount != null ? staffAccount.getFullName() : staffUsername));

        return getBookingByCode(booking.getBookingCode());
    }

    @Override
    @Transactional
    public boolean processSePayWebhook(SePayWebhookPayload payload, String apiKeyHeader) {
        if (payload == null) {
            return false;
        }
        log.info("Nhận Webhook từ SePay: id={}, content={}, amount={}, transferType={}, ref={}",
                payload.getId(), payload.getContent(), payload.getTransferAmount(), payload.getTransferType(), payload.getReferenceCode());

        // 1. Xác thực API Key nếu có cấu hình bảo mật
        if (StringUtils.hasText(bankConfig.getSepayApiKey())) {
            String expected = "Apikey " + bankConfig.getSepayApiKey().trim();
            String altExpected = "Bearer " + bankConfig.getSepayApiKey().trim();
            if (apiKeyHeader == null || (!expected.equalsIgnoreCase(apiKeyHeader.trim())
                    && !altExpected.equalsIgnoreCase(apiKeyHeader.trim())
                    && !bankConfig.getSepayApiKey().trim().equals(apiKeyHeader.trim()))) {
                log.warn("SePay webhook API Key không khớp! Nhận: {}", apiKeyHeader);
                return false;
            }
        }

        // 2. Chỉ xử lý giao dịch tiền vào ('in')
        if (payload.getTransferType() != null && !"in".equalsIgnoreCase(payload.getTransferType().trim())) {
            log.info("Bỏ qua giao dịch không phải tiền vào (transferType != 'in')");
            return true;
        }

        // 3. Gộp nội dung từ content, code và description để không bỏ sót mã đơn
        String combinedContent = ((payload.getContent() != null ? payload.getContent() : "") + " "
                + (payload.getCode() != null ? payload.getCode() : "") + " "
                + (payload.getDescription() != null ? payload.getDescription() : "")).trim();

        if (!StringUtils.hasText(combinedContent)) {
            log.warn("Nội dung chuyển khoản rỗng trong webhook SePay!");
            return false;
        }

        // 4. Bóc tách và tìm đơn đặt phòng (hỗ trợ cả khi ngân hàng tự xóa dấu gạch ngang '-')
        Optional<Booking> optBooking = extractAndFindBooking(combinedContent);
        if (optBooking.isEmpty()) {
            log.warn("Không tìm thấy đơn đặt phòng khớp với nội dung chuyển khoản: {}", combinedContent);
            return false;
        }

        Booking booking = optBooking.get();
        String bookingCode = booking.getBookingCode();
        BigDecimal transferAmount = payload.getTransferAmount() != null ? payload.getTransferAmount() : BigDecimal.ZERO;

        if (transferAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Số tiền chuyển khoản trong webhook SePay không hợp lệ ({}) cho đơn {}", transferAmount, bookingCode);
            return false;
        }

        // 5. Chống trùng lặp giao dịch (Idempotency check theo referenceCode hoặc SePay id)
        String txRef = StringUtils.hasText(payload.getReferenceCode())
                ? payload.getReferenceCode().trim()
                : (payload.getId() != null ? "SEPAY-" + payload.getId() : null);

        if (txRef != null) {
            List<Payment> existingPayments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
            boolean alreadyProcessed = existingPayments.stream()
                    .anyMatch(p -> p.getNote() != null && p.getNote().contains(txRef));
            if (alreadyProcessed) {
                log.info("Giao dịch SePay [{}] của đơn {} đã được xử lý trước đó, bỏ qua chống trùng.", txRef, bookingCode);
                return true;
            }
        }

        // 6. Phân nhánh nếu là giao dịch tất toán hóa đơn (SETTLE)
        if (combinedContent.toUpperCase().contains("SETTLE")) {
            log.info("Phát hiện từ khóa SETTLE trong nội dung chuyển khoản: {}. Thực hiện đối chiếu tất toán check-out...", combinedContent);
            return customerBillingService.processSettlementWebhook(bookingCode, transferAmount, txRef != null ? txRef : "SEPAY");
        }

        // 7. Xử lý thanh toán tiền cọc (DEPOSIT): Kiểm tra khớp nội dung VÀ số tiền
        confirmDepositInternal(
                booking,
                transferAmount,
                PaymentMethod.BANK_TRANSFER.name(),
                "Mã GD SePay: " + (txRef != null ? txRef : "AUTO"),
                null
        );

        auditLogService.log("THANH TOÁN", "SEPAY_WEBHOOK", "booking", Long.valueOf(booking.getBookingId()),
                "Nhận chuyển khoản tự động qua SePay cho đơn " + bookingCode + ": " + transferAmount + " VNĐ (Mã GD: " + txRef + ")");

        log.info("Đã xử lý Webhook SePay thành công cho đơn: {}, số tiền: {}, trạng thái hiện tại: {}",
                bookingCode, transferAmount, booking.getStatus());
        return true;
    }

    @Override
    @Transactional
    public PaymentStatusResponse simulateDeposit(String bookingCode) {
        Booking booking = findBookingFlexible(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        confirmDepositInternal(
                booking,
                booking.getDepositRequired(),
                PaymentMethod.BANK_TRANSFER.name(),
                "GIẢ LẬP TEST THÀNH CÔNG (SIMULATED)",
                null
        );

        return getPaymentStatus(booking.getBookingCode());
    }

    @Override
    @Transactional
    public void cancelBooking(String bookingCode, String cancelReason, String canceledByUsername) {
        Booking booking = findBookingFlexible(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        Account canceledByAccount = null;
        if (StringUtils.hasText(canceledByUsername)) {
            canceledByAccount = accountRepository.findByUsername(canceledByUsername).orElse(null);
        }

        booking.setStatus(BookingStatus.CANCELED.name());
        booking.setCancelReason(cancelReason);
        booking.setCanceledBy(canceledByAccount);
        booking.setCanceledAt(LocalDateTime.now());
        auditLogService.log(canceledByAccount, "ĐẶT PHÒNG", "CANCEL", "booking", Long.valueOf(booking.getBookingId()),
                "Hủy đơn đặt phòng " + booking.getBookingCode() + " (Lý do: " + cancelReason + ", Người hủy: " + (canceledByAccount != null ? canceledByAccount.getFullName() : canceledByUsername) + ")");
        bookingRepository.save(booking);

        List<BookingRoom> rooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        for (BookingRoom br : rooms) {
            br.setStatus(BookingStatus.CANCELED.name());
            bookingRoomRepository.save(br);
        }

        // Nếu đã có hóa đơn DRAFT, chuyển sang CANCELED
        List<Invoice> invoices = invoiceRepository.findByBooking_BookingId(booking.getBookingId());
        for (Invoice inv : invoices) {
            inv.setStatus(InvoiceStatus.CANCELED.name());
            inv.setCancelReason(cancelReason);
            inv.setCanceledBy(canceledByAccount);
            inv.setCanceledAt(LocalDateTime.now());
            invoiceRepository.save(inv);
        }
    }

    @Override
    @Transactional
    @Scheduled(fixedRate = 60000) // Chạy ngầm định kỳ mỗi 1 phút
    public int expireOverdueBookings() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(bankConfig.getPaymentTimeoutMinutes());
        List<Booking> overdueBookings = bookingRepository.findByStatusAndCreatedAtBefore(BookingStatus.PENDING_DEPOSIT.name(), threshold);

        if (overdueBookings.isEmpty()) {
            return 0;
        }

        log.info("Phát hiện {} đơn đặt phòng quá hạn thanh toán cọc ({} phút). Bắt đầu giải phóng phòng...",
                overdueBookings.size(), bankConfig.getPaymentTimeoutMinutes());

        for (Booking booking : overdueBookings) {
            booking.setStatus(BookingStatus.EXPIRED.name());
            booking.setCancelReason("Tự động hủy do quá thời hạn nộp cọc " + bankConfig.getPaymentTimeoutMinutes() + " phút");
            bookingRepository.save(booking);

            List<BookingRoom> rooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
            for (BookingRoom br : rooms) {
                br.setStatus(BookingStatus.EXPIRED.name());
                bookingRoomRepository.save(br);
            }
        }

        return overdueBookings.size();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingDetailResponse> getMyBookings(String currentUsername) {
        Account account = accountRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản: " + currentUsername));

        List<Booking> bookings;
        if (StringUtils.hasText(account.getEmail())) {
            Optional<Customer> custOpt = customerRepository.findByEmail(account.getEmail());
            if (custOpt.isPresent()) {
                bookings = bookingRepository.findByCustomer_CustomerId(custOpt.get().getCustomerId());
            } else {
                bookings = bookingRepository.findByCustomer_CustomerId(account.getAccountId());
            }
        } else {
            bookings = bookingRepository.findByCustomer_CustomerId(account.getAccountId());
        }

        return bookings.stream().map(b -> {
            List<BookingRoom> brs = bookingRoomRepository.findByBooking_BookingId(b.getBookingId());
            BookingRoom br = brs.isEmpty() ? null : brs.get(0);
            return mapToDetailResponse(b, br, null);
        }).toList();
    }

    // ==========================================
    // LOGIC DÙNG CHUNG KHI TIỀN VỀ (WEBHOOK HOẶC DUYỆT TAY)
    // ==========================================

    private void confirmDepositInternal(Booking booking, BigDecimal incomingAmount, String method, String note, Account staffAccount) {
        if (BookingStatus.CHECKED_IN.name().equalsIgnoreCase(booking.getStatus())
                || BookingStatus.CHECKED_OUT.name().equalsIgnoreCase(booking.getStatus())) {
            log.info("Đơn đặt phòng {} đang ở trạng thái {}, bỏ qua xác nhận cọc", booking.getBookingCode(), booking.getStatus());
            return;
        }

        BigDecimal depositRequired = booking.getDepositRequired() != null ? booking.getDepositRequired() : BigDecimal.ZERO;
        BigDecimal paidNow = incomingAmount != null ? incomingAmount : depositRequired;

        // Tính tổng tiền cọc đã nộp trước đó (nếu khách chuyển khoản nhiều lần)
        List<Payment> existingPayments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
        BigDecimal previousDepositPaid = existingPayments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal cumulativeDepositPaid = previousDepositPaid.add(paidNow);

        // Tìm hoặc khởi tạo Hóa đơn dự thảo (Invoice - DRAFT)
        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        BookingRoom bookingRoom = bookingRooms.isEmpty() ? null : bookingRooms.get(0);

        long nights = financialCalculator.calculateNights(booking.getCheckInDate(), booking.getCheckOutDate());
        BigDecimal priceApplied = bookingRoom != null && bookingRoom.getPriceApplied() != null
                ? bookingRoom.getPriceApplied()
                : BigDecimal.ZERO;

        BigDecimal totalRoomCharge = financialCalculator.calculateTotalRoomCharge(priceApplied, nights);
        BigDecimal taxAmount = financialCalculator.calculateTax(totalRoomCharge);

        List<Invoice> existingInvoices = invoiceRepository.findByBooking_BookingId(booking.getBookingId());
        Invoice activeInvoice = existingInvoices.stream()
                .filter(inv -> !InvoiceStatus.CANCELED.name().equalsIgnoreCase(inv.getStatus()))
                .findFirst()
                .orElse(null);

        if (activeInvoice == null) {
            String invoiceNumber = "INV-" + booking.getBookingCode().replace("BK-", "");
            BigDecimal finalBalance = financialCalculator.calculateFinalTotal(totalRoomCharge, taxAmount, BigDecimal.ZERO, cumulativeDepositPaid);
            activeInvoice = Invoice.builder()
                    .invoiceNumber(invoiceNumber)
                    .booking(booking)
                    .roomCharge(totalRoomCharge)
                    .serviceCharge(BigDecimal.ZERO)
                    .taxAmount(taxAmount)
                    .discountAmount(BigDecimal.ZERO)
                    .depositApplied(cumulativeDepositPaid)
                    .totalAmount(finalBalance)
                    .status(InvoiceStatus.DRAFT.name())
                    .build();
        } else {
            activeInvoice.setDepositApplied(cumulativeDepositPaid);
            BigDecimal discount = activeInvoice.getDiscountAmount() != null ? activeInvoice.getDiscountAmount() : BigDecimal.ZERO;
            BigDecimal srvCharge = activeInvoice.getServiceCharge() != null ? activeInvoice.getServiceCharge() : BigDecimal.ZERO;
            BigDecimal sub = totalRoomCharge.add(srvCharge);
            BigDecimal tax = financialCalculator.calculateTax(sub);
            activeInvoice.setTaxAmount(tax);
            BigDecimal finalBalance = sub.add(tax).subtract(discount).subtract(cumulativeDepositPaid);
            activeInvoice.setTotalAmount(finalBalance.compareTo(BigDecimal.ZERO) > 0 ? finalBalance : BigDecimal.ZERO);
        }
        Invoice savedInvoice = invoiceRepository.save(activeInvoice);

        // Chèn bản ghi lịch sử Payment (gắn với ca thu ngân đang mở nếu có)
        CashierShift openShift = cashierShiftService.findSharedOpenShiftEntity().orElse(null);
        Payment payment = Payment.builder()
                .booking(booking)
                .invoice(savedInvoice)
                .cashierShift(openShift)
                .type(PaymentType.DEPOSIT.name())
                .method(method)
                .amount(paidNow)
                .receivedBy(staffAccount)
                .approvedBy(staffAccount)
                .note(note)
                .paidAt(LocalDateTime.now())
                .build();
        paymentRepository.save(payment);

        // Chỉ cập nhật booking.status = 'CONFIRMED' khi tổng tiền đã chuyển >= tiền cọc yêu cầu (khớp số tiền)
        if (cumulativeDepositPaid.compareTo(depositRequired) >= 0) {
            booking.setStatus(BookingStatus.CONFIRMED.name());
            booking.setCancelReason(null);
            bookingRepository.save(booking);

            for (BookingRoom br : bookingRooms) {
                br.setStatus(BookingStatus.CONFIRMED.name());
                bookingRoomRepository.save(br);
            }
            log.info("Xác nhận tiền cọc thành công cho đơn {}: Tổng cọc đã nhận {} >= Yêu cầu {}. Đã chuyển trạng thái CONFIRMED.",
                    booking.getBookingCode(), cumulativeDepositPaid, depositRequired);
        } else {
            log.warn("Đơn {} nhận được {}đ (tổng {}đ), chưa đủ mức cọc yêu cầu {}đ. Giữ trạng thái {}",
                    booking.getBookingCode(), paidNow, cumulativeDepositPaid, depositRequired, booking.getStatus());
        }
    }

    private Customer findOrCreateCustomer(BookingCreateRequest request) {
        Customer customer = null;

        if (StringUtils.hasText(request.getIdNumber())) {
            customer = customerRepository.findByIdNumber(request.getIdNumber().trim()).orElse(null);
        }

        if (customer == null && StringUtils.hasText(request.getPhone())) {
            customer = customerRepository.findByPhone(request.getPhone().trim()).orElse(null);
        }

        if (customer == null) {
            customer = Customer.builder()
                    .fullName(request.getFullName().trim())
                    .phone(request.getPhone().trim())
                    .email(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null)
                    .idType(StringUtils.hasText(request.getIdType()) ? request.getIdType().trim() : "CCCD")
                    .idNumber(StringUtils.hasText(request.getIdNumber()) ? request.getIdNumber().trim() : null)
                    .nationality(StringUtils.hasText(request.getNationality()) ? request.getNationality().trim() : "Việt Nam")
                    .build();
            customer = customerRepository.save(customer);
        } else {
            boolean changed = false;
            if (StringUtils.hasText(request.getFullName()) && !request.getFullName().equals(customer.getFullName())) {
                customer.setFullName(request.getFullName().trim());
                changed = true;
            }
            if (StringUtils.hasText(request.getEmail()) && customer.getEmail() == null) {
                customer.setEmail(request.getEmail().trim());
                changed = true;
            }
            if (changed) {
                customer = customerRepository.save(customer);
            }
        }

        return customer;
    }

    private String generateUniqueBookingCode() {
        String datePrefix = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomSuffix = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        String code = "BK-" + datePrefix + "-" + randomSuffix;

        while (bookingRepository.existsByBookingCode(code)) {
            randomSuffix = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
            code = "BK-" + datePrefix + "-" + randomSuffix;
        }
        return code;
    }

    /**
     * Tìm kiếm đơn đặt phòng linh hoạt: hỗ trợ cả mã chuẩn "BK-20261113-A1B2"
     * lẫn mã bị ngân hàng xóa dấu gạch ngang "BK20261113A1B2".
     */
    private Optional<Booking> findBookingFlexible(String rawCode) {
        if (!StringUtils.hasText(rawCode)) {
            return Optional.empty();
        }
        String clean = rawCode.trim().toUpperCase();
        Optional<Booking> direct = bookingRepository.findByBookingCode(clean);
        if (direct.isPresent()) {
            return direct;
        }
        // Nếu dạng BK20261113A1B2 -> chuyển thành BK-20261113-A1B2
        Pattern compactPattern = Pattern.compile("^BK[-\\s]*(\\d{8})[-\\s]*([A-Z0-9]{4})$", Pattern.CASE_INSENSITIVE);
        Matcher m = compactPattern.matcher(clean);
        if (m.find()) {
            String normalized = "BK-" + m.group(1) + "-" + m.group(2).toUpperCase();
            Optional<Booking> normOpt = bookingRepository.findByBookingCode(normalized);
            if (normOpt.isPresent()) {
                return normOpt;
            }
        }
        String strippedTarget = clean.replaceAll("[^A-Z0-9]", "");
        return bookingRepository.findAll().stream()
                .filter(b -> b.getBookingCode() != null && b.getBookingCode().replaceAll("[^A-Za-z0-9]", "").equalsIgnoreCase(strippedTarget))
                .findFirst();
    }

    /**
     * Bóc tách mã đơn đặt phòng từ nội dung chuyển khoản ngân hàng SePay (kể cả khi mất dấu '-' hoặc có khoảng trắng)
     */
    private Optional<Booking> extractAndFindBooking(String content) {
        if (!StringUtils.hasText(content)) {
            return Optional.empty();
        }
        String upper = content.toUpperCase();

        // 1. Khớp pattern chuẩn: BK-20261113-XXXX hoặc BK 20261113 XXXX hoặc BK20261113XXXX
        Pattern stdPattern = Pattern.compile("BK[-\\s]*(\\d{8})[-\\s]*([A-Z0-9]{4})");
        Matcher stdMatcher = stdPattern.matcher(upper);
        if (stdMatcher.find()) {
            String normalizedCode = "BK-" + stdMatcher.group(1) + "-" + stdMatcher.group(2);
            Optional<Booking> found = bookingRepository.findByBookingCode(normalizedCode);
            if (found.isPresent()) {
                return found;
            }
        }

        // 2. Khớp mọi chuỗi bắt đầu bằng BK...
        Pattern genericPattern = Pattern.compile("BK[-A-Z0-9]{4,}");
        Matcher genericMatcher = genericPattern.matcher(upper);
        while (genericMatcher.find()) {
            String candidate = genericMatcher.group();
            Optional<Booking> found = findBookingFlexible(candidate);
            if (found.isPresent()) {
                return found;
            }
        }

        // 3. Fallback đối chiếu chuỗi đã loại bỏ ký tự đặc biệt với các đơn đang hoạt động
        String compactContent = upper.replaceAll("[^A-Z0-9]", "");
        return bookingRepository.findAll().stream()
                .filter(b -> b.getBookingCode() != null)
                .filter(b -> {
                    String compactCode = b.getBookingCode().toUpperCase().replaceAll("[^A-Z0-9]", "");
                    return compactCode.length() >= 6 && compactContent.contains(compactCode);
                })
                .findFirst();
    }

    private BookingDetailResponse mapToDetailResponse(Booking booking, BookingRoom bookingRoom, BankTransferQrResponse qrInfo) {
        Room room = bookingRoom != null ? bookingRoom.getRoom() : null;
        Customer customer = booking.getCustomer();

        long nights = financialCalculator.calculateNights(booking.getCheckInDate(), booking.getCheckOutDate());
        BigDecimal pricePerNight = bookingRoom != null && bookingRoom.getPriceApplied() != null
                ? bookingRoom.getPriceApplied()
                : (room != null && room.getRoomType() != null ? room.getRoomType().getBasePrice() : BigDecimal.ZERO);

        BigDecimal totalRoomCharge = financialCalculator.calculateTotalRoomCharge(pricePerNight, nights);

        List<Payment> payments = paymentRepository.findByBooking_BookingId(booking.getBookingId());
        BigDecimal depositPaid = payments.stream()
                .filter(p -> PaymentType.DEPOSIT.name().equalsIgnoreCase(p.getType()))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        LocalDateTime expiredAt = booking.getCreatedAt() != null
                ? booking.getCreatedAt().plusMinutes(bankConfig.getPaymentTimeoutMinutes())
                : null;

        // Lấy danh sách dịch vụ gắn liền với lượt đặt phòng (Module 7)
        List<ServiceUsageResponse> servicesUsed = serviceUsageRepository.findByBooking_BookingId(booking.getBookingId())
                .stream()
                .map(u -> ServiceUsageResponse.builder()
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
                        .build())
                .collect(Collectors.toList());

        List<ServiceRequestResponse> serviceRequests = serviceRequestRepository.findByBooking_BookingId(booking.getBookingId())
                .stream()
                .map(ServiceRequestResponse::fromEntity)
                .collect(Collectors.toList());

        return BookingDetailResponse.builder()
                .bookingId(booking.getBookingId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus())
                .customerId(customer != null ? customer.getCustomerId() : null)
                .customerName(customer != null ? customer.getFullName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .customerEmail(customer != null ? customer.getEmail() : null)
                .idNumber(customer != null ? customer.getIdNumber() : null)
                .roomId(room != null ? room.getRoomId() : null)
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .floor(room != null ? room.getFloor() : null)
                .roomType(room != null ? RoomTypeResponse.fromEntity(room.getRoomType()) : null)
                .checkInDate(booking.getCheckInDate())
                .checkOutDate(booking.getCheckOutDate())
                .nights(nights)
                .guestCount(booking.getGuestCount())
                .note(booking.getNote())
                .priceAppliedPerNight(pricePerNight)
                .totalRoomCharge(totalRoomCharge)
                .depositRequired(booking.getDepositRequired())
                .depositPaid(depositPaid)
                .servicesUsed(servicesUsed)
                .serviceRequests(serviceRequests)
                .qrInfo(qrInfo)
                .createdAt(booking.getCreatedAt())
                .expiredAt(expiredAt)
                .build();
    }
}
