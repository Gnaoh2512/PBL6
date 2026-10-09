package com.example.pbl6.service;

import com.example.pbl6.dto.adminservice.ServiceRequest;
import com.example.pbl6.entity.Service;
import com.example.pbl6.entity.ServiceCategory;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.ServiceCategoryRepository;
import com.example.pbl6.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Service
@RequiredArgsConstructor
public class ServiceAdminServiceImpl implements ServiceAdminService {

    private final ServiceRepository serviceRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;

    @Override
    @Transactional
    public Service createService(ServiceRequest request) {
        ServiceCategory category = null;
        if (request.getCategoryId() != null) {
            category = serviceCategoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("ServiceCategory", "id", request.getCategoryId()));
        }

        Service service = Service.builder()
                .category(category)
                .serviceName(request.getServiceName())
                .unitPrice(request.getUnitPrice())
                .unit(request.getUnit())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        return serviceRepository.save(service);
    }

    @Override
    @Transactional
    public Service updateService(Integer id, ServiceRequest request) {
        Service service = serviceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Service", "id", id));

        ServiceCategory category = null;
        if (request.getCategoryId() != null) {
            category = serviceCategoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("ServiceCategory", "id", request.getCategoryId()));
        }

        service.setCategory(category);
        service.setServiceName(request.getServiceName());
        service.setUnitPrice(request.getUnitPrice());
        service.setUnit(request.getUnit());
        if (request.getIsActive() != null) {
            service.setIsActive(request.getIsActive());
        }

        return serviceRepository.save(service);
    }
}