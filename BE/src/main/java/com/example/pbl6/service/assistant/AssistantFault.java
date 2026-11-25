package com.example.pbl6.service.assistant;

public class AssistantFault extends RuntimeException {
    public final int status;
    public final String code;
    public AssistantFault(int status, String code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}
