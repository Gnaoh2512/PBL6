package com.example.pbl6.dto.booking;

import com.example.pbl6.dto.room.RoomTypeResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingDetailResponse {
    private Integer bookingId;
    private String bookingCode;
    private String status; // PENDING_DEPOSIT, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELED, EXPIRED

    // Thông tin khách hàng
    private Integer customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String idNumber;

    // Thông tin phòng
    private Integer roomId;
    private String roomNumber;
    private Integer floor;
    private RoomTypeResponse roomType;

    // Chi tiết ngày & khách
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private long nights;
    private Integer guestCount;
    private String note;

    // Thông tin tài chính
    private BigDecimal priceAppliedPerNight;
    private BigDecimal totalRoomCharge;
    private BigDecimal depositRequired;
    private BigDecimal depositPaid;

    // Mã VietQR chuyển khoản (nếu đang ở trạng thái PENDING_DEPOSIT)
    private BankTransferQrResponse qrInfo;

    private LocalDateTime createdAt;
    private LocalDateTime expiredAt;
}
