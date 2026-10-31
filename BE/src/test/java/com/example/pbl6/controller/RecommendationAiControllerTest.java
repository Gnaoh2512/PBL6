package com.example.pbl6.controller;

import com.example.pbl6.security.CustomUserDetailsService;
import com.example.pbl6.security.JwtAuthenticationEntryPoint;
import com.example.pbl6.security.JwtAuthenticationFilter;
import com.example.pbl6.security.JwtTokenProvider;
import com.example.pbl6.security.SecurityConfig;
import com.example.pbl6.service.RecommendationAiClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RecommendationAiController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtAuthenticationEntryPoint.class})
class RecommendationAiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RecommendationAiClient aiClient;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private CustomUserDetailsService userDetailsService;

    @Test
    void bothRoutesRequireAuthenticatedJwt() throws Exception {
        for (String path : new String[]{
                "/api/ai/recommendations", "/api/ai/recommendations/conversation"}) {
            mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(post(path).header("Authorization", "Bearer invalid-jwt")
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isUnauthorized());
        }
        verify(aiClient, never()).post(anyString(), anyString(), anyString());
    }

    @Test
    void authenticatedJwtCanForwardAndRequestIdIsValidated() throws Exception {
        when(jwtTokenProvider.validateToken("valid-jwt")).thenReturn(true);
        when(jwtTokenProvider.getUsernameFromToken("valid-jwt")).thenReturn("guest");
        when(userDetailsService.loadUserByUsername("guest"))
                .thenReturn(User.withUsername("guest").password("unused").roles("CUSTOMER").build());
        when(aiClient.post("/api/v1/ai/recommendations", "{}", "trace-1"))
                .thenReturn(org.springframework.http.ResponseEntity.ok(
                        com.example.pbl6.common.ApiResponse.ok(
                                Map.of("status", "OK", "requestId", "trace-1",
                                        "recommendations", List.of(Map.of(
                                                "totalRoomCharge", new BigDecimal("1000000.25")))))));

        mockMvc.perform(post("/api/ai/recommendations")
                        .header("Authorization", "Bearer valid-jwt")
                        .header("X-Request-ID", "trace-1")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-ID", "trace-1"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("OK"))
                .andExpect(jsonPath("$.data.recommendations[0].totalRoomCharge")
                        .value(1000000.25));
        verify(aiClient).post("/api/v1/ai/recommendations", "{}", "trace-1");

        mockMvc.perform(post("/api/ai/recommendations/conversation")
                        .header("Authorization", "Bearer valid-jwt")
                        .header("X-Request-ID", "invalid id")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.success").value(false));
        verify(aiClient, never()).post("/api/v1/ai/recommendations/conversation", "{}", "invalid id");
    }
}
