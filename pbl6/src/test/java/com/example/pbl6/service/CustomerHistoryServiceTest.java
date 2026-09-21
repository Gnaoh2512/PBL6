package com.example.pbl6.service;

import com.example.pbl6.common.enums.BookingStatus;
import com.example.pbl6.common.enums.PaymentType;
import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;
import com.example.pbl6.entity.*;
import com.example.pbl6.repository.*;
import com.example.pbl6.service.financial.FinancialCalculator;
import com.example.pbl6.service.financial.VietQrService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerHistoryServiceTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private BookingRoomRepository bookingRoomRepository;
    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private ServiceUsageRepository serviceUsageRepository;
    @Mock
    private VietQrService vietQrService;

    @Spy
    private FinancialCalculator financialCalculator = new FinancialCalculator();

    @InjectMocks
    private CustomerHistoryServiceImpl customerHistoryService;

    private Account mockAccount;
    private Customer mockCustomer;
    private Booking mockBooking;
    private Room mockRoom;
    private RoomType mockRoomType;
    private BookingRoom mockBookingRoom;

    @BeforeEach
    void setUp() {
        mockAccount = Account.builder()
                .accountId(1)
                .username("customer1")
                .fullName("Nguyễn Văn Khách")
                .email("customer1@gmail.com")
                .phone("0901234567")
                .role("CUSTOMER")
                .build();

        mockCustomer = Customer.builder()
                .customerId(10)
                .fullName("Nguyễn Văn Khách")
                .email("customer1@gmail.com")
                .phone("0901234567")
                .build();

        mockRoomType = RoomType.builder()
                .roomTypeId(1)
                .typeName("Phòng Deluxe Hướng Biển")
                .basePrice(BigDecimal.valueOf(800000))
                .amenities("Ban công, Bồn tắm, Wifi tốc độ cao")
                .build();

        mockRoom = Room.builder()
                .roomId(201)
                .roomNumber("201")
                .floor(2)
                .roomType(mockRoomType)
                .status("OCCUPIED")
                .build();

        mockBooking = Booking.builder()
                .bookingId(100)
                .bookingCode("BK-20261001-A1B2")
                .customer(mockCustomer)
                .checkInDate(LocalDate.of(2026, 10, 1))
                .checkOutDate(LocalDate.of(2026, 10, 3))
                .guestCount(2)
                .status(BookingStatus.CONFIRMED.name())
                .depositRequired(BigDecimal.valueOf(480000))
                .createdAt(LocalDateTime.of(2026, 9, 21, 10, 0))
                .build();

        mockBookingRoom = BookingRoom.builder()
                .bookingRoomId(50)
                .booking(mockBooking)
                .room(mockRoom)
                .priceApplied(BigDecimal.valueOf(800000))
                .status(BookingStatus.CONFIRMED.name())
                .build();
    }

    @Test
    @DisplayName("Thành công: Khách thành viên lấy danh sách lịch sử đặt phòng")
    void testGetMemberHistory_Success() {
        when(accountRepository.findByUsername("customer1")).thenReturn(Optional.of(mockAccount));
        when(customerRepository.findByEmail("customer1@gmail.com")).thenReturn(Optional.of(mockCustomer));
        when(bookingRepository.findByCustomer_CustomerIdOrderByCreatedAtDesc(10)).thenReturn(List.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(100)).thenReturn(List.of(mockBookingRoom));
        when(paymentRepository.findByBooking_BookingId(100)).thenReturn(Collections.emptyList());

        List<CustomerBookingHistorySummaryResponse> history = customerHistoryService.getMemberHistory("customer1", "ALL");

        assertThat(history).hasSize(1);
        CustomerBookingHistorySummaryResponse item = history.get(0);
        assertThat(item.getBookingCode()).isEqualTo("BK-20261001-A1B2");
        assertThat(item.getRoomNumber()).isEqualTo("201");
        assertThat(item.getNights()).isEqualTo(2);
        assertThat(item.getBookingStatus()).isEqualTo(BookingStatus.CONFIRMED.name());
    }

    @Test
    @DisplayName("Thành công: Khách thành viên xem chi tiết toàn diện 1 đơn trong lịch sử")
    void testGetMemberBookingDetail_Success() {
        when(accountRepository.findByUsername("customer1")).thenReturn(Optional.of(mockAccount));
        when(customerRepository.findByEmail("customer1@gmail.com")).thenReturn(Optional.of(mockCustomer));
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(100)).thenReturn(List.of(mockBookingRoom));
        when(serviceUsageRepository.findByBooking_BookingId(100)).thenReturn(Collections.emptyList());

        Payment depositPayment = Payment.builder()
                .paymentId(1)
                .type(PaymentType.DEPOSIT.name())
                .amount(BigDecimal.valueOf(480000))
                .method("BANK_TRANSFER")
                .paidAt(LocalDateTime.now())
                .build();
        when(paymentRepository.findByBooking_BookingId(100)).thenReturn(List.of(depositPayment));

        CustomerBookingHistoryDetailResponse detail = customerHistoryService.getMemberBookingDetail("customer1", "BK-20261001-A1B2");

        assertThat(detail).isNotNull();
        assertThat(detail.getBookingCode()).isEqualTo("BK-20261001-A1B2");
        assertThat(detail.getCustomerName()).isEqualTo("Nguyễn Văn Khách");
        assertThat(detail.getRoomNumber()).isEqualTo("201");
        assertThat(detail.getDepositPaid()).isEqualByComparingTo(BigDecimal.valueOf(480000));
        assertThat(detail.getPaymentTransactions()).hasSize(1);
    }

    @Test
    @DisplayName("Thất bại: Khách thành viên cố tình xem đơn của người khác")
    void testGetMemberBookingDetail_Unauthorized() {
        Account anotherAccount = Account.builder()
                .accountId(2)
                .username("customer2")
                .email("other@gmail.com")
                .phone("0999999999")
                .build();

        when(accountRepository.findByUsername("customer2")).thenReturn(Optional.of(anotherAccount));
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));

        assertThatThrownBy(() -> customerHistoryService.getMemberBookingDetail("customer2", "BK-20261001-A1B2"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("không có quyền truy cập");
    }

    @Test
    @DisplayName("Thành công: Khách vãng lai tra cứu lịch sử bằng Số điện thoại")
    void testLookupPublicHistoryByPhone_Success() {
        when(bookingRepository.findByCustomer_PhoneOrderByCreatedAtDesc("0901234567")).thenReturn(List.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(100)).thenReturn(List.of(mockBookingRoom));
        when(paymentRepository.findByBooking_BookingId(100)).thenReturn(Collections.emptyList());

        List<CustomerBookingHistorySummaryResponse> history = customerHistoryService.lookupPublicHistoryByPhone("0901234567", null);

        assertThat(history).hasSize(1);
        assertThat(history.get(0).getBookingCode()).isEqualTo("BK-20261001-A1B2");
    }

    @Test
    @DisplayName("Thất bại: Khách vãng lai tra cứu chi tiết nhưng nhập sai Số điện thoại")
    void testLookupPublicBookingDetail_WrongPhone_ThrowsException() {
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));

        assertThatThrownBy(() -> customerHistoryService.lookupPublicBookingDetail("BK-20261001-A1B2", "0999999999"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Số điện thoại không trùng khớp");
    }
}
