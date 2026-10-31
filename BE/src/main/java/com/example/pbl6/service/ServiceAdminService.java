package com.example.pbl6.service;

import com.example.pbl6.dto.adminservice.ServiceRequest;
import com.example.pbl6.entity.Service;
import com.example.pbl6.entity.ServiceCategory;

import java.util.List;

public interface ServiceAdminService {
    Service createService(ServiceRequest request);
    Service updateService(Integer id, ServiceRequest request);
    List<Service> getAllServices();
    List<ServiceCategory> getAllCategories();
    Service toggleServiceStatus(Integer id);
}
