package com.example.pbl6.service.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Bounded D2 turn orchestrator: drives start -> broker tool execution -> resume -> final,
 * tracks cumulative turn budgets & deadline, and assembles authoritative cards/actions
 * strictly from Spring's broker ledger.
 */
@Component
public class AssistantOrchestrator {
    private static final int TOTAL_DEADLINE_MS = 20000;
    private static final int MAX_INPUT_TOKENS = 8000;
    private static final int MAX_OUTPUT_TOKENS = 2000;
    private static final int MAX_CARDS = 10;

    private final AssistantConfig config;
    private final AssistantClient client;
    private final AssistantToolBroker broker;

    @Autowired
    public AssistantOrchestrator(AssistantConfig config, AssistantClient client, AssistantToolBroker broker) {
        this.config = config;
        this.client = client;
        this.broker = broker;
    }

    public Map<String, Object> executeTurn(
            String requestId,
            String conversationId,
            String turnId,
            String message,
            List<Map<String, String>> history,
            boolean isCustomer,
            long startedNanos
    ) {
        return executeTurn(requestId, conversationId, turnId, message, history, null, isCustomer, startedNanos);
    }

    public Map<String, Object> executeTurn(
            String requestId,
            String conversationId,
            String turnId,
            String message,
            List<Map<String, String>> history,
            String authenticatedUsername,
            boolean isCustomer,
            long startedNanos
    ) {
        boolean d2ToolsActive = config.businessToolsEnabled && broker != null;
        boolean d3BookingActive = d2ToolsActive && config.bookingToolsEnabled
                && isCustomer && authenticatedUsername != null && !authenticatedUsername.isBlank();
        List<String> allowedTools;
        if (d3BookingActive) {
            allowedTools = List.of("search_knowledge", "search_rooms", "list_services", "list_my_bookings", "get_my_booking");
        } else if (d2ToolsActive) {
            allowedTools = List.of("search_knowledge", "search_rooms", "list_services");
        } else {
            allowedTools = List.of("search_knowledge");
        }
        Set<String> allowedSet = Set.copyOf(allowedTools);

        int remainingToolCalls = d2ToolsActive ? 4 : 1;
        int remainingBrokerBatches = d2ToolsActive ? 2 : 0;
        int remainingInputTokens = MAX_INPUT_TOKENS;
        int remainingOutputTokens = MAX_OUTPUT_TOKENS;

        Map<String, JsonNode> evidenceRegistry = new HashMap<>();
        Set<String> seenCallIds = new HashSet<>();
        List<Map<String, Object>> ledgerCards = new ArrayList<>();
        boolean hasBusinessLedger = false;

        Map<String, Object> startPayload = new LinkedHashMap<>();
        startPayload.put("phase", "start");
        startPayload.put("requestId", requestId);
        startPayload.put("conversationId", conversationId);
        startPayload.put("turnId", turnId);
        startPayload.put("message", message);
        startPayload.put("history", history);
        startPayload.put("allowedTools", allowedTools);
        startPayload.put("context", Map.of(
                "locale", "vi-VN",
                "timeZone", AssistantToolBroker.HOTEL_ZONE.getId(),
                "today", LocalDate.now(AssistantToolBroker.HOTEL_ZONE).toString(),
                "currency", "VND"
        ));
        startPayload.put("budget", budgetMap(
                remainingToolCalls, remainingBrokerBatches, remainingMs(startedNanos),
                remainingInputTokens, remainingOutputTokens
        ));

        AssistantClient.TurnStep step = d2ToolsActive
                ? client.exchange(
                        startPayload, requestId, allowedSet,
                        remainingToolCalls, remainingBrokerBatches,
                        true, true, false, evidenceRegistry
                )
                : new AssistantClient.TurnStep("final", null, List.of(), client.turn(startPayload, requestId),
                        new AssistantClient.Usage(0, 0, 0, 0));

        remainingToolCalls -= step.usage().toolCallsUsed();
        remainingBrokerBatches -= step.usage().brokerBatchesUsed();
        remainingInputTokens -= step.usage().inputTokensUsed();
        remainingOutputTokens -= step.usage().outputTokensUsed();

        while (step.isToolCalls()) {
            if (!d2ToolsActive || remainingBrokerBatches < 1 || step.toolCalls().size() > remainingToolCalls) {
                throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
            }
            if (remainingMs(startedNanos) <= 0) {
                throw new AssistantFault(504, "DEADLINE_EXCEEDED");
            }

            List<Map<String, Object>> toolResults = new ArrayList<>(step.toolCalls().size());
            for (AssistantClient.ToolCall call : step.toolCalls()) {
                if (!seenCallIds.add(call.callId())) {
                    throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
                }
                AssistantToolBroker.Execution exec = broker.execute(
                        call.callId(), call.name(), call.arguments(), allowedSet,
                        authenticatedUsername, isCustomer
                );
                toolResults.add(exec.toolResult());
                if (exec.isOk()) {
                    hasBusinessLedger = true;
                    for (Map<String, Object> card : exec.cards()) {
                        if (ledgerCards.size() < MAX_CARDS) {
                            ledgerCards.add(card);
                        }
                    }
                }
            }

            remainingToolCalls -= step.toolCalls().size();
            remainingBrokerBatches -= 1;

            int leftMs = remainingMs(startedNanos);
            if (leftMs <= 0) {
                throw new AssistantFault(504, "DEADLINE_EXCEEDED");
            }

            Map<String, Object> resumePayload = new LinkedHashMap<>();
            resumePayload.put("phase", "resume");
            resumePayload.put("requestId", requestId);
            resumePayload.put("conversationId", conversationId);
            resumePayload.put("turnId", turnId);
            resumePayload.put("continuationId", step.continuationId());
            resumePayload.put("toolResults", toolResults);
            resumePayload.put("budget", budgetMap(
                    remainingToolCalls, remainingBrokerBatches, leftMs,
                    remainingInputTokens, remainingOutputTokens
            ));

            step = client.exchange(
                    resumePayload, requestId, allowedSet,
                    remainingToolCalls, remainingBrokerBatches,
                    d2ToolsActive, remainingBrokerBatches > 0, hasBusinessLedger, evidenceRegistry
            );

            remainingToolCalls -= step.usage().toolCallsUsed();
            remainingBrokerBatches -= step.usage().brokerBatchesUsed();
            remainingInputTokens -= step.usage().inputTokensUsed();
            remainingOutputTokens -= step.usage().outputTokensUsed();
        }

        if (elapsedMs(startedNanos) >= TOTAL_DEADLINE_MS) {
            throw new AssistantFault(504, "DEADLINE_EXCEEDED");
        }

        Map<String, Object> result = new LinkedHashMap<>(step.finalData());
        // Always replace cards with Spring's authoritative Turn Ledger cards.
        result.put("cards", List.copyOf(ledgerCards));
        result.put("actions", filterActions(result.get("actions"), isCustomer));
        return result;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> filterActions(Object rawActions, boolean isCustomer) {
        if (!(rawActions instanceof List<?> list) || list.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> safe = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) continue;
            Object typeObj = map.get("type");
            Object labelObj = map.get("label");
            if (!(typeObj instanceof String type) || !(labelObj instanceof String label)) continue;
            // /services is staff-only in App.jsx; only authenticated CUSTOMER can open /guest/services.
            if ("open_services".equals(type) && !isCustomer) continue;
            if (!Set.of("open_login", "open_room_search", "open_services").contains(type)) continue;
            if (seen.add(type)) {
                Map<String, Object> action = new LinkedHashMap<>();
                action.put("type", type);
                action.put("label", label);
                action.put("targetId", null);
                safe.add(Collections.unmodifiableMap(action));
            }
        }
        return Collections.unmodifiableList(safe);
    }

    private static Map<String, Object> budgetMap(
            int toolCalls, int batches, int remainingMs, int inputTokens, int outputTokens
    ) {
        return Map.of(
                "remainingToolCalls", Math.max(0, toolCalls),
                "remainingBrokerBatches", Math.max(0, batches),
                "remainingMs", Math.max(0, remainingMs),
                "remainingInputTokens", Math.max(0, inputTokens),
                "remainingOutputTokens", Math.max(0, outputTokens)
        );
    }

    private static long elapsedMs(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000L;
    }

    private static int remainingMs(long startedNanos) {
        return Math.max(0, (int) (TOTAL_DEADLINE_MS - elapsedMs(startedNanos)));
    }
}
