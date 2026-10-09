package com.example.pbl6.service;

import com.example.pbl6.dto.adminservice.ServiceRequest;
import com.example.pbl6.entity.Service;
import com.example.pbl6.entity.ServiceCategory;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.ServiceCategoryRepository;
import com.example.pbl6.repository.ServiceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceAdminServiceTest {

    @Mock
    private ServiceRepository serviceRepository;

    @Mock
    private ServiceCategoryRepository serviceCategoryRepository;

    @InjectMocks
    private ServiceAdminServiceImpl serviceAdminService;

    private ServiceCategory mockCategory;
    private Service mockService;

    @BeforeEach
    void setUp() {
        mockCategory = ServiceCategory.builder().categoryId(1).categoryName("Laundry").build();
        mockService = Service.builder()
                .serviceId(5)
                .category(mockCategory)
                .serviceName("Shirt Pressing")
                .unitPrice(new BigDecimal("50000.00"))
                .unit("piece")
                .isActive(true)
                .build();
    }

    @Test
    void createService_Success() {
        ServiceRequest request = new ServiceRequest();
        request.setCategoryId(1);
        request.setServiceName("Shirt Pressing");
        request.setUnitPrice(new BigDecimal("50000.00"));
        request.setUnit("piece");

        when(serviceCategoryRepository.findById(1)).thenReturn(Optional.of(mockCategory));
        when(serviceRepository.save(any(Service.class))).thenReturn(mockService);

        Service result = serviceAdminService.createService(request);

        assertNotNull(result);
        assertEquals("Shirt Pressing", result.getServiceName());
        verify(serviceRepository, times(1)).save(any(Service.class));
    }

    @Test
    void createService_CategoryNotFound_ThrowsException() {
        ServiceRequest request = new ServiceRequest();
        request.setCategoryId(99);

        when(serviceCategoryRepository.findById(99)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> serviceAdminService.createService(request));
        verify(serviceRepository, never()).save(any(Service.class));
    }
}