package com.example.pbl6.controller;

import com.example.pbl6.common.ApiResponse;
import com.example.pbl6.service.RecommendationAiClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/ai/recommendations")
@RequiredArgsConstructor
public class RecommendationAiController {

    private static final Pattern REQUEST_ID = Pattern.compile("[A-Za-z0-9._-]{1,64}");
    private final RecommendationAiClient aiClient;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> recommend(
            @RequestBody(required = false) String body,
            @RequestHeader(value = "X-Request-ID", required = false) String suppliedRequestId) {
        return forward("/api/v1/ai/recommendations", body, suppliedRequestId);
    }

    @PostMapping(value = "/conversation", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> converse(
            @RequestBody(required = false) String body,
            @RequestHeader(value = "X-Request-ID", required = false) String suppliedRequestId) {
        return forward("/api/v1/ai/recommendations/conversation", body, suppliedRequestId);
    }

    private ResponseEntity<ApiResponse<Map<String, Object>>> forward(
            String path, String body, String suppliedRequestId) {
        String requestId = suppliedRequestId == null ? UUID.randomUUID().toString() : suppliedRequestId;
        if (!REQUEST_ID.matcher(requestId).matches()) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT)
                    .header("X-Request-ID", UUID.randomUUID().toString())
                    .body(ApiResponse.error("Invalid X-Request-ID"));
        }
        ResponseEntity<ApiResponse<Map<String, Object>>> result = aiClient.post(path, body, requestId);
        return ResponseEntity.status(result.getStatusCode())
                .header("X-Request-ID", requestId)
                .body(result.getBody());
    }
}
