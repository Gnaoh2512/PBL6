package com.example.pbl6.repository;

import com.example.pbl6.entity.Service;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceRepository extends JpaRepository<Service, Integer> {
    List<Service> findByIsActiveTrue();
    List<Service> findByCategory_CategoryIdAndIsActiveTrue(Integer categoryId);
}
