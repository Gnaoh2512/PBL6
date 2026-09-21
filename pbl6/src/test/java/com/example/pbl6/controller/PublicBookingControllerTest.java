package com.example.pbl6.controller;

import com.example.pbl6.dto.booking.BankTransferQrResponse;
import com.example.pbl6.dto.booking.BookingCreateRequest;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.booking.PaymentStatusResponse;
import com.example.pbl6.exception.GlobalExceptionHandler;
import com.example.pbl6.service.CustomerBookingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PublicBookingControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private CustomerBookingService customerBookingService;

    @InjectMocks
    private PublicBookingController publicBookingController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(publicBookingController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void createBooking_ValidRequest_ReturnsCreatedWithQr() throws Exception {
        BookingCreateRequest request = BookingCreateRequest.builder()
                .roomId(101)
                .checkInDate(LocalDate.now().plusDays(1))
                .checkOutDate(LocalDate.now().plusDays(3))
                .guestCount(2)
                .fullName("Trần Thị Mai")
                .phone("0912345678")
                .build();

        BankTransferQrResponse qr = BankTransferQrResponse.builder()
                .bankId("MB")
                .accountNo("090123456789")
                .amount(BigDecimal.valueOf(300000))
                .transferContent("PBL6 BK-20261001-A1B2")
                .qrImageUrl("https://img.vietqr.io/...")
                .build();

        BookingDetailResponse mockResponse = BookingDetailResponse.builder()
                .bookingId(1)
                .bookingCode("BK-20261001-A1B2")
                .status("PENDING_DEPOSIT")
                .depositRequired(BigDecimal.valueOf(300000))
                .qrInfo(qr)
                .build();

        when(customerBookingService.createBooking(any(), any())).thenReturn(mockResponse);

        mockMvc.perform(post("/api/public/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.bookingCode").value("BK-20261001-A1B2"))
                .andExpect(jsonPath("$.data.status").value("PENDING_DEPOSIT"))
                .andExpect(jsonPath("$.data.qrInfo.transferContent").value("PBL6 BK-20261001-A1B2"));
    }

    @Test
    void getPaymentStatus_ReturnsStatus() throws Exception {
        PaymentStatusResponse response = PaymentStatusResponse.builder()
                .bookingCode("BK-20261001-A1B2")
                .bookingStatus("CONFIRMED")
                .isPaid(true)
                .depositAmount(BigDecimal.valueOf(300000))
                .message("Đã thanh toán tiền cọc thành công!")
                .build();

        when(customerBookingService.getPaymentStatus("BK-20261001-A1B2")).thenReturn(response);

        mockMvc.perform(get("/api/public/bookings/BK-20261001-A1B2/payment-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.isPaid").value(true))
                .andExpect(jsonPath("$.data.bookingStatus").value("CONFIRMED"));
    }

    @Test
    void simulateDeposit_ReturnsConfirmed() throws Exception {
        PaymentStatusResponse response = PaymentStatusResponse.builder()
                .bookingCode("BK-20261001-A1B2")
                .bookingStatus("CONFIRMED")
                .isPaid(true)
                .build();

        when(customerBookingService.simulateDeposit("BK-20261001-A1B2")).thenReturn(response);

        mockMvc.perform(post("/api/public/bookings/BK-20261001-A1B2/simulate-deposit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.isPaid").value(true));
    }
}
