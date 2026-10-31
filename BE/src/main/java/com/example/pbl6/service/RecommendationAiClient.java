package com.example.pbl6.service;

import com.example.pbl6.common.ApiResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class RecommendationAiClient {

    private final URI baseUrl;
    private final String serviceToken;
    private final Duration timeout;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);

    public RecommendationAiClient(
            @Value("${ai.service.url:http://127.0.0.1:8006}") String url,
            @Value("${ai.service.token:}") String serviceToken,
            @Value("${ai.service.timeout-ms:15000}") long timeoutMs) {
        URI configured;
        try {
            configured = URI.create(url);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("AI_SERVICE_URL must be an HTTP(S) origin", ex);
        }
        if (!("http".equals(configured.getScheme()) || "https".equals(configured.getScheme()))
                || configured.getHost() == null || configured.getUserInfo() != null
                || configured.getQuery() != null || configured.getFragment() != null
                || !configured.getPath().replace("/", "").isEmpty()) {
            throw new IllegalArgumentException("AI_SERVICE_URL must be an HTTP(S) origin");
        }
        if (timeoutMs <= 0) {
            throw new IllegalArgumentException("AI_SERVICE_TIMEOUT_MS must be positive");
        }
        this.baseUrl = URI.create(configured.toString().replaceAll("/+$", ""));
        this.serviceToken = serviceToken;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public ResponseEntity<ApiResponse<Map<String, Object>>> post(
            String path, String body, String requestId) {
        if (serviceToken == null || serviceToken.isBlank()
                || serviceToken.chars().anyMatch(value -> value < 33 || value > 126)) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "AI service is not configured", null);
        }
        HttpRequest request = HttpRequest.newBuilder(baseUrl.resolve(path))
                .timeout(timeout)
                .header("Authorization", "Bearer " + serviceToken)
                .header("X-Request-ID", requestId)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : body))
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<String, Object> result = parseObject(response.body());
                if (result.get("status") instanceof String
                        && requestId.equals(result.get("requestId"))) {
                    return ResponseEntity.ok(ApiResponse.ok(result));
                }
                return error(HttpStatus.BAD_GATEWAY, "AI service returned an invalid response", null);
            }
            return mapError(response);
        } catch (HttpTimeoutException ex) {
            return error(HttpStatus.GATEWAY_TIMEOUT, "AI service timed out", null);
        } catch (IOException ex) {
            return error(HttpStatus.BAD_GATEWAY, "AI service is unavailable", null);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return error(HttpStatus.BAD_GATEWAY, "AI service request was interrupted", null);
        }
    }

    private ResponseEntity<ApiResponse<Map<String, Object>>> mapError(HttpResponse<String> response) {
        int status = response.statusCode();
        if (status != 413 && status != 422 && status != 502 && status != 503 && status != 504) {
            return error(HttpStatus.BAD_GATEWAY, "AI service is unavailable", null);
        }
        try {
            Object errorValue = parseObject(response.body()).get("error");
            if (!(errorValue instanceof Map<?, ?> upstreamError)
                    || !(upstreamError.get("code") instanceof String code)) {
                return error(HttpStatus.BAD_GATEWAY, "AI service returned an invalid error", null);
            }
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("code", code);
            data.put("details", upstreamError.get("details"));
            String message = switch (status) {
                case 413, 422 -> "Invalid recommendation request";
                case 503 -> "AI service is not configured or ready";
                case 504 -> "AI service timed out";
                default -> "AI service is unavailable";
            };
            return error(HttpStatus.valueOf(status), message, data);
        } catch (IOException ex) {
            return error(HttpStatus.BAD_GATEWAY, "AI service returned an invalid error", null);
        }
    }

    private Map<String, Object> parseObject(String body) throws IOException {
        Object parsed = objectMapper.readValue(body, new TypeReference<Object>() {});
        if (!(parsed instanceof Map<?, ?> raw)) {
            throw new IOException("AI service returned a non-object response");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : raw.entrySet()) {
            if (!(entry.getKey() instanceof String key)) {
                throw new IOException("AI service returned a non-string key");
            }
            result.put(key, entry.getValue());
        }
        return result;
    }

    private ResponseEntity<ApiResponse<Map<String, Object>>> error(
            HttpStatus status, String message, Map<String, Object> data) {
        ApiResponse<Map<String, Object>> body = data == null
                ? ApiResponse.error(message)
                : ApiResponse.<Map<String, Object>>builder()
                        .success(false).message(message).data(data).build();
        return ResponseEntity.status(status).body(body);
    }
}
