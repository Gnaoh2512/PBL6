package com.example.pbl6.service;

import com.example.pbl6.dto.room.AvailableRoomResponse;
import com.example.pbl6.dto.room.RoomSearchRequest;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.RoomType;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.RoomRepository;
import com.example.pbl6.repository.RoomTypeRepository;
import com.example.pbl6.service.financial.FinancialCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomCatalogServiceImpl implements RoomCatalogService {

    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;
    private final FinancialCalculator financialCalculator;

    @Value("${hotel.deposit-percentage:30}")
    private int depositPercentage;

    @Override
    @Transactional(readOnly = true)
    public List<RoomTypeResponse> getAllRoomTypes() {
        return roomTypeRepository.findAll().stream()
                .map(RoomTypeResponse::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RoomTypeResponse getRoomTypeById(Integer id) {
        RoomType roomType = roomTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy loại phòng với ID: " + id));
        return RoomTypeResponse.fromEntity(roomType);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AvailableRoomResponse> findAvailableRooms(RoomSearchRequest request) {
        LocalDate checkInDate = request.getCheckInDate();
        LocalDate checkOutDate = request.getCheckOutDate();

        if (checkInDate == null || checkOutDate == null) {
            throw new IllegalArgumentException("Ngày nhận phòng và ngày trả phòng không được để trống");
        }

        if (!checkOutDate.isAfter(checkInDate)) {
            throw new IllegalArgumentException("Ngày trả phòng phải sau ngày nhận phòng");
        }

        long nights = financialCalculator.calculateNights(checkInDate, checkOutDate);

        List<Room> rooms = roomRepository.findAvailableRooms(
                checkInDate,
                checkOutDate,
                request.getRoomTypeId(),
                request.getGuestCount(),
                request.getMinPrice(),
                request.getMaxPrice()
        );

        if ("PRICE_DESC".equalsIgnoreCase(request.getSortBy())) {
            rooms = rooms.stream()
                    .sorted((r1, r2) -> {
                        BigDecimal p1 = r1.getRoomType() != null && r1.getRoomType().getBasePrice() != null ? r1.getRoomType().getBasePrice() : BigDecimal.ZERO;
                        BigDecimal p2 = r2.getRoomType() != null && r2.getRoomType().getBasePrice() != null ? r2.getRoomType().getBasePrice() : BigDecimal.ZERO;
                        return p2.compareTo(p1);
                    })
                    .toList();
        } else if ("PRICE_ASC".equalsIgnoreCase(request.getSortBy())) {
            rooms = rooms.stream()
                    .sorted((r1, r2) -> {
                        BigDecimal p1 = r1.getRoomType() != null && r1.getRoomType().getBasePrice() != null ? r1.getRoomType().getBasePrice() : BigDecimal.ZERO;
                        BigDecimal p2 = r2.getRoomType() != null && r2.getRoomType().getBasePrice() != null ? r2.getRoomType().getBasePrice() : BigDecimal.ZERO;
                        return p1.compareTo(p2);
                    })
                    .toList();
        }

        return rooms.stream().map(room -> {
            BigDecimal pricePerNight = room.getRoomType() != null && room.getRoomType().getBasePrice() != null
                    ? room.getRoomType().getBasePrice()
                    : BigDecimal.ZERO;

            BigDecimal totalRoomCharge = financialCalculator.calculateTotalRoomCharge(pricePerNight, nights);
            BigDecimal estimatedDeposit = financialCalculator.calculateDeposit(totalRoomCharge, depositPercentage);

            return AvailableRoomResponse.fromEntity(
                    room,
                    checkInDate,
                    checkOutDate,
                    nights,
                    totalRoomCharge,
                    depositPercentage,
                    estimatedDeposit
            );
        }).toList();
    }
}
