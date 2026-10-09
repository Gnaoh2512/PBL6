package com.example.pbl6.service;

import com.example.pbl6.common.enums.BookingStatus;
import com.example.pbl6.common.enums.PaymentType;
import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.booking.WalkInBookingRequest;
import com.example.pbl6.entity.*;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.*;
import com.example.pbl6.service.financial.FinancialCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StaffBookingServiceImpl implements StaffBookingService {

    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final RoomRepository roomRepository;
    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final CashierShiftRepository cashierShiftRepository;

    private final FinancialCalculator financialCalculator;
    private final BankConfig bankConfig;
    private final CustomerBookingService customerBookingService;
    private final VoucherService voucherService;

    @Override
    @Transactional
    public BookingDetailResponse createWalkInBooking(WalkInBookingRequest request, String staffUsername) {
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

        boolean checkInImmediately = Boolean.TRUE.equals(request.getCheckInImmediately());

        if (checkInImmediately && !"AVAILABLE".equalsIgnoreCase(room.getStatus())) {
            throw new IllegalArgumentException("Phòng " + room.getRoomNumber() + " hiện đang có trạng thái [" 
                    + room.getStatus() + "], không thể nhận phòng ngay lúc này.");
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
            throw new IllegalArgumentException("Phòng " + room.getRoomNumber() + " đã có khách đặt trong khoảng thời gian này. Vui lòng chọn phòng khác!");
        }

        // Lấy thông tin tài khoản nhân viên lễ tân
        Account staffAccount = null;
        if (StringUtils.hasText(staffUsername)) {
            staffAccount = accountRepository.findByUsername(staffUsername).orElse(null);
        }

        BigDecimal amountPaid = request.getAmountPaid() != null ? request.getAmountPaid() : BigDecimal.ZERO;
        String paymentMethod = StringUtils.hasText(request.getPaymentMethod()) ? request.getPaymentMethod().toUpperCase() : "CASH";

        // Kiểm tra ca thu ngân nếu thu tiền mặt tại quầy
        CashierShift activeShift = null;
        if (staffAccount != null) {
            List<CashierShift> shifts = cashierShiftRepository.findByAccount_AccountId(staffAccount.getAccountId());
            activeShift = shifts.stream()
                    .filter(cs -> "OPEN".equalsIgnoreCase(cs.getStatus()))
                    .findFirst()
                    .orElse(null);

            if (amountPaid.compareTo(BigDecimal.ZERO) > 0 && "CASH".equalsIgnoreCase(paymentMethod) && activeShift == null) {
                throw new IllegalArgumentException("Nhân viên thu tiền mặt tại quầy nhưng chưa mở Ca thu ngân (Cashier Shift). Vui lòng mở ca trước khi nhận tiền mặt!");
            }
        }

        // Tìm hoặc tạo hồ sơ khách hàng vãng lai
        Customer customer = findOrCreateCustomer(request);

        // Tính toán tài chính
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

        // Xác định trạng thái ban đầu của đơn
        String bookingStatus;
        if (checkInImmediately) {
            bookingStatus = BookingStatus.CHECKED_IN.name();
        } else if (amountPaid.compareTo(depositRequired) >= 0) {
            bookingStatus = BookingStatus.CONFIRMED.name();
        } else {
            bookingStatus = BookingStatus.PENDING_DEPOSIT.name();
        }

        Booking booking = Booking.builder()
                .bookingCode(bookingCode)
                .customer(customer)
                .createdBy(staffAccount)
                .checkInDate(checkInDate)
                .checkOutDate(checkOutDate)
                .guestCount(request.getGuestCount())
                .status(bookingStatus)
                .depositRequired(depositRequired)
                .source("WALK_IN")
                .note(appliedNote)
                .build();

        Booking savedBooking = bookingRepository.save(booking);

        BookingRoom bookingRoom = BookingRoom.builder()
                .booking(savedBooking)
                .room(room)
                .plannedCheckin(checkInDate)
                .plannedCheckout(checkOutDate)
                .actualCheckin(checkInImmediately ? LocalDateTime.now() : null)
                .status(checkInImmediately ? "OCCUPIED" : "RESERVED")
                .priceApplied(basePrice)
                .build();

        bookingRoomRepository.save(bookingRoom);

        // Nếu nhận phòng ngay, đổi trạng thái phòng sang OCCUPIED
        if (checkInImmediately) {
            room.setStatus("OCCUPIED");
            roomRepository.save(room);
        }

        // Tạo hóa đơn lưu trú ban đầu (DRAFT)
        String invoiceNumber = "INV-" + bookingCode.replace("BK-", "");
        Invoice invoice = Invoice.builder()
                .invoiceNumber(invoiceNumber)
                .booking(savedBooking)
                .roomCharge(discountedCharge)
                .serviceCharge(BigDecimal.ZERO)
                .taxAmount(financialCalculator.calculateTax(discountedCharge))
                .discountAmount(discountAmount)
                .depositApplied(amountPaid)
                .totalAmount(discountedCharge.add(financialCalculator.calculateTax(discountedCharge)))
                .status("DRAFT")
                .issuedBy(staffAccount)
                .build();

        Invoice savedInvoice = invoiceRepository.save(invoice);

        // Ghi nhận phiếu thu tiền tại quầy nếu có thanh toán
        if (amountPaid.compareTo(BigDecimal.ZERO) > 0) {
            Payment payment = Payment.builder()
                    .booking(savedBooking)
                    .invoice(savedInvoice)
                    .cashierShift(activeShift)
                    .type(checkInImmediately ? PaymentType.DEPOSIT.name() : PaymentType.DEPOSIT.name())
                    .method(paymentMethod)
                    .amount(amountPaid)
                    .receivedBy(staffAccount)
                    .note("Thu tiền tại quầy Lễ tân (Đơn Walk-in)")
                    .paidAt(LocalDateTime.now())
                    .build();

            paymentRepository.save(payment);
            log.info("Đã tạo phiếu thu tiền tại quầy: {} đ, phương thức: {}, Ca trực: {}", 
                    amountPaid, paymentMethod, activeShift != null ? activeShift.getCashierShiftId() : "Không gắn ca");
        }

        log.info("Nhân viên {} đã tạo thành công đơn đặt phòng tại quầy (Walk-in): {}, Phòng: {}, Check-in ngay: {}", 
                staffUsername, bookingCode, room.getRoomNumber(), checkInImmediately);

        return customerBookingService.getBookingByCode(bookingCode);
    }

    @Override
    @Transactional
    public BookingDetailResponse confirmDepositManual(String bookingCode, String staffUsername) {
        return customerBookingService.confirmDepositManual(bookingCode, staffUsername);
    }

    @Override
    @Transactional
    public void cancelBooking(String bookingCode, String cancelReason, String staffUsername) {
        customerBookingService.cancelBooking(bookingCode, cancelReason, staffUsername);
    }

    private Customer findOrCreateCustomer(WalkInBookingRequest request) {
        Customer customer = null;
        if (StringUtils.hasText(request.getIdNumber())) {
            customer = customerRepository.findByIdNumber(request.getIdNumber().trim()).orElse(null);
        }
        if (customer == null && StringUtils.hasText(request.getPhone())) {
            customer = customerRepository.findByPhone(request.getPhone().trim()).orElse(null);
        }

        if (customer != null) {
            customer.setFullName(request.getFullName().trim());
            if (StringUtils.hasText(request.getEmail())) {
                customer.setEmail(request.getEmail().trim());
            }
            if (StringUtils.hasText(request.getNationality())) {
                customer.setNationality(request.getNationality().trim());
            }
            if (StringUtils.hasText(request.getIdType())) {
                customer.setIdType(request.getIdType().trim());
            }
            return customerRepository.save(customer);
        }

        Customer newCustomer = Customer.builder()
                .fullName(request.getFullName().trim())
                .phone(request.getPhone().trim())
                .email(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null)
                .idType(StringUtils.hasText(request.getIdType()) ? request.getIdType().trim() : "CCCD")
                .idNumber(StringUtils.hasText(request.getIdNumber()) ? request.getIdNumber().trim() : null)
                .nationality(StringUtils.hasText(request.getNationality()) ? request.getNationality().trim() : "Vietnam")
                .build();

        return customerRepository.save(newCustomer);
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
}
