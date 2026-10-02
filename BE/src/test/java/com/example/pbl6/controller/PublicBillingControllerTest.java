package com.example.pbl6.controller;

import com.example.pbl6.dto.billing.LiveFolioResponse;
import com.example.pbl6.dto.booking.BankTransferQrResponse;
import com.example.pbl6.dto.service.ServiceOrderRequest;
import com.example.pbl6.dto.service.ServiceResponse;
import com.example.pbl6.dto.service.ServiceUsageResponse;
import com.example.pbl6.exception.GlobalExceptionHandler;
import com.example.pbl6.service.CustomerBillingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PublicBillingControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private CustomerBillingService billingService;

    @InjectMocks
    private PublicBillingController publicBillingController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(publicBillingController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/public/services: Lấy danh mục dịch vụ")
    void testGetServices() throws Exception {
        ServiceResponse s = ServiceResponse.builder()
                .serviceId(1)
                .serviceName("Lavie 500ml")
                .unitPrice(BigDecimal.valueOf(15000))
                .unit("Chai")
                .build();

        when(billingService.getActiveServices(null)).thenReturn(List.of(s));

        mockMvc.perform(get("/api/public/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].serviceName").value("Lavie 500ml"));
    }

    @Test
    @DisplayName("POST /api/public/services/order: Khách gọi món / dịch vụ phòng")
    void testOrderInStayService() throws Exception {
        ServiceOrderRequest request = ServiceOrderRequest.builder()
                .bookingCode("BK-20261001-A1B2")
                .serviceId(1)
                .quantity(2)
                .build();

        ServiceUsageResponse response = ServiceUsageResponse.builder()
                .usageId(10)
                .serviceName("Lavie 500ml")
                .quantity(2)
                .totalPrice(BigDecimal.valueOf(30000))
                .build();

        when(billingService.orderInStayService(any(ServiceOrderRequest.class), any())).thenReturn(response);

        mockMvc.perform(post("/api/public/services/order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.quantity").value(2))
                .andExpect(jsonPath("$.data.totalPrice").value(30000));
    }

    @Test
    @DisplayName("GET /api/public/bookings/{bookingCode}/folio: Tra cứu Live Folio")
    void testGetLiveFolio() throws Exception {
        LiveFolioResponse folio = LiveFolioResponse.builder()
                .bookingCode("BK-20261001-A1B2")
                .roomNumber("101")
                .nights(2)
                .roomCharge(BigDecimal.valueOf(1000000))
                .serviceCharge(BigDecimal.valueOf(30000))
                .taxAmount(BigDecimal.valueOf(103000))
                .totalAmount(BigDecimal.valueOf(1133000))
                .depositPaid(BigDecimal.valueOf(300000))
                .remainingBalance(BigDecimal.valueOf(833000))
                .isFullySettled(false)
                .build();

        when(billingService.getLiveFolio("BK-20261001-A1B2")).thenReturn(folio);

        mockMvc.perform(get("/api/public/bookings/BK-20261001-A1B2/folio"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.roomNumber").value("101"))
                .andExpect(jsonPath("$.data.remainingBalance").value(833000))
                .andExpect(jsonPath("$.data.isFullySettled").value(false));
    }

    @Test
    @DisplayName("POST /api/public/bookings/{bookingCode}/simulate-settlement: Giả lập tất toán")
    void testSimulateSettlement() throws Exception {
        LiveFolioResponse settledFolio = LiveFolioResponse.builder()
                .bookingCode("BK-20261001-A1B2")
                .roomNumber("101")
                .remainingBalance(BigDecimal.ZERO)
                .isFullySettled(true)
                .build();

        when(billingService.settleCheckout(eq("BK-20261001-A1B2"), any(), any())).thenReturn(settledFolio);

        mockMvc.perform(post("/api/public/bookings/BK-20261001-A1B2/simulate-settlement"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.remainingBalance").value(0))
                .andExpect(jsonPath("$.data.isFullySettled").value(true));
    }
}
