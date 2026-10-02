package com.example.pbl6.service;

import com.example.pbl6.common.enums.BookingStatus;
import com.example.pbl6.common.enums.InvoiceStatus;
import com.example.pbl6.common.enums.PaymentMethod;
import com.example.pbl6.common.enums.PaymentType;
import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.booking.*;
import com.example.pbl6.dto.room.RoomTypeResponse;
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

    private final FinancialCalculator financialCalculator;
    private final VietQrService vietQrService;
    private final BankConfig bankConfig;
    @org.springframework.context.annotation.Lazy
    private final CustomerBillingService customerBillingService;
    @org.springframework.context.annotation.Lazy
    private final VoucherService voucherService;

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

        return mapToDetailResponse(savedBooking, bookingRoom, qrInfo);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingDetailResponse getBookingByCode(String bookingCode) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
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
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
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
                        .bookingCode(bookingCode)
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

        return PaymentStatusResponse.builder()
                .bookingCode(bookingCode)
                .bookingStatus(booking.getStatus())
                .isPaid(isConfirmed)
                .depositAmount(depositPayment != null ? depositPayment.getAmount() : booking.getDepositRequired())
                .paidAt(depositPayment != null ? depositPayment.getPaidAt() : null)
                .message(isConfirmed ? "Đã thanh toán tiền cọc thành công!" : "Đang chờ thanh toán tiền cọc qua ngân hàng.")
                .build();
    }

    @Override
    @Transactional
    public BookingDetailResponse confirmDepositManual(String bookingCode, String staffUsername) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
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

        return getBookingByCode(bookingCode);
    }

    @Override
    @Transactional
    public boolean processSePayWebhook(SePayWebhookPayload payload, String apiKeyHeader) {
        log.info("Nhận Webhook từ SePay: content={}, amount={}, transferType={}", payload.getContent(), payload.getTransferAmount(), payload.getTransferType());

        if (StringUtils.hasText(bankConfig.getSepayApiKey())) {
            String expected = "Apikey " + bankConfig.getSepayApiKey();
            if (!expected.equals(apiKeyHeader) && !bankConfig.getSepayApiKey().equals(apiKeyHeader)) {
                log.warn("SePay webhook API Key không khớp! Nhận: {}", apiKeyHeader);
                return false;
            }
        }

        if (payload.getTransferType() != null && !"in".equalsIgnoreCase(payload.getTransferType().trim())) {
            log.info("Bỏ qua giao dịch không phải tiền vào (transferType != 'in')");
            return true;
        }

        String content = payload.getContent();
        if (!StringUtils.hasText(content)) {
            content = payload.getDescription();
        }

        if (!StringUtils.hasText(content)) {
            log.warn("Nội dung chuyển khoản rỗng trong webhook SePay!");
            return false;
        }

        String bookingCode = extractBookingCode(content);
        if (bookingCode == null) {
            log.warn("Không tìm thấy mã đơn đặt phòng (BK...) trong nội dung chuyển khoản: {}", content);
            return false;
        }

        Optional<Booking> optBooking = bookingRepository.findByBookingCode(bookingCode);
        if (optBooking.isEmpty()) {
            log.warn("Không tìm thấy đơn đặt phòng có mã: {}", bookingCode);
            return false;
        }

        Booking booking = optBooking.get();
        BigDecimal transferAmount = payload.getTransferAmount() != null ? payload.getTransferAmount() : BigDecimal.ZERO;

        if (content.toUpperCase().contains("SETTLE")) {
            log.info("Phát hiện từ khóa SETTLE trong nội dung chuyển khoản: {}. Thực hiện tất toán check-out...", content);
            return customerBillingService.processSettlementWebhook(bookingCode, transferAmount, payload.getReferenceCode());
        }

        confirmDepositInternal(
                booking,
                transferAmount,
                PaymentMethod.BANK_TRANSFER.name(),
                "Mã GD SePay: " + payload.getReferenceCode(),
                null
        );

        log.info("Đã xử lý Webhook SePay thành công cho đơn: {}, số tiền: {}", bookingCode, transferAmount);
        return true;
    }

    @Override
    @Transactional
    public PaymentStatusResponse simulateDeposit(String bookingCode) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        confirmDepositInternal(
                booking,
                booking.getDepositRequired(),
                PaymentMethod.BANK_TRANSFER.name(),
                "GIẢ LẬP TEST THÀNH CÔNG (SIMULATED)",
                null
        );

        return getPaymentStatus(bookingCode);
    }

    @Override
    @Transactional
    public void cancelBooking(String bookingCode, String cancelReason, String canceledByUsername) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + bookingCode));

        Account canceledByAccount = null;
        if (StringUtils.hasText(canceledByUsername)) {
            canceledByAccount = accountRepository.findByUsername(canceledByUsername).orElse(null);
        }

        booking.setStatus(BookingStatus.CANCELED.name());
        booking.setCancelReason(cancelReason);
        booking.setCanceledBy(canceledByAccount);
        booking.setCanceledAt(LocalDateTime.now());
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

    private void confirmDepositInternal(Booking booking, BigDecimal depositAmount, String method, String note, Account staffAccount) {
        if (BookingStatus.CONFIRMED.name().equalsIgnoreCase(booking.getStatus())) {
            log.info("Đơn đặt phòng {} đã được xác nhận trước đó, bỏ qua", booking.getBookingCode());
            return;
        }

        // 1. Cập nhật Booking -> CONFIRMED
        booking.setStatus(BookingStatus.CONFIRMED.name());
        bookingRepository.save(booking);

        // 2. Cập nhật BookingRoom -> CONFIRMED
        List<BookingRoom> bookingRooms = bookingRoomRepository.findByBooking_BookingId(booking.getBookingId());
        BookingRoom bookingRoom = bookingRooms.isEmpty() ? null : bookingRooms.get(0);
        for (BookingRoom br : bookingRooms) {
            br.setStatus(BookingStatus.CONFIRMED.name());
            bookingRoomRepository.save(br);
        }

        // 3. LÚC NÀY MỚI KHỞI TẠO HÓA ĐƠN DỰ THẢO (Invoice - DRAFT)
        long nights = financialCalculator.calculateNights(booking.getCheckInDate(), booking.getCheckOutDate());
        BigDecimal priceApplied = bookingRoom != null && bookingRoom.getPriceApplied() != null
                ? bookingRoom.getPriceApplied()
                : BigDecimal.ZERO;

        BigDecimal totalRoomCharge = financialCalculator.calculateTotalRoomCharge(priceApplied, nights);
        BigDecimal taxAmount = financialCalculator.calculateTax(totalRoomCharge);
        BigDecimal subtotal = totalRoomCharge;
        BigDecimal finalBalance = financialCalculator.calculateFinalTotal(subtotal, taxAmount, BigDecimal.ZERO, depositAmount);

        String invoiceNumber = "INV-" + booking.getBookingCode().replace("BK-", "");

        Invoice invoice = Invoice.builder()
                .invoiceNumber(invoiceNumber)
                .booking(booking)
                .roomCharge(totalRoomCharge)
                .serviceCharge(BigDecimal.ZERO)
                .taxAmount(taxAmount)
                .discountAmount(BigDecimal.ZERO)
                .depositApplied(depositAmount)
                .totalAmount(finalBalance)
                .status(InvoiceStatus.DRAFT.name())
                .build();

        Invoice savedInvoice = invoiceRepository.save(invoice);

        // 4. KHỞI TẠO BẢN GHI THANH TOÁN (Payment - DEPOSIT)
        Payment payment = Payment.builder()
                .booking(booking)
                .invoice(savedInvoice)
                .type(PaymentType.DEPOSIT.name())
                .method(method)
                .amount(depositAmount)
                .approvedBy(staffAccount)
                .note(note)
                .build();

        paymentRepository.save(payment);

        log.info("Xác nhận tiền cọc thành công cho đơn {}: Đã tạo Invoice {} (DRAFT) và Payment {} (DEPOSIT)",
                booking.getBookingCode(), savedInvoice.getInvoiceNumber(), depositAmount);
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
            // Cập nhật tên hoặc email nếu chưa có
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

    private String extractBookingCode(String content) {
        if (!StringUtils.hasText(content)) return null;

        // Tìm pattern: BK-yyyyMMdd-XXXX hoặc BK2026...
        Pattern pattern = Pattern.compile("BK[-A-Za-z0-9]+", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(content);
        if (matcher.find()) {
            return matcher.group().toUpperCase();
        }
        return null;
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
                .qrInfo(qrInfo)
                .createdAt(booking.getCreatedAt())
                .expiredAt(expiredAt)
                .build();
    }
}
