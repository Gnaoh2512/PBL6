package com.example.pbl6.service;

import com.example.pbl6.dto.adminservice.ServiceRequest;
import com.example.pbl6.entity.Service;

public interface ServiceAdminService {
    Service createService(ServiceRequest request);
    Service updateService(Integer id, ServiceRequest request);
}