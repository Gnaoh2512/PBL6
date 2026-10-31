package com.example.pbl6.service;

import com.example.pbl6.dto.adminservice.ServiceRequest;
import com.example.pbl6.entity.Service;
import com.example.pbl6.entity.ServiceCategory;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.ServiceCategoryRepository;
import com.example.pbl6.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@org.springframework.stereotype.Service
@RequiredArgsConstructor
public class ServiceAdminServiceImpl implements ServiceAdminService {

    private final ServiceRepository serviceRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final AuditLogService auditLogService;

    private ServiceCategory resolveCategory(ServiceRequest request) {
        if (request.getCategoryId() != null) {
            return serviceCategoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("ServiceCategory", "id", request.getCategoryId()));
        }

        if (request.getCategory() != null) {
            if (request.getCategory() instanceof Number) {
                int catId = ((Number) request.getCategory()).intValue();
                return serviceCategoryRepository.findById(catId)
                        .orElseThrow(() -> new ResourceNotFoundException("ServiceCategory", "id", catId));
            } else if (request.getCategory() instanceof String) {
                String catStr = ((String) request.getCategory()).trim();
                if (!catStr.isEmpty() && !catStr.equalsIgnoreCase("Khác") && !catStr.equalsIgnoreCase("ALL")) {
                    return findOrCreateCategoryByName(catStr);
                }
            }
        }

        if (request.getCategoryName() != null) {
            String name = request.getCategoryName().trim();
            if (!name.isEmpty() && !name.equalsIgnoreCase("Khác") && !name.equalsIgnoreCase("ALL")) {
                return findOrCreateCategoryByName(name);
            }
        }

        return serviceCategoryRepository.findAll().stream().findFirst().orElse(null);
    }

    private ServiceCategory findOrCreateCategoryByName(String catStr) {
        Optional<ServiceCategory> opt = serviceCategoryRepository.findByCategoryName(catStr);
        if (opt.isPresent()) {
            return opt.get();
        }
        for (ServiceCategory sc : serviceCategoryRepository.findAll()) {
            if (sc.getCategoryName() != null && sc.getCategoryName().trim().equalsIgnoreCase(catStr)) {
                return sc;
            }
        }
        ServiceCategory newCat = ServiceCategory.builder()
                .categoryName(catStr)
                .build();
        ServiceCategory savedCat = serviceCategoryRepository.save(newCat);
        auditLogService.log("DỊCH VỤ", "CREATE_CATEGORY", "service_category", Long.valueOf(savedCat.getCategoryId()),
                "Tạo mới danh mục dịch vụ: " + savedCat.getCategoryName());
        return savedCat;
    }

    @Override
    @Transactional
    public Service createService(ServiceRequest request) {
        ServiceCategory category = resolveCategory(request);

        Service service = Service.builder()
                .category(category)
                .serviceName(request.getServiceName())
                .unitPrice(request.getUnitPrice())
                .unit(request.getUnit() != null ? request.getUnit() : "Lần")
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        Service saved = serviceRepository.save(service);

        auditLogService.log("DỊCH VỤ", "CREATE", "service", Long.valueOf(saved.getServiceId()),
                "Tạo mới dịch vụ: " + saved.getServiceName() + " (" + (category != null ? category.getCategoryName() : "Không danh mục") +
                        ", Đơn giá: " + saved.getUnitPrice() + " VNĐ/" + saved.getUnit() + ")");

        return saved;
    }

    @Override
    @Transactional
    public Service updateService(Integer id, ServiceRequest request) {
        Service service = serviceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Service", "id", id));

        boolean categorySpecified = request.getCategoryId() != null
                || request.getCategoryName() != null
                || request.getCategory() != null;

        if (categorySpecified) {
            ServiceCategory category = resolveCategory(request);
            service.setCategory(category);
        }

        if (request.getServiceName() != null && !request.getServiceName().isBlank()) {
            service.setServiceName(request.getServiceName());
        }
        if (request.getUnitPrice() != null) {
            service.setUnitPrice(request.getUnitPrice());
        }
        if (request.getUnit() != null) {
            service.setUnit(request.getUnit());
        }
        if (request.getIsActive() != null) {
            service.setIsActive(request.getIsActive());
        }

        Service updated = serviceRepository.save(service);

        auditLogService.log("DỊCH VỤ", "UPDATE", "service", Long.valueOf(updated.getServiceId()),
                "Cập nhật dịch vụ: " + updated.getServiceName() + " [Trạng thái: " + (Boolean.TRUE.equals(updated.getIsActive()) ? "Sẵn sàng" : "Tạm ngưng") +
                        ", Đơn giá: " + updated.getUnitPrice() + " VNĐ]");

        return updated;
    }

    @Override
    @Transactional
    public Service toggleServiceStatus(Integer id) {
        Service service = serviceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Service", "id", id));

        boolean current = service.getIsActive() != null ? service.getIsActive() : true;
        service.setIsActive(!current);
        Service updated = serviceRepository.save(service);

        auditLogService.log("DỊCH VỤ", Boolean.TRUE.equals(updated.getIsActive()) ? "ACTIVATE" : "DEACTIVATE",
                "service", Long.valueOf(updated.getServiceId()),
                (Boolean.TRUE.equals(updated.getIsActive()) ? "Bật cho phép gọi" : "Tắt cho phép gọi") + " dịch vụ " + updated.getServiceName());

        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Service> getAllServices() {
        return serviceRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ServiceCategory> getAllCategories() {
        return serviceCategoryRepository.findAll();
    }
}
