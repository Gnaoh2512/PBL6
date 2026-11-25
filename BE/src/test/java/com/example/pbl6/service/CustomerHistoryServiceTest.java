package com.example.pbl6.service;

import com.example.pbl6.common.enums.BookingStatus;
import com.example.pbl6.common.enums.PaymentType;
import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;
import com.example.pbl6.entity.*;
import com.example.pbl6.exception.ResourceNotFoundException;
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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
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
    private ServiceRequestRepository serviceRequestRepository;
    @Mock
    private LoyaltyBenefitSupport loyaltyBenefitSupport;
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
                .role(Role.builder()
                        .roleCode("ROLE_CUSTOMER")
                        .roleName("Customer")
                        .build())
                .build();

        mockCustomer = Customer.builder()
                .customerId(10)
                .account(mockAccount)
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
    @DisplayName("Thành công: Khách thành viên lấy danh sách lịch sử đặt phòng qua FK account_id")
    void testGetMemberHistory_Success() {
        when(accountRepository.findByUsername("customer1")).thenReturn(Optional.of(mockAccount));
        when(customerRepository.findByAccount_AccountId(1)).thenReturn(Optional.of(mockCustomer));
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
    @DisplayName("Bảo mật: Tài khoản chưa gắn Customer không được rơi về accountId == customerId")
    void testGetMemberHistory_UnlinkedAccountNeverFallsBackToAccountId() {
        Account unlinkedAccount = Account.builder()
                .accountId(10) // collides with mockCustomer.customerId == 10
                .username("newuser")
                .email("customer1@gmail.com") // even matching unverified email must NOT grant access
                .phone("0901234567")
                .build();
        when(accountRepository.findByUsername("newuser")).thenReturn(Optional.of(unlinkedAccount));
        when(customerRepository.findByAccount_AccountId(10)).thenReturn(Optional.empty());

        List<CustomerBookingHistorySummaryResponse> history = customerHistoryService.getMemberHistory("newuser", "ALL");

        assertThat(history).isEmpty();
        verifyNoInteractions(bookingRepository);
    }

    @Test
    @DisplayName("Thành công: Khách thành viên xem chi tiết toàn diện 1 đơn trong lịch sử")
    void testGetMemberBookingDetail_Success() {
        when(accountRepository.findByUsername("customer1")).thenReturn(Optional.of(mockAccount));
        when(customerRepository.findByAccount_AccountId(1)).thenReturn(Optional.of(mockCustomer));
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(100)).thenReturn(List.of(mockBookingRoom));
        when(serviceUsageRepository.findByBooking_BookingId(100)).thenReturn(Collections.emptyList());
        when(loyaltyBenefitSupport.withBillLines(anyList(), eq(100)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(loyaltyBenefitSupport.toResponses(Collections.emptyList())).thenReturn(Collections.emptyList());

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
        assertThat(detail.getServiceRequests()).isEmpty();
    }

    @Test
    @DisplayName("Bảo mật: Khách thành viên cố xem đơn người khác (kể cả trùng email/SĐT) bị chặn đồng nhất bằng ResourceNotFoundException")
    void testGetMemberBookingDetail_UnauthorizedReturnsNotFoundEvenWithMatchingEmailOrPhone() {
        Account anotherAccount = Account.builder()
                .accountId(2)
                .username("customer2")
                .email("customer1@gmail.com")
                .phone("0901234567")
                .build();
        Customer anotherCustomer = Customer.builder().customerId(20).account(anotherAccount).build();

        when(accountRepository.findByUsername("customer2")).thenReturn(Optional.of(anotherAccount));
        when(customerRepository.findByAccount_AccountId(2)).thenReturn(Optional.of(anotherCustomer));
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));

        assertThatThrownBy(() -> customerHistoryService.getMemberBookingDetail("customer2", "BK-20261001-A1B2"))
                .isInstanceOf(ResourceNotFoundException.class);
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
