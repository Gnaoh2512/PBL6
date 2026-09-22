package com.example.pbl6.repository;

import com.example.pbl6.entity.ServiceCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ServiceCategoryRepository extends JpaRepository<ServiceCategory, Integer> {
    Optional<ServiceCategory> findByCategoryName(String categoryName);
}
