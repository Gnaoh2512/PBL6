package com.example.pbl6.service;

import com.example.pbl6.common.enums.BookingStatus;
import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.booking.WalkInBookingRequest;
import com.example.pbl6.entity.*;
import com.example.pbl6.repository.*;
import com.example.pbl6.service.financial.FinancialCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaffBookingServiceTest {

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

    @Mock
    private CashierShiftRepository cashierShiftRepository;

    @Mock
    private BankConfig bankConfig;

    @Mock
    private CustomerBookingService customerBookingService;

    @Mock
    private VoucherService voucherService;

    @Spy
    private FinancialCalculator financialCalculator = new FinancialCalculator();

    @InjectMocks
    private StaffBookingServiceImpl staffBookingService;

    private Room mockRoom;
    private RoomType mockRoomType;
    private Account mockStaff;
    private CashierShift mockCashierShift;

    @BeforeEach
    void setUp() {
        mockRoomType = RoomType.builder()
                .roomTypeId(1)
                .typeName("Deluxe Double")
                .basePrice(BigDecimal.valueOf(1000000))
                .build();

        mockRoom = Room.builder()
                .roomId(101)
                .roomNumber("101")
                .status("AVAILABLE")
                .roomType(mockRoomType)
                .build();

        mockStaff = Account.builder()
                .accountId(2)
                .username("receptionist1")
                .fullName("Lễ tân A")
                .build();

        mockCashierShift = CashierShift.builder()
                .cashierShiftId(10)
                .account(mockStaff)
                .status("OPEN")
                .openingCash(BigDecimal.valueOf(500000))
                .build();
    }

    @Test
    void createWalkInBooking_Success_CheckInImmediately() {
        WalkInBookingRequest request = WalkInBookingRequest.builder()
                .roomId(101)
                .checkInDate(LocalDate.now())
                .checkOutDate(LocalDate.now().plusDays(2))
                .guestCount(2)
                .fullName("Trần Khách Vãng Lai")
                .phone("0988777666")
                .idNumber("048202001122")
                .amountPaid(BigDecimal.valueOf(500000))
                .paymentMethod("CASH")
                .checkInImmediately(true)
                .build();

        when(roomRepository.findById(101)).thenReturn(Optional.of(mockRoom));
        when(bookingRoomRepository.findByRoom_RoomId(101)).thenReturn(new ArrayList<>());
        when(accountRepository.findByUsername("receptionist1")).thenReturn(Optional.of(mockStaff));
        when(cashierShiftRepository.findByAccount_AccountId(2)).thenReturn(List.of(mockCashierShift));
        when(customerRepository.findByIdNumber("048202001122")).thenReturn(Optional.empty());
        when(customerRepository.save(any(Customer.class))).thenAnswer(i -> {
            Customer c = i.getArgument(0);
            c.setCustomerId(99);
            return c;
        });
        when(bankConfig.getDepositPercentage()).thenReturn(30);

        when(bookingRepository.existsByBookingCode(anyString())).thenReturn(false);
        when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> {
            Booking b = i.getArgument(0);
            b.setBookingId(1);
            return b;
        });
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(i -> i.getArgument(0));

        BookingDetailResponse mockResponse = BookingDetailResponse.builder()
                .bookingCode("BK-20261002-TEST")
                .status(BookingStatus.CHECKED_IN.name())
                .customerName("Trần Khách Vãng Lai")
                .roomNumber("101")
                .build();
        when(customerBookingService.getBookingByCode(anyString())).thenReturn(mockResponse);

        BookingDetailResponse result = staffBookingService.createWalkInBooking(request, "receptionist1");

        assertNotNull(result);
        assertEquals(BookingStatus.CHECKED_IN.name(), result.getStatus());
        assertEquals("101", result.getRoomNumber());
        assertEquals("OCCUPIED", mockRoom.getStatus());

        verify(bookingRepository, times(1)).save(any(Booking.class));
        verify(bookingRoomRepository, times(1)).save(any(BookingRoom.class));
        verify(roomRepository, times(1)).save(mockRoom);
        verify(invoiceRepository, times(1)).save(any(Invoice.class));
        verify(paymentRepository, times(1)).save(any(Payment.class));
    }

    @Test
    void createWalkInBooking_DoubleBooking_ThrowsException() {
        WalkInBookingRequest request = WalkInBookingRequest.builder()
                .roomId(101)
                .checkInDate(LocalDate.now())
                .checkOutDate(LocalDate.now().plusDays(2))
                .guestCount(2)
                .fullName("Khách B")
                .phone("0911222333")
                .build();

        Booking busyBooking = Booking.builder()
                .bookingId(5)
                .status(BookingStatus.CONFIRMED.name())
                .build();
        BookingRoom existingBR = BookingRoom.builder()
                .booking(busyBooking)
                .plannedCheckin(LocalDate.now())
                .plannedCheckout(LocalDate.now().plusDays(3))
                .build();

        when(roomRepository.findById(101)).thenReturn(Optional.of(mockRoom));
        when(bookingRoomRepository.findByRoom_RoomId(101)).thenReturn(List.of(existingBR));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> staffBookingService.createWalkInBooking(request, "receptionist1"));

        assertTrue(ex.getMessage().contains("đã có khách đặt"));
    }

    @Test
    void createWalkInBooking_CashPaymentWithoutOpenShift_ThrowsException() {
        WalkInBookingRequest request = WalkInBookingRequest.builder()
                .roomId(101)
                .checkInDate(LocalDate.now())
                .checkOutDate(LocalDate.now().plusDays(1))
                .guestCount(1)
                .fullName("Khách C")
                .phone("0900000000")
                .amountPaid(BigDecimal.valueOf(300000))
                .paymentMethod("CASH")
                .build();

        when(roomRepository.findById(101)).thenReturn(Optional.of(mockRoom));
        when(bookingRoomRepository.findByRoom_RoomId(101)).thenReturn(new ArrayList<>());
        when(accountRepository.findByUsername("receptionist1")).thenReturn(Optional.of(mockStaff));
        when(cashierShiftRepository.findByAccount_AccountId(2)).thenReturn(new ArrayList<>()); // Chưa mở ca nào

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> staffBookingService.createWalkInBooking(request, "receptionist1"));

        assertTrue(ex.getMessage().contains("chưa mở Ca thu ngân"));
    }

    @Test
    void confirmDepositManual_DelegatesToCustomerBookingService() {
        when(customerBookingService.confirmDepositManual("BK-123", "receptionist1"))
                .thenReturn(BookingDetailResponse.builder().bookingCode("BK-123").status("CONFIRMED").build());

        BookingDetailResponse res = staffBookingService.confirmDepositManual("BK-123", "receptionist1");

        assertNotNull(res);
        assertEquals("CONFIRMED", res.getStatus());
        verify(customerBookingService, times(1)).confirmDepositManual("BK-123", "receptionist1");
    }

    @Test
    void cancelBooking_DelegatesToCustomerBookingService() {
        staffBookingService.cancelBooking("BK-123", "Khách đổi ý", "receptionist1");

        verify(customerBookingService, times(1)).cancelBooking("BK-123", "Khách đổi ý", "receptionist1");
    }
}
