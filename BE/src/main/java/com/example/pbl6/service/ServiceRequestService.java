package com.example.pbl6.service;

import com.example.pbl6.dto.servicerequest.CreateServiceRequestDto;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;

import java.util.List;

public interface ServiceRequestService {
    ServiceRequestResponse createRequest(CreateServiceRequestDto dto, String username);
    List<ServiceRequestResponse> getMyRequests(String username);
    ServiceRequestResponse cancelRequest(Integer requestId, String username);
    List<ServiceRequestResponse> getAllRequests(String status);
    /** ownOnly = true restricts the result to requests assigned to {@code actorUsername}. */
    List<ServiceRequestResponse> getAllRequests(String status, String actorUsername, boolean ownOnly);
    ServiceRequestResponse assignRequest(Integer requestId, String staffUsername);
    /** Service staff picks an unassigned PENDING request from the pool. */
    ServiceRequestResponse claimRequest(Integer requestId, String actorUsername);
    ServiceRequestResponse assignRequestToStaff(Integer requestId, Integer staffAccountId, String actorUsername);
    ServiceRequestResponse completeRequest(Integer requestId, String staffUsername);
    /** ownOnly = true only lets the assigned staff member complete the request. */
    ServiceRequestResponse completeRequest(Integer requestId, String staffUsername, boolean ownOnly);
}
