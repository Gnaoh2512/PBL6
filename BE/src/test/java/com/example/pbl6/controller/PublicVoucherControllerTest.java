package com.example.pbl6.controller;

import com.example.pbl6.dto.voucher.VoucherApplyRequest;
import com.example.pbl6.dto.voucher.VoucherApplyResponse;
import com.example.pbl6.dto.voucher.VoucherResponse;
import com.example.pbl6.exception.GlobalExceptionHandler;
import com.example.pbl6.service.VoucherService;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PublicVoucherControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private VoucherService voucherService;

    @InjectMocks
    private PublicVoucherController publicVoucherController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(publicVoucherController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/public/vouchers: Khách xem danh sách voucher đang chạy")
    void testGetActiveVouchers() throws Exception {
        VoucherResponse v = VoucherResponse.builder()
                .voucherId(1)
                .code("SUMMER2026")
                .voucherName("Ưu đãi hè")
                .discountType("PERCENTAGE")
                .discountValue(BigDecimal.valueOf(10))
                .build();

        when(voucherService.getActiveVouchers()).thenReturn(List.of(v));

        mockMvc.perform(get("/api/public/vouchers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].code").value("SUMMER2026"));
    }

    @Test
    @DisplayName("POST /api/public/vouchers/apply: Khách kiểm tra và áp dụng thử mã voucher")
    void testApplyVoucher() throws Exception {
        VoucherApplyRequest request = VoucherApplyRequest.builder()
                .code("SUMMER2026")
                .orderAmount(BigDecimal.valueOf(1000000))
                .build();

        VoucherApplyResponse response = VoucherApplyResponse.builder()
                .isValid(true)
                .code("SUMMER2026")
                .discountAmount(BigDecimal.valueOf(100000))
                .finalAmount(BigDecimal.valueOf(900000))
                .newDepositRequired(BigDecimal.valueOf(270000))
                .message("Áp dụng mã thành công")
                .build();

        when(voucherService.previewVoucher(any(VoucherApplyRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/public/vouchers/apply")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.isValid").value(true))
                .andExpect(jsonPath("$.data.discountAmount").value(100000));
    }
}
