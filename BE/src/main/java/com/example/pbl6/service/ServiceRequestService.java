package com.example.pbl6.service;

import com.example.pbl6.dto.servicerequest.CreateServiceRequestDto;
import com.example.pbl6.dto.servicerequest.ServiceRequestResponse;

import java.util.List;

public interface ServiceRequestService {
    ServiceRequestResponse createRequest(CreateServiceRequestDto dto, String username);
    List<ServiceRequestResponse> getMyRequests(String username);
    ServiceRequestResponse cancelRequest(Integer requestId, String username);
    List<ServiceRequestResponse> getAllRequests(String status);
    ServiceRequestResponse assignRequest(Integer requestId, String staffUsername);
    ServiceRequestResponse completeRequest(Integer requestId, String staffUsername);
}
