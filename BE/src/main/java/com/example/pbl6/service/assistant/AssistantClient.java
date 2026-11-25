package com.example.pbl6.service.assistant;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;

@Component
public class AssistantClient {
    private static final Pattern UUID_PATTERN = Pattern.compile("^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$");
    private static final Set<String> CITATION_FIELDS = Set.of(
            "citationId", "documentId", "version", "chunkId", "sectionId", "title", "sourceRef"
    );
    private static final Set<String> ACTION_TYPES = Set.of("open_login", "open_room_search", "open_services");
    private static final Set<String> FINAL_STATUSES = Set.of(
            "answered", "needs_clarification", "no_results", "requires_login",
            "insufficient_evidence", "capability_unavailable"
    );

    private final AssistantConfig config;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(3))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public AssistantClient(AssistantConfig config) {
        this.config = config;
    }

    public record ToolCall(String callId, String name, JsonNode arguments) {}

    public record Usage(int toolCallsUsed, int brokerBatchesUsed, int inputTokensUsed, int outputTokensUsed) {}

    public record TurnStep(
            String kind,
            String continuationId,
            List<ToolCall> toolCalls,
            Map<String, Object> finalData,
            Usage usage
    ) {
        public boolean isToolCalls() {
            return "tool_calls".equals(kind);
        }

        public boolean isFinal() {
            return "final".equals(kind);
        }
    }

    /**
     * Backward-compatible D1 single-step turn call expecting kind=final.
     */
    public Map<String, Object> turn(Map<String, Object> payload, String requestId) {
        TurnStep step = exchange(payload, requestId, Set.of("search_knowledge"), 1, 0, false, false, new HashMap<>());
        require(step.isFinal());
        return step.finalData();
    }

    public TurnStep exchange(
            Map<String, Object> payload,
            String requestId,
            Set<String> allowedTools,
            int remainingToolCalls,
            int remainingBrokerBatches,
            boolean allowToolCalls,
            boolean hasBusinessLedger,
            Map<String, JsonNode> evidenceRegistry
    ) {
        CompletableFuture<HttpResponse<byte[]>> pending = null;
        try {
            int remainingMs = budgetInt(payload, "remainingMs", 20000);
            int remainingInputTokens = budgetInt(payload, "remainingInputTokens", 8000);
            int remainingOutputTokens = budgetInt(payload, "remainingOutputTokens", 2000);
            if (remainingMs <= 0) throw new AssistantFault(504, "DEADLINE_EXCEEDED");

            HttpRequest request = HttpRequest.newBuilder(config.endpoint)
                    .timeout(Duration.ofMillis(remainingMs))
                    .header("Authorization", "Bearer " + config.serviceToken)
                    .header("X-Request-ID", requestId)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(mapper.writeValueAsBytes(payload)))
                    .build();

            pending = http.sendAsync(request, info -> new LimitedBody());
            HttpResponse<byte[]> response = pending.get(remainingMs, TimeUnit.MILLISECONDS);
            if (response.statusCode() != 200) {
                throw mapUpstreamError(response.statusCode(), response.body());
            }

            JsonNode root = mapper.readTree(response.body());
            require(root.isObject());
            for (String key : List.of("requestId", "conversationId", "turnId")) {
                require(root.path(key).isTextual() && root.path(key).asText().equals(payload.get(key)));
            }

            String kind = root.path("kind").asText("");
            Usage usage = parseUsage(root.path("usage"), remainingToolCalls, remainingBrokerBatches, remainingInputTokens, remainingOutputTokens);

            if ("tool_calls".equals(kind)) {
                require(allowToolCalls && remainingBrokerBatches > 0 && remainingToolCalls > 0);
                exact(root, Set.of("requestId", "conversationId", "turnId", "kind", "continuationId", "toolCalls", "usage", "evidence"));
                String continuationId = requireUuid(root.path("continuationId"));
                empty(root.path("evidence"));
                List<ToolCall> calls = parseToolCalls(root.path("toolCalls"), allowedTools, Math.min(4, remainingToolCalls));
                return new TurnStep("tool_calls", continuationId, calls, null, usage);
            }

            if ("final".equals(kind)) {
                exact(root, Set.of("requestId", "conversationId", "turnId", "kind", "continuationId", "toolCalls", "final", "evidence", "usage"));
                require(root.path("continuationId").isNull());
                empty(root.path("toolCalls"));
                parseEvidence(root.path("evidence"), evidenceRegistry);
                Map<String, Object> finalData = parseFinal(root.path("final"), evidenceRegistry, hasBusinessLedger, allowToolCalls);
                return new TurnStep("final", null, List.of(), finalData, usage);
            }

            throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
        } catch (AssistantFault e) {
            throw e;
        } catch (TimeoutException e) {
            throw new AssistantFault(504, "DEADLINE_EXCEEDED");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssistantFault(502, "AI_UNREACHABLE");
        } catch (ExecutionException e) {
            if (e.getCause() instanceof HttpTimeoutException) throw new AssistantFault(504, "DEADLINE_EXCEEDED");
            if (e.getCause() instanceof java.io.IOException) throw new AssistantFault(502, "AI_UNREACHABLE");
            throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
        } catch (Exception e) {
            throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
        } finally {
            if (pending != null && !pending.isDone()) pending.cancel(true);
        }
    }

    private AssistantFault mapUpstreamError(int statusCode, byte[] body) {
        if (statusCode == 401) return new AssistantFault(502, "AI_AUTH_FAILED");
        if (statusCode == 504) return new AssistantFault(504, "DEADLINE_EXCEEDED");
        if (statusCode == 503) {
            String code = extractErrorCode(body);
            if ("DATA_UNAVAILABLE".equals(code)) return new AssistantFault(503, "DATA_UNAVAILABLE");
            if ("BUDGET_EXCEEDED".equals(code)) return new AssistantFault(503, "BUDGET_EXCEEDED");
            return new AssistantFault(503, "DEPENDENCY_UNAVAILABLE");
        }
        return new AssistantFault(502, "AI_PROTOCOL_ERROR");
    }

    private String extractErrorCode(byte[] body) {
        try {
            JsonNode node = mapper.readTree(body);
            JsonNode code = node.path("error").path("code");
            return code.isTextual() ? code.asText() : "";
        } catch (Exception ignored) {
            return "";
        }
    }

    private static int budgetInt(Map<String, Object> payload, String key, int fallback) {
        if (payload.get("budget") instanceof Map<?, ?> budget && budget.get(key) instanceof Number n) {
            return n.intValue();
        }
        return fallback;
    }

    private Usage parseUsage(JsonNode usage, int maxToolCalls, int maxBatches, int maxInput, int maxOutput) {
        exact(usage, Set.of("toolCallsUsed", "brokerBatchesUsed", "inputTokensUsed", "outputTokensUsed"));
        int toolCallsUsed = requireRangeInt(usage.path("toolCallsUsed"), 0, maxToolCalls);
        int brokerBatchesUsed = requireRangeInt(usage.path("brokerBatchesUsed"), 0, maxBatches);
        int inputTokensUsed = requireRangeInt(usage.path("inputTokensUsed"), 0, maxInput);
        int outputTokensUsed = requireRangeInt(usage.path("outputTokensUsed"), 0, maxOutput);
        return new Usage(toolCallsUsed, brokerBatchesUsed, inputTokensUsed, outputTokensUsed);
    }

    private List<ToolCall> parseToolCalls(JsonNode callsNode, Set<String> allowedTools, int maxCalls) {
        require(callsNode.isArray() && !callsNode.isEmpty() && callsNode.size() <= maxCalls);
        Set<String> seenIds = new HashSet<>();
        List<ToolCall> calls = new ArrayList<>(callsNode.size());
        for (JsonNode entry : callsNode) {
            exact(entry, Set.of("callId", "name", "arguments"));
            String callId = requireUuid(entry.path("callId"));
            require(seenIds.add(callId));
            String name = entry.path("name").asText("");
            require(entry.path("name").isTextual()
                    && AssistantToolBroker.SUPPORTED_BUSINESS_TOOLS.contains(name)
                    && allowedTools.contains(name));
            JsonNode args = entry.path("arguments");
            require(args.isObject());
            calls.add(new ToolCall(callId, name, args));
        }
        return Collections.unmodifiableList(calls);
    }

    private void parseEvidence(JsonNode evidence, Map<String, JsonNode> registry) {
        require(evidence.isArray() && evidence.size() <= 3);
        Set<String> fields = new HashSet<>(CITATION_FIELDS);
        fields.addAll(Set.of("excerpt", "corpusMode"));
        for (JsonNode entry : evidence) {
            exact(entry, fields);
            for (String key : fields) {
                require(entry.path(key).isTextual()
                        && !entry.path(key).asText().isBlank()
                        && entry.path(key).asText().length() <= (key.equals("excerpt") ? 2000 : 256));
            }
            require(entry.path("corpusMode").asText().equals(config.mode));
            require(registry.put(entry.path("citationId").asText(), entry) == null);
        }
    }

    private Map<String, Object> parseFinal(
            JsonNode data,
            Map<String, JsonNode> registry,
            boolean hasBusinessLedger,
            boolean d2Enabled
    ) {
        exact(data, Set.of("status", "answer", "missingFields", "citations", "cards", "actions", "corpusMode"));
        String status = data.path("status").asText("");
        if (d2Enabled || hasBusinessLedger) {
            require(FINAL_STATUSES.contains(status));
        } else {
            require(Set.of("answered", "insufficient_evidence", "capability_unavailable").contains(status));
        }
        require(data.path("answer").isTextual()
                && !data.path("answer").asText().isBlank()
                && data.path("answer").asText().length() <= 4000);
        require(data.path("corpusMode").asText().equals(config.mode));

        // Python must never supply forged cards; Spring populates cards strictly from its broker ledger.
        empty(data.path("cards"));

        JsonNode missingFields = data.path("missingFields");
        require(missingFields.isArray() && missingFields.size() <= 10);
        if (!"needs_clarification".equals(status)) {
            require(missingFields.isEmpty());
        } else {
            for (JsonNode field : missingFields) {
                require(field.isTextual() && !field.asText().isBlank() && field.asText().length() <= 64);
            }
        }

        JsonNode actions = data.path("actions");
        require(actions.isArray() && actions.size() <= 5);
        if (!d2Enabled && !hasBusinessLedger) {
            require(actions.isEmpty());
        } else {
            for (JsonNode action : actions) {
                exact(action, Set.of("type", "label", "targetId"));
                require(action.path("type").isTextual() && ACTION_TYPES.contains(action.path("type").asText()));
                require(action.path("label").isTextual()
                        && !action.path("label").asText().isBlank()
                        && action.path("label").asText().length() <= 120);
                require(action.path("targetId").isNull());
            }
        }

        JsonNode citations = data.path("citations");
        require(citations.isArray() && citations.size() <= 3);
        Set<String> seen = new HashSet<>();
        for (JsonNode citation : citations) {
            exact(citation, CITATION_FIELDS);
            String id = citation.path("citationId").asText();
            require(seen.add(id) && registry.containsKey(id));
            for (String key : CITATION_FIELDS) {
                require(citation.path(key).equals(registry.get(id).path(key)));
            }
        }
        // Answered turns must be backed either by verified document citations OR Spring's business tool ledger.
        require(!"answered".equals(status) || !seen.isEmpty() || hasBusinessLedger);
        return mapper.convertValue(data, new TypeReference<>() {});
    }

    private static int requireRangeInt(JsonNode node, int min, int max) {
        require(node.isIntegralNumber() && !node.isBoolean() && node.canConvertToInt());
        int value = node.intValue();
        require(value >= min && value <= max);
        return value;
    }

    private static String requireUuid(JsonNode node) {
        require(node.isTextual() && UUID_PATTERN.matcher(node.asText()).matches());
        return node.asText();
    }

    private static void require(boolean value) {
        if (!value) throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
    }

    private static void empty(JsonNode node) {
        require(node.isArray() && node.isEmpty());
    }

    private static void exact(JsonNode node, Set<String> expected) {
        Set<String> fields = new HashSet<>();
        node.fieldNames().forEachRemaining(fields::add);
        require(node.isObject() && fields.equals(expected));
    }

    private static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
        final CompletableFuture<byte[]> result = new CompletableFuture<>();
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        Flow.Subscription subscription;

        public CompletionStage<byte[]> getBody() {
            return result;
        }

        public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            subscription.request(1);
        }

        public void onNext(List<ByteBuffer> buffers) {
            for (ByteBuffer buffer : buffers) {
                if (bytes.size() + buffer.remaining() > 256 * 1024) {
                    subscription.cancel();
                    result.completeExceptionally(new IllegalStateException("Response limit"));
                    return;
                }
                byte[] part = new byte[buffer.remaining()];
                buffer.get(part);
                bytes.writeBytes(part);
            }
            subscription.request(1);
        }

        public void onError(Throwable error) {
            result.completeExceptionally(error);
        }

        public void onComplete() {
            result.complete(bytes.toByteArray());
        }
    }
}
