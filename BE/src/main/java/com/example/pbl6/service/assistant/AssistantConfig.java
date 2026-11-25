package com.example.pbl6.service.assistant;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class AssistantConfig {
    public final boolean enabled;
    public final boolean businessToolsEnabled;
    public final boolean bookingToolsEnabled;
    public final String mode;
    public final String serviceToken;
    public final URI endpoint;
    public final Set<String> origins;
    public final boolean secureCookie;

    public AssistantConfig(boolean enabled, String mode, String token, String url, String origins, Environment environment) {
        this(enabled, true, true, mode, token, url, origins, environment);
    }

    public AssistantConfig(boolean enabled, boolean businessToolsEnabled, String mode, String token, String url, String origins, Environment environment) {
        this(enabled, businessToolsEnabled, true, mode, token, url, origins, environment);
    }

    @Autowired
    public AssistantConfig(@Value("${assistant.enabled:false}") boolean enabled,
            @Value("${assistant.business-tools-enabled:true}") boolean businessToolsEnabled,
            @Value("${assistant.booking-tools-enabled:true}") boolean bookingToolsEnabled,
            @Value("${assistant.corpus-mode:production}") String mode,
            @Value("${assistant.service-token:}") String token,
            @Value("${assistant.url:http://127.0.0.1:8006}") String url,
            @Value("${assistant.origins:http://localhost:3000,http://127.0.0.1:3000,http://localhost:9090,http://127.0.0.1:9090}") String origins,
            Environment environment) {
        this.enabled = enabled; this.businessToolsEnabled = businessToolsEnabled; this.bookingToolsEnabled = bookingToolsEnabled; this.mode = mode; this.serviceToken = token;
        boolean local = environment.acceptsProfiles(Profiles.of("local"));
        this.secureCookie = !local;
        this.endpoint = URI.create(url + "/internal/assistant/turn");
        this.origins = Arrays.stream(origins.split(",")).map(String::trim).collect(Collectors.toUnmodifiableSet());
        if (enabled && (!Set.of("production", "demo_synthetic").contains(mode)
                || token.isBlank() || token.length() > 512 || !token.matches("[!-~]+")
                || endpoint.getUserInfo() != null || endpoint.getQuery() != null
                || !("https".equals(endpoint.getScheme()) || (local && "http".equals(endpoint.getScheme())
                     && Set.of("127.0.0.1", "localhost", "::1").contains(endpoint.getHost())))
                || (mode.equals("demo_synthetic") && !local))) {
            throw new IllegalArgumentException("Invalid assistant server configuration");
        }
    }
}
