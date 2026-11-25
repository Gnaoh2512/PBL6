package com.example.pbl6.controller.assistant;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.service.assistant.*;
import com.example.pbl6.dto.assistant.ChatRequest;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@RestController
@RequestMapping("/api/assistant")
public class AssistantController {
    private final AssistantConfig config;
    private final AssistantSessions sessions;
    private final AssistantOrchestrator orchestrator;
    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    public AssistantController(AssistantConfig config, AssistantSessions sessions, AssistantOrchestrator orchestrator) {
        this.config = config; this.sessions = sessions; this.orchestrator = orchestrator;
    }

    public AssistantController(AssistantConfig config, AssistantSessions sessions, AssistantClient client) {
        this(config, sessions, new AssistantOrchestrator(config, client, null));
    }
    private void origin(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin == null || !config.origins.contains(origin)) throw new AssistantFault(403, "FORBIDDEN");
    }
    private static String cookie(HttpServletRequest request) {
        if (request.getCookies() != null) for (Cookie c : request.getCookies())
            if (c.getName().equals("assistant_session") && c.getValue().matches("[a-f0-9-]{36}")) return c.getValue();
        return "";
    }
    private String setCookie(String value, long seconds) {
        return ResponseCookie.from("assistant_session", value).httpOnly(true).secure(config.secureCookie)
                .sameSite("Lax").path("/api/assistant").maxAge(seconds).build().toString();
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException("Hash unavailable"); }
    }
    @PostMapping("/chat")
    public ResponseEntity<?> chat(HttpServletRequest request, HttpServletResponse output, Authentication authentication) {
        long started = System.nanoTime();
        String requestId = request.getHeader("X-Request-ID");
        if (requestId == null) requestId = UUID.randomUUID().toString();
        if (!requestId.matches("[A-Za-z0-9._-]{1,64}")) return error(UUID.randomUUID().toString(), new AssistantFault(422, "VALIDATION_ERROR"));
        try {
            origin(request);
            if (!config.enabled) throw new AssistantFault(503, "AI_NOT_CONFIGURED");
            if (request.getContentType() == null || !request.getContentType().toLowerCase(Locale.ROOT).startsWith("application/json"))
                throw new AssistantFault(422, "VALIDATION_ERROR");
            byte[] bytes = request.getInputStream().readNBytes(16385);
            if (bytes.length > 16384) throw new AssistantFault(413, "PAYLOAD_TOO_LARGE");
            JsonNode body;
            try { body = mapper.readTree(bytes); } catch (Exception e) { throw new AssistantFault(400, "INVALID_JSON"); }
            ChatRequest parsed = ChatRequest.parse(body);
            String conversation = parsed.conversationId(), messageId = parsed.clientMessageId(), message = parsed.message();
            boolean isAuthenticated = authentication != null && authentication.isAuthenticated()
                    && !authentication.getName().equals("anonymousUser");
            String authenticatedUsername = isAuthenticated ? authentication.getName() : null;
            String owner = isAuthenticated
                    ? authenticatedUsername + ":" + hash(Objects.toString(request.getHeader("Authorization"), "")) : "guest";
            var session = sessions.resolve(cookie(request), owner, conversation);
            output.setHeader(HttpHeaders.SET_COOKIE, setCookie(session.cookie, 1800));
            String messageHash = hash(message);
            var cached = sessions.begin(session, messageId, messageHash);
            Map<String, Object> data;
            if (cached != null) data = cached.response();
            else {
                try {
                    String turn = UUID.randomUUID().toString();
                    boolean isCustomer = isAuthenticated
                            && authentication.getAuthorities().stream()
                            .map(GrantedAuthority::getAuthority)
                            .anyMatch(role -> "ROLE_CUSTOMER".equalsIgnoreCase(role) || "CUSTOMER".equalsIgnoreCase(role));
                    data = new LinkedHashMap<>(orchestrator.executeTurn(
                            requestId, session.conversation, turn, message,
                            sessions.history(session), authenticatedUsername, isCustomer, started
                    ));
                    data.put("requestId", requestId); data.put("conversationId", session.conversation);
                    data.put("turnId", turn); data.put("clientMessageId", messageId);
                    sessions.finish(session, messageId, messageHash, message, data);
                } catch (RuntimeException e) { sessions.fail(session, messageId, e instanceof AssistantFault f ? f : new AssistantFault(500, "INTERNAL_ERROR")); throw e; }
            }
            return ResponseEntity.ok().header("X-Request-ID", (String)data.get("requestId"))
                .body(ApiResponse.ok(data));
        } catch (AssistantFault e) { return error(requestId, e);
        } catch (Exception e) { return error(requestId, new AssistantFault(500, "INTERNAL_ERROR")); }
    }
    @DeleteMapping("/session")
    public ResponseEntity<?> reset(HttpServletRequest request) {
        try {
            origin(request); sessions.invalidate(cookie(request));
            return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, setCookie("", 0)).build();
        } catch (AssistantFault e) { return error(UUID.randomUUID().toString(), e); }
    }
    private ResponseEntity<?> error(String id, AssistantFault fault) {
        return ResponseEntity.status(fault.status).header("X-Request-ID", id).body(
            ApiResponse.builder().success(false).message("Không thể xử lý yêu cầu trợ lý lúc này.")
                .data(Map.of("requestId", id, "code", fault.code, "retryable", fault.status >= 500)).build());
    }
}
