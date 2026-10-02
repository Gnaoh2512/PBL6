package com.example.pbl6.service;

import com.example.pbl6.common.enums.BookingStatus;
import com.example.pbl6.common.enums.InvoiceStatus;
import com.example.pbl6.common.enums.PaymentType;
import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.booking.BookingCreateRequest;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.booking.PaymentStatusResponse;
import com.example.pbl6.dto.booking.SePayWebhookPayload;
import com.example.pbl6.entity.*;
import com.example.pbl6.repository.*;
import com.example.pbl6.service.financial.FinancialCalculator;
import com.example.pbl6.service.financial.VietQrService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerBookingServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private BookingRoomRepository bookingRoomRepository;

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Spy
    private FinancialCalculator financialCalculator = new FinancialCalculator();

    @Spy
    private BankConfig bankConfig = new BankConfig();

    @Spy
    private VietQrService vietQrService = new VietQrService(bankConfig);

    @Mock
    private VoucherService voucherService;

    @InjectMocks
    private CustomerBookingServiceImpl bookingService;

    private Room mockRoom;
    private RoomType mockRoomType;
    private Customer mockCustomer;
    private Booking mockBooking;

    @BeforeEach
    void setUp() {
        mockRoomType = RoomType.builder()
                .roomTypeId(1)
                .typeName("Phòng Standard")
                .basePrice(BigDecimal.valueOf(500000))
                .capacity(2)
                .build();

        mockRoom = Room.builder()
                .roomId(101)
                .roomNumber("101")
                .roomType(mockRoomType)
                .status("AVAILABLE")
                .build();

        mockCustomer = Customer.builder()
                .customerId(1)
                .fullName("Nguyễn Văn An")
                .phone("0901234567")
                .idNumber("001201001234")
                .build();

        mockBooking = Booking.builder()
                .bookingId(1)
                .bookingCode("BK-20261001-A1B2")
                .customer(mockCustomer)
                .checkInDate(LocalDate.of(2026, 10, 1))
                .checkOutDate(LocalDate.of(2026, 10, 3))
                .guestCount(2)
                .status(BookingStatus.PENDING_DEPOSIT.name())
                .depositRequired(BigDecimal.valueOf(300000))
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void createBooking_Success_ReturnsPendingDepositAndVietQr() {
        BookingCreateRequest request = BookingCreateRequest.builder()
                .roomId(101)
                .checkInDate(LocalDate.of(2026, 10, 1))
                .checkOutDate(LocalDate.of(2026, 10, 3)) // 2 nights * 500k = 1,000,000 -> 30% deposit = 300,000
                .guestCount(2)
                .fullName("Nguyễn Văn An")
                .phone("0901234567")
                .idNumber("001201001234")
                .build();

        when(roomRepository.findById(101)).thenReturn(Optional.of(mockRoom));
        when(bookingRoomRepository.findByRoom_RoomId(101)).thenReturn(new ArrayList<>());
        when(customerRepository.findByIdNumber("001201001234")).thenReturn(Optional.of(mockCustomer));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            b.setBookingId(1);
            return b;
        });

        BookingDetailResponse response = bookingService.createBooking(request, null);

        assertNotNull(response);
        assertEquals(BookingStatus.PENDING_DEPOSIT.name(), response.getStatus());
        assertEquals("101", response.getRoomNumber());
        assertEquals(2, response.getNights());
        assertEquals(new BigDecimal("1000000.00"), response.getTotalRoomCharge());
        assertEquals(new BigDecimal("300000"), response.getDepositRequired());

        // Check VietQR payload
        assertNotNull(response.getQrInfo());
        assertTrue(response.getQrInfo().getTransferContent().contains("PBL6"));
        assertTrue(response.getQrInfo().getQrImageUrl().contains("amount=300000"));

        verify(bookingRepository, times(1)).save(any(Booking.class));
        verify(bookingRoomRepository, times(1)).save(any(BookingRoom.class));
        // Verify NO Invoice and NO Payment are created yet
        verify(invoiceRepository, never()).save(any(Invoice.class));
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    void confirmDepositManual_Success_CreatesInvoiceAndPayment() {
        BookingRoom mockBookingRoom = BookingRoom.builder()
                .bookingRoomId(1)
                .booking(mockBooking)
                .room(mockRoom)
                .priceApplied(BigDecimal.valueOf(500000))
                .build();

        Account mockStaff = Account.builder()
                .accountId(2)
                .username("receptionist")
                .fullName("Trần Thị Lễ Tân")
                .build();

        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(accountRepository.findByUsername("receptionist")).thenReturn(Optional.of(mockStaff));
        when(bookingRoomRepository.findByBooking_BookingId(1)).thenReturn(List.of(mockBookingRoom));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

        BookingDetailResponse response = bookingService.confirmDepositManual("BK-20261001-A1B2", "receptionist");

        assertEquals(BookingStatus.CONFIRMED.name(), mockBooking.getStatus());
        assertEquals(BookingStatus.CONFIRMED.name(), mockBookingRoom.getStatus());

        // Verify Invoice DRAFT created
        verify(invoiceRepository, times(1)).save(argThat(inv ->
                InvoiceStatus.DRAFT.name().equals(inv.getStatus()) &&
                new BigDecimal("300000").equals(inv.getDepositApplied())
        ));

        // Verify Payment DEPOSIT created
        verify(paymentRepository, times(1)).save(argThat(p ->
                PaymentType.DEPOSIT.name().equals(p.getType()) &&
                new BigDecimal("300000").equals(p.getAmount()) &&
                mockStaff.equals(p.getApprovedBy())
        ));
    }

    @Test
    void processSePayWebhook_ValidContent_AutoConfirmsBooking() {
        BookingRoom mockBookingRoom = BookingRoom.builder()
                .bookingRoomId(1)
                .booking(mockBooking)
                .room(mockRoom)
                .priceApplied(BigDecimal.valueOf(500000))
                .build();

        SePayWebhookPayload payload = SePayWebhookPayload.builder()
                .content("PBL6 BK-20261001-A1B2 tien coc phong")
                .transferAmount(BigDecimal.valueOf(300000))
                .transferType("in")
                .referenceCode("MB998877")
                .build();

        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(1)).thenReturn(List.of(mockBookingRoom));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

        boolean result = bookingService.processSePayWebhook(payload, null);

        assertTrue(result);
        assertEquals(BookingStatus.CONFIRMED.name(), mockBooking.getStatus());

        verify(paymentRepository, times(1)).save(argThat(p ->
                PaymentType.DEPOSIT.name().equals(p.getType()) &&
                p.getNote().contains("MB998877")
        ));
    }

    @Test
    void simulateDeposit_Success_ReturnsConfirmedStatus() {
        BookingRoom mockBookingRoom = BookingRoom.builder()
                .bookingRoomId(1)
                .booking(mockBooking)
                .room(mockRoom)
                .priceApplied(BigDecimal.valueOf(500000))
                .build();

        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(1)).thenReturn(List.of(mockBookingRoom));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentStatusResponse status = bookingService.simulateDeposit("BK-20261001-A1B2");

        assertNotNull(status);
        assertTrue(status.isPaid());
        assertEquals(BookingStatus.CONFIRMED.name(), status.getBookingStatus());
    }

    @Test
    void getPaymentStatus_OverdueBooking_AutoExpires() {
        // Đơn tạo từ 20 phút trước (quá 15 phút)
        mockBooking.setCreatedAt(LocalDateTime.now().minusMinutes(20));

        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(1)).thenReturn(new ArrayList<>());

        PaymentStatusResponse status = bookingService.getPaymentStatus("BK-20261001-A1B2");

        assertNotNull(status);
        assertFalse(status.isPaid());
        assertEquals(BookingStatus.EXPIRED.name(), status.getBookingStatus());
        assertEquals(BookingStatus.EXPIRED.name(), mockBooking.getStatus());
    }
}
