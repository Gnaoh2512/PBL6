package com.example.pbl6.controller;

import com.example.pbl6.controller.assistant.AssistantController;
import com.example.pbl6.service.assistant.*;
import com.example.pbl6.security.*;
import org.junit.jupiter.api.*;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import jakarta.servlet.http.Cookie;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AssistantControllerTest {
    MockMvc mvc;
    AssistantClient client = mock(AssistantClient.class);
    String messageId = UUID.randomUUID().toString();
    @BeforeEach void setup() {
        MockEnvironment env = new MockEnvironment(); env.setActiveProfiles("local");
        var config = new AssistantConfig(true, "demo_synthetic", "service-test", "http://127.0.0.1:8006", "http://localhost:3000", env);
        var jwt = new JwtAuthenticationFilter(mock(JwtTokenProvider.class), mock(CustomUserDetailsService.class));
        mvc = MockMvcBuilders.standaloneSetup(new AssistantController(config, new AssistantSessions(), client)).addFilters(jwt).build();
        when(client.turn(anyMap(), anyString())).thenReturn(Map.of("status", "answered", "answer", "demo", "citations", List.of(), "cards", List.of(), "actions", List.of(), "missingFields", List.of(), "corpusMode", "demo_synthetic"));
    }
    String body(String extra) { return "{\"conversationId\":null,\"clientMessageId\":\""+messageId+"\",\"message\":\"wifi\""+extra+"}"; }
    @Test void guestCanAskAndRetryWithoutDuplicatingProvider() throws Exception {
        var result = mvc.perform(post("/api/assistant/chat").header("Origin", "http://localhost:3000").contentType(MediaType.APPLICATION_JSON).content(body("")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("answered")).andReturn();
        Cookie cookie = result.getResponse().getCookie("assistant_session");
        mvc.perform(post("/api/assistant/chat").cookie(cookie).header("Origin", "http://localhost:3000").contentType(MediaType.APPLICATION_JSON).content(body(""))).andExpect(status().isOk());
        verify(client, times(1)).turn(anyMap(), anyString());
        mvc.perform(delete("/api/assistant/session").cookie(cookie).header("Origin", "http://localhost:3000")).andExpect(status().isNoContent());
    }
    @Test void originJwtIdentityAndPayloadAreRejected() throws Exception {
        mvc.perform(post("/api/assistant/chat").header("Origin", "https://evil.invalid").contentType(MediaType.APPLICATION_JSON).content(body(""))).andExpect(status().isForbidden());
        mvc.perform(post("/api/assistant/chat").header("Origin", "http://localhost:3000").header("Authorization", "Bearer customer-jwt").contentType(MediaType.APPLICATION_JSON).content(body(""))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/assistant/chat").header("Origin", "http://localhost:3000").contentType(MediaType.APPLICATION_JSON).content(body(",\"username\":\"victim\""))).andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/assistant/chat").header("Origin", "http://localhost:3000").contentType(MediaType.APPLICATION_JSON).content("x".repeat(16385))).andExpect(status().isContentTooLarge());
        verifyNoInteractions(client);
    }
}
