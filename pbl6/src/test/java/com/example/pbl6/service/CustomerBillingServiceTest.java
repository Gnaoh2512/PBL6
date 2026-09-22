package com.example.pbl6.service;

import com.example.pbl6.common.enums.*;
import com.example.pbl6.config.BankConfig;
import com.example.pbl6.dto.billing.CancellationRefundResponse;
import com.example.pbl6.dto.billing.LiveFolioResponse;
import com.example.pbl6.dto.billing.SettlementRequest;
import com.example.pbl6.dto.booking.BankTransferQrResponse;
import com.example.pbl6.dto.service.ServiceOrderRequest;
import com.example.pbl6.dto.service.ServiceResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerBillingServiceTest {

    @Mock
    private ServiceRepository serviceRepository;
    @Mock
    private ServiceCategoryRepository serviceCategoryRepository;
    @Mock
    private ServiceUsageRepository serviceUsageRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private BookingRoomRepository bookingRoomRepository;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private VietQrService vietQrService;

    @Spy
    private FinancialCalculator financialCalculator = new FinancialCalculator();

    @InjectMocks
    private CustomerBillingServiceImpl billingService;

    private Booking mockBooking;
    private Room mockRoom;
    private RoomType mockRoomType;
    private BookingRoom mockBookingRoom;
    private com.example.pbl6.entity.Service mockService;
    private Invoice mockInvoice;

    @BeforeEach
    void setUp() {
        mockRoomType = RoomType.builder()
                .roomTypeId(1)
                .typeName("Phòng Standard")
                .basePrice(BigDecimal.valueOf(500000))
                .build();

        mockRoom = Room.builder()
                .roomId(101)
                .roomNumber("101")
                .roomType(mockRoomType)
                .status("AVAILABLE")
                .build();

        mockBooking = Booking.builder()
                .bookingId(10)
                .bookingCode("BK-20261001-A1B2")
                .checkInDate(LocalDate.now().plusDays(5))
                .checkOutDate(LocalDate.now().plusDays(7))
                .status(BookingStatus.CONFIRMED.name())
                .depositRequired(BigDecimal.valueOf(300000))
                .build();

        mockBookingRoom = BookingRoom.builder()
                .bookingRoomId(1)
                .booking(mockBooking)
                .room(mockRoom)
                .status(BookingStatus.CONFIRMED.name())
                .build();

        mockService = com.example.pbl6.entity.Service.builder()
                .serviceId(1)
                .serviceName("Nước suối Lavie")
                .unitPrice(BigDecimal.valueOf(15000))
                .unit("Chai")
                .isActive(true)
                .build();

        mockInvoice = Invoice.builder()
                .invoiceId(5)
                .invoiceNumber("INV-BK-20261001-A1B2")
                .booking(mockBooking)
                .status(InvoiceStatus.DRAFT.name())
                .roomCharge(BigDecimal.valueOf(1000000))
                .serviceCharge(BigDecimal.ZERO)
                .depositApplied(BigDecimal.valueOf(300000))
                .taxAmount(BigDecimal.valueOf(100000))
                .totalAmount(BigDecimal.valueOf(800000))
                .build();
    }

    @Test
    @DisplayName("Thành công: Lấy danh mục dịch vụ đang hoạt động")
    void testGetActiveServices() {
        when(serviceRepository.findByIsActiveTrue()).thenReturn(List.of(mockService));

        List<ServiceResponse> result = billingService.getActiveServices(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getServiceName()).isEqualTo("Nước suối Lavie");
        assertThat(result.get(0).getUnitPrice()).isEqualByComparingTo(BigDecimal.valueOf(15000));
    }

    @Test
    @DisplayName("Thành công: Khách gọi dịch vụ phòng trong lúc lưu trú")
    void testOrderInStayService() {
        ServiceOrderRequest request = ServiceOrderRequest.builder()
                .bookingCode("BK-20261001-A1B2")
                .serviceId(1)
                .quantity(2)
                .build();

        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(serviceRepository.findById(1)).thenReturn(Optional.of(mockService));
        when(invoiceRepository.findByBooking_BookingId(10)).thenReturn(List.of(mockInvoice));
        when(serviceUsageRepository.save(any(ServiceUsage.class))).thenAnswer(inv -> {
            ServiceUsage su = inv.getArgument(0);
            su.setUsageId(99);
            return su;
        });

        ServiceUsageResponse response = billingService.orderInStayService(request, "guest");

        assertThat(response).isNotNull();
        assertThat(response.getQuantity()).isEqualTo(2);
        assertThat(response.getTotalPrice()).isEqualByComparingTo(BigDecimal.valueOf(30000));
        assertThat(mockInvoice.getServiceCharge()).isEqualByComparingTo(BigDecimal.valueOf(30000));
        verify(serviceUsageRepository, times(1)).save(any(ServiceUsage.class));
        verify(invoiceRepository, times(1)).save(mockInvoice);
    }

    @Test
    @DisplayName("Thành công: Tra cứu Live Folio với đầy đủ chi phí, thuế VAT và cọc đã trừ")
    void testGetLiveFolio() {
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(10)).thenReturn(List.of(mockBookingRoom));

        ServiceUsage usage = ServiceUsage.builder()
                .usageId(1)
                .service(mockService)
                .quantity(2)
                .unitPriceApplied(BigDecimal.valueOf(15000))
                .totalPrice(BigDecimal.valueOf(30000))
                .build();
        when(serviceUsageRepository.findByBooking_BookingId(10)).thenReturn(List.of(usage));

        Payment depositPayment = Payment.builder()
                .paymentId(1)
                .type(PaymentType.DEPOSIT.name())
                .amount(BigDecimal.valueOf(300000))
                .build();
        when(paymentRepository.findByBooking_BookingId(10)).thenReturn(List.of(depositPayment));

        when(vietQrService.generateSettlementQr(eq("BK-20261001-A1B2"), any(BigDecimal.class)))
                .thenReturn(BankTransferQrResponse.builder().qrImageUrl("https://vietqr.net/settle.png").build());

        LiveFolioResponse folio = billingService.getLiveFolio("BK-20261001-A1B2");

        assertThat(folio).isNotNull();
        assertThat(folio.getNights()).isEqualTo(2);
        // Room charge = 500,000 * 2 = 1,000,000
        assertThat(folio.getRoomCharge()).isEqualByComparingTo(BigDecimal.valueOf(1000000));
        // Service charge = 30,000
        assertThat(folio.getServiceCharge()).isEqualByComparingTo(BigDecimal.valueOf(30000));
        // Subtotal = 1,030,000
        assertThat(folio.getSubtotal()).isEqualByComparingTo(BigDecimal.valueOf(1030000));
        // Tax 10% = 103,000
        assertThat(folio.getTaxAmount()).isEqualByComparingTo(BigDecimal.valueOf(103000));
        // Total = 1,133,000
        assertThat(folio.getTotalAmount()).isEqualByComparingTo(BigDecimal.valueOf(1133000));
        // Deposit = 300,000
        assertThat(folio.getDepositPaid()).isEqualByComparingTo(BigDecimal.valueOf(300000));
        // Remaining = 1,133,000 - 300,000 = 833,000
        assertThat(folio.getRemainingBalance()).isEqualByComparingTo(BigDecimal.valueOf(833000));
        assertThat(folio.isFullySettled()).isFalse();
        assertThat(folio.getSettlementQr()).isNotNull();
    }

    @Test
    @DisplayName("Thành công: Lễ tân Check-in khách (Room chuyển OCCUPIED, Booking chuyển CHECKED_IN)")
    void testCheckInGuest() {
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(10)).thenReturn(List.of(mockBookingRoom));

        billingService.checkInGuest("BK-20261001-A1B2", "receptionist");

        assertThat(mockBooking.getStatus()).isEqualTo(BookingStatus.CHECKED_IN.name());
        assertThat(mockRoom.getStatus()).isEqualTo(RoomStatus.OCCUPIED.name());
        verify(bookingRepository, times(1)).save(mockBooking);
        verify(roomRepository, times(1)).save(mockRoom);
    }

    @Test
    @DisplayName("Thành công: Tất toán hóa đơn và Check-out (Room chuyển CLEANING, Invoice chuyển PAID)")
    void testSettleCheckout() {
        mockBooking.setStatus(BookingStatus.CHECKED_IN.name());
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));
        when(bookingRoomRepository.findByBooking_BookingId(10)).thenReturn(List.of(mockBookingRoom));
        when(serviceUsageRepository.findByBooking_BookingId(10)).thenReturn(Collections.emptyList());
        when(invoiceRepository.findByBooking_BookingId(10)).thenReturn(List.of(mockInvoice));

        Payment depositPayment = Payment.builder()
                .paymentId(1)
                .type(PaymentType.DEPOSIT.name())
                .amount(BigDecimal.valueOf(300000))
                .build();
        when(paymentRepository.findByBooking_BookingId(10)).thenReturn(List.of(depositPayment));

        SettlementRequest request = SettlementRequest.builder()
                .paymentMethod("CASH")
                .note("Khách thanh toán tiền mặt tại quầy")
                .build();

        LiveFolioResponse response = billingService.settleCheckout("BK-20261001-A1B2", request, "cashier");

        assertThat(mockBooking.getStatus()).isEqualTo(BookingStatus.CHECKED_OUT.name());
        assertThat(mockRoom.getStatus()).isEqualTo(RoomStatus.CLEANING.name());
        assertThat(mockInvoice.getStatus()).isEqualTo(InvoiceStatus.PAID.name());
        verify(paymentRepository, times(1)).save(any(Payment.class));
        verify(invoiceRepository, times(1)).save(mockInvoice);
    }

    @Test
    @DisplayName("Thành công: Hủy phòng trước >= 3 ngày được hoàn 100% tiền cọc")
    void testCancelWithRefundPolicyFullRefund() {
        mockBooking.setCheckInDate(LocalDate.now().plusDays(5)); // Trước 5 ngày
        when(bookingRepository.findByBookingCode("BK-20261001-A1B2")).thenReturn(Optional.of(mockBooking));

        Payment depositPayment = Payment.builder()
                .paymentId(1)
                .type(PaymentType.DEPOSIT.name())
                .amount(BigDecimal.valueOf(300000))
                .build();
        when(paymentRepository.findByBooking_BookingId(10)).thenReturn(List.of(depositPayment));
        when(bookingRoomRepository.findByBooking_BookingId(10)).thenReturn(List.of(mockBookingRoom));
        when(invoiceRepository.findByBooking_BookingId(10)).thenReturn(List.of(mockInvoice));

        CancellationRefundResponse result = billingService.cancelWithRefundPolicy("BK-20261001-A1B2", "Khách đổi lịch", "staff");

        assertThat(result.getRefundPercentage()).isEqualTo(100);
        assertThat(result.getRefundAmount()).isEqualByComparingTo(BigDecimal.valueOf(300000));
        assertThat(result.getPenaltyFee()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(mockBooking.getStatus()).isEqualTo(BookingStatus.CANCELED.name());
        verify(paymentRepository, times(1)).save(argThat(p -> PaymentType.REFUND.name().equals(p.getType())));
    }
}
