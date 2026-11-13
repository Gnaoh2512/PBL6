package com.example.pbl6.service.assistant;

import com.fasterxml.jackson.databind.*;
import org.springframework.stereotype.Component;
import java.io.ByteArrayOutputStream;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

@Component
public class AssistantClient {
    private final AssistantConfig config;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    public AssistantClient(AssistantConfig config) { this.config = config; }

    public Map<String, Object> turn(Map<String, Object> payload, String requestId) {
        CompletableFuture<HttpResponse<byte[]>> pending = null;
        try {
            int remainingMs = payload.get("budget") instanceof Map<?, ?> budget ? ((Number)budget.get("remainingMs")).intValue() : 20000;
            if (remainingMs <= 0) throw new AssistantFault(504, "DEADLINE_EXCEEDED");
            HttpRequest request = HttpRequest.newBuilder(config.endpoint).timeout(Duration.ofMillis(remainingMs))
                .header("Authorization", "Bearer " + config.serviceToken).header("X-Request-ID", requestId)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(mapper.writeValueAsBytes(payload))).build();
            pending = http.sendAsync(request, info -> new LimitedBody());
            HttpResponse<byte[]> response = pending.get(remainingMs, TimeUnit.MILLISECONDS);
            if (response.statusCode() != 200) {
                if (response.statusCode() == 401) throw new AssistantFault(502, "AI_AUTH_FAILED");
                if (response.statusCode() == 504) throw new AssistantFault(504, "DEADLINE_EXCEEDED");
                if (response.statusCode() == 503) throw new AssistantFault(503, "DEPENDENCY_UNAVAILABLE");
                throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
            }
            JsonNode root = mapper.readTree(response.body());
            exact(root, Set.of("requestId", "conversationId", "turnId", "kind", "continuationId", "toolCalls", "final", "evidence", "usage"));
            for (String key : List.of("requestId", "conversationId", "turnId"))
                require(root.path(key).asText().equals(payload.get(key)));
            require(root.path("kind").asText().equals("final") && root.path("continuationId").isNull());
            empty(root.path("toolCalls"));
            JsonNode evidence = root.path("evidence"); require(evidence.isArray() && evidence.size() <= 3);
            Map<String, JsonNode> registry = new HashMap<>();
            Set<String> citationFields = Set.of("citationId", "documentId", "version", "chunkId", "sectionId", "title", "sourceRef");
            for (JsonNode entry : evidence) {
                Set<String> fields = new HashSet<>(citationFields); fields.addAll(Set.of("excerpt", "corpusMode"));
                exact(entry, fields);
                for (String key : fields) require(entry.path(key).isTextual() && !entry.path(key).asText().isBlank()
                        && entry.path(key).asText().length() <= (key.equals("excerpt") ? 2000 : 256));
                require(entry.path("corpusMode").asText().equals(config.mode));
                require(registry.put(entry.path("citationId").asText(), entry) == null);
            }
            JsonNode data = root.path("final");
            exact(data, Set.of("status", "answer", "missingFields", "citations", "cards", "actions", "corpusMode"));
            require(Set.of("answered", "insufficient_evidence", "capability_unavailable").contains(data.path("status").asText()));
            require(data.path("answer").isTextual() && !data.path("answer").asText().isBlank() && data.path("answer").asText().length() <= 4000);
            require(data.path("corpusMode").asText().equals(config.mode));
            for (String key : List.of("missingFields", "cards", "actions")) empty(data.path(key));
            JsonNode citations = data.path("citations"); require(citations.isArray() && citations.size() <= 3);
            Set<String> seen = new HashSet<>();
            for (JsonNode citation : citations) {
                exact(citation, citationFields);
                String id = citation.path("citationId").asText();
                require(seen.add(id) && registry.containsKey(id));
                for (String key : citationFields) require(citation.path(key).equals(registry.get(id).path(key)));
            }
            require(!data.path("status").asText().equals("answered") || !seen.isEmpty());
            JsonNode usage = root.path("usage");
            exact(usage, Set.of("toolCallsUsed", "brokerBatchesUsed", "inputTokensUsed", "outputTokensUsed"));
            Map<String, Integer> maxima = Map.of("toolCallsUsed", 1, "brokerBatchesUsed", 0, "inputTokensUsed", 8000, "outputTokensUsed", 2000);
            for (var pair : maxima.entrySet()) require(usage.path(pair.getKey()).isIntegralNumber()
                    && usage.path(pair.getKey()).canConvertToInt() && usage.path(pair.getKey()).intValue() >= 0
                    && usage.path(pair.getKey()).intValue() <= pair.getValue());
            return mapper.convertValue(data, new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (AssistantFault e) { throw e;
        } catch (TimeoutException e) { throw new AssistantFault(504, "DEADLINE_EXCEEDED");
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new AssistantFault(502, "AI_UNREACHABLE");
        } catch (Exception e) { throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
        } finally { if (pending != null && !pending.isDone()) pending.cancel(true); }
    }
    private static void require(boolean value) { if (!value) throw new AssistantFault(502, "AI_PROTOCOL_ERROR"); }
    private static void empty(JsonNode node) { require(node.isArray() && node.isEmpty()); }
    private static void exact(JsonNode node, Set<String> expected) {
        Set<String> fields = new HashSet<>(); node.fieldNames().forEachRemaining(fields::add);
        require(node.isObject() && fields.equals(expected));
    }
    private static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
        final CompletableFuture<byte[]> result = new CompletableFuture<>();
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        Flow.Subscription subscription;
        public CompletionStage<byte[]> getBody() { return result; }
        public void onSubscribe(Flow.Subscription subscription) { this.subscription = subscription; subscription.request(1); }
        public void onNext(List<ByteBuffer> buffers) {
            for (ByteBuffer buffer : buffers) {
                if (bytes.size() + buffer.remaining() > 256 * 1024) {
                    subscription.cancel(); result.completeExceptionally(new IllegalStateException("Response limit")); return;
                }
                byte[] part = new byte[buffer.remaining()]; buffer.get(part); bytes.writeBytes(part);
            }
            subscription.request(1);
        }
        public void onError(Throwable error) { result.completeExceptionally(error); }
        public void onComplete() { result.complete(bytes.toByteArray()); }
    }
}
