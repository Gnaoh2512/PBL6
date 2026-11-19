package com.example.pbl6.repository;

import com.example.pbl6.entity.RoomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;


@Repository
public interface RoomTypeRepository extends JpaRepository<RoomType, Integer> {
}
