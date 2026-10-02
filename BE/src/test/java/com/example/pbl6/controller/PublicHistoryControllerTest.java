package com.example.pbl6.controller;

import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;
import com.example.pbl6.exception.GlobalExceptionHandler;
import com.example.pbl6.service.CustomerHistoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PublicHistoryControllerTest {

    private MockMvc mockMvc;

    @Mock
    private CustomerHistoryService customerHistoryService;

    @InjectMocks
    private PublicHistoryController publicHistoryController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(publicHistoryController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/public/history/lookup: Tra cứu danh sách lịch sử theo SĐT")
    void testLookupPublicHistory() throws Exception {
        CustomerBookingHistorySummaryResponse summary = CustomerBookingHistorySummaryResponse.builder()
                .bookingCode("BK-20261001-A1B2")
                .roomNumber("201")
                .roomTypeName("Phòng Deluxe")
                .checkInDate(LocalDate.of(2026, 10, 1))
                .checkOutDate(LocalDate.of(2026, 10, 3))
                .nights(2)
                .bookingStatus("CONFIRMED")
                .build();

        when(customerHistoryService.lookupPublicHistoryByPhone("0901234567", null)).thenReturn(List.of(summary));

        mockMvc.perform(get("/api/public/history/lookup")
                        .param("phone", "0901234567"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].bookingCode").value("BK-20261001-A1B2"))
                .andExpect(jsonPath("$.data[0].roomNumber").value("201"));
    }

    @Test
    @DisplayName("GET /api/public/history/lookup/{bookingCode}: Tra cứu chi tiết 1 đơn")
    void testLookupPublicBookingDetail() throws Exception {
        CustomerBookingHistoryDetailResponse detail = CustomerBookingHistoryDetailResponse.builder()
                .bookingCode("BK-20261001-A1B2")
                .customerName("Nguyễn Văn Khách")
                .roomNumber("201")
                .depositPaid(BigDecimal.valueOf(480000))
                .totalAmount(BigDecimal.valueOf(1760000))
                .build();

        when(customerHistoryService.lookupPublicBookingDetail("BK-20261001-A1B2", "0901234567")).thenReturn(detail);

        mockMvc.perform(get("/api/public/history/lookup/BK-20261001-A1B2")
                        .param("phone", "0901234567"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.bookingCode").value("BK-20261001-A1B2"))
                .andExpect(jsonPath("$.data.customerName").value("Nguyễn Văn Khách"));
    }
}
