package com.example.pbl6.dto.assistant;

import com.example.pbl6.service.assistant.AssistantFault;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/** The browser may provide only these three fields; identity always comes from Spring. */
public record ChatRequest(String conversationId, String clientMessageId, String message) {
    public static ChatRequest parse(JsonNode body) {
        if (body == null || !body.isObject()) throw invalid();
        Set<String> fields = new HashSet<>(); body.fieldNames().forEachRemaining(fields::add);
        if (!fields.equals(Set.of("conversationId", "clientMessageId", "message"))) throw invalid();
        String conversation = body.path("conversationId").isNull() ? null : uuid(body.path("conversationId"));
        String id = uuid(body.path("clientMessageId"));
        if (!body.path("message").isTextual()) throw invalid();
        String message = body.path("message").asText().strip();
        if (message.isEmpty() || message.length() > 2000) throw invalid();
        return new ChatRequest(conversation, id, message);
    }
    private static String uuid(JsonNode node) {
        if (!node.isTextual() || !node.asText().matches("[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}")) throw invalid();
        return UUID.fromString(node.asText()).toString();
    }
    private static AssistantFault invalid() { return new AssistantFault(422, "VALIDATION_ERROR"); }
}
