package com.example.pbl6.service;

import com.example.pbl6.dto.adminroom.RoomRequest;
import com.example.pbl6.dto.adminroom.RoomTypeRequest;
import com.example.pbl6.dto.booking.BookingDetailResponse;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.entity.Booking;
import com.example.pbl6.entity.BookingRoom;
import com.example.pbl6.entity.Customer;
import com.example.pbl6.entity.Room;
import com.example.pbl6.entity.RoomType;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.BookingRoomRepository;
import com.example.pbl6.repository.RoomRepository;
import com.example.pbl6.repository.RoomTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomAdminServiceImpl implements RoomAdminService {

    private final RoomRepository roomRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public RoomType createRoomType(RoomTypeRequest request) {
        RoomType roomType = RoomType.builder()
                .typeName(request.getTypeName())
                .capacity(request.getCapacity())
                .basePrice(request.getBasePrice())
                .amenities(request.getAmenities())
                .description(request.getDescription())
                .build();
        RoomType saved = roomTypeRepository.save(roomType);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "CREATE_ROOM_TYPE", "room_type", Long.valueOf(saved.getRoomTypeId()),
                "Tạo mới hạng phòng: " + saved.getTypeName() + " (Sức chứa: " + saved.getCapacity() + " người, Giá: " + saved.getBasePrice() + " VNĐ)");

        return saved;
    }

    @Override
    @Transactional
    public RoomType updateRoomType(Integer id, RoomTypeRequest request) {
        RoomType roomType = roomTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", id));

        roomType.setTypeName(request.getTypeName());
        roomType.setCapacity(request.getCapacity());
        roomType.setBasePrice(request.getBasePrice());
        roomType.setAmenities(request.getAmenities());
        roomType.setDescription(request.getDescription());

        RoomType updated = roomTypeRepository.save(roomType);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "UPDATE_ROOM_TYPE", "room_type", Long.valueOf(updated.getRoomTypeId()),
                "Cập nhật thông tin hạng phòng: " + updated.getTypeName() + " (Giá: " + updated.getBasePrice() + " VNĐ)");

        return updated;
    }

    @Override
    @Transactional
    public Room createRoom(RoomRequest request) {
        if (roomRepository.existsByRoomNumber(request.getRoomNumber())) {
            throw new IllegalArgumentException("Room number already exists: " + request.getRoomNumber());
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", request.getRoomTypeId()));

        Room room = Room.builder()
                .roomNumber(request.getRoomNumber())
                .roomType(roomType)
                .floor(request.getFloor())
                .status(request.getStatus() != null ? request.getStatus() : "AVAILABLE")
                .note(request.getNote())
                .build();

        Room saved = roomRepository.save(room);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "CREATE_ROOM", "room", Long.valueOf(saved.getRoomId()),
                "Thêm phòng mới: Phòng " + saved.getRoomNumber() + " (Tầng " + saved.getFloor() + ", Hạng: " + roomType.getTypeName() + ")");

        return saved;
    }

    @Override
    @Transactional
    public Room updateRoom(Integer id, RoomRequest request) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", id));

        if (!room.getRoomNumber().equals(request.getRoomNumber()) &&
                roomRepository.existsByRoomNumber(request.getRoomNumber())) {
            throw new IllegalArgumentException("Room number already exists: " + request.getRoomNumber());
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", "id", request.getRoomTypeId()));

        room.setRoomNumber(request.getRoomNumber());
        room.setRoomType(roomType);
        room.setFloor(request.getFloor());
        if (request.getStatus() != null) {
            room.setStatus(request.getStatus());
        }
        room.setNote(request.getNote());

        Room updated = roomRepository.save(room);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "UPDATE_ROOM", "room", Long.valueOf(updated.getRoomId()),
                "Cập nhật phòng " + updated.getRoomNumber() + " (Trạng thái: " + updated.getStatus() + ", Tầng: " + updated.getFloor() + ")");

        return updated;
    }

    @Override
    @Transactional
    public Room updateRoomStatus(Integer id, String status) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room", "id", id));
        String oldStatus = room.getStatus();
        room.setStatus(status);
        Room updated = roomRepository.save(room);

        auditLogService.log("PHÒNG & HẠNG PHÒNG", "STATUS_CHANGE", "room", Long.valueOf(updated.getRoomId()),
                oldStatus,
                "Đổi trạng thái phòng " + updated.getRoomNumber() + ": " + oldStatus + " ➔ " + status);

        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Room> getAllRooms() {
        return roomRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingDetailResponse> getRoomBookings(Integer roomId) {
        if (!roomRepository.existsById(roomId)) {
            throw new ResourceNotFoundException("Room", "id", roomId);
        }

        // Build a room-inspection response directly. Do not call the general booking
        // detail mapper here: it also loads service usages/requests and payment data,
        // none of which is needed to inspect the guests assigned to a room.
        return bookingRoomRepository.findByRoom_RoomId(roomId).stream()
                .filter(Objects::nonNull)
                .filter(bookingRoom -> bookingRoom.getBooking() != null)
                .map(this::toRoomBookingDetail)
                .sorted(Comparator.comparing(
                        BookingDetailResponse::getCheckInDate,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .collect(Collectors.toList());
    }

    private BookingDetailResponse toRoomBookingDetail(BookingRoom bookingRoom) {
        Booking booking = bookingRoom.getBooking();
        Room room = bookingRoom.getRoom();
        Customer customer = booking.getCustomer();

        long nights = booking.getCheckInDate() != null && booking.getCheckOutDate() != null
                ? ChronoUnit.DAYS.between(booking.getCheckInDate(), booking.getCheckOutDate())
                : 0L;
        BigDecimal pricePerNight = bookingRoom.getPriceApplied() != null
                ? bookingRoom.getPriceApplied()
                : (room != null && room.getRoomType() != null && room.getRoomType().getBasePrice() != null
                    ? room.getRoomType().getBasePrice() : BigDecimal.ZERO);

        return BookingDetailResponse.builder()
                .bookingId(booking.getBookingId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus())
                .customerId(customer != null ? customer.getCustomerId() : null)
                .customerName(customer != null ? customer.getFullName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .customerEmail(customer != null ? customer.getEmail() : null)
                .idNumber(customer != null ? customer.getIdNumber() : null)
                .roomId(room != null ? room.getRoomId() : null)
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .floor(room != null ? room.getFloor() : null)
                .roomType(room != null && room.getRoomType() != null
                        ? RoomTypeResponse.fromEntity(room.getRoomType()) : null)
                .checkInDate(booking.getCheckInDate())
                .checkOutDate(booking.getCheckOutDate())
                .nights(nights)
                .guestCount(booking.getGuestCount())
                .note(booking.getNote())
                .priceAppliedPerNight(pricePerNight)
                .totalRoomCharge(pricePerNight.multiply(BigDecimal.valueOf(nights)))
                .depositRequired(booking.getDepositRequired())
                .depositPaid(BigDecimal.ZERO)
                .createdAt(booking.getCreatedAt())
                .build();
    }
}