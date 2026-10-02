package com.example.pbl6.dto.booking;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalkInBookingRequest {

    @NotNull(message = "ID phòng không được để trống")
    private Integer roomId;

    @NotNull(message = "Ngày nhận phòng không được để trống")
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate checkInDate;

    @NotNull(message = "Ngày trả phòng không được để trống")
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate checkOutDate;

    @NotNull(message = "Số lượng khách không được để trống")
    @Min(value = 1, message = "Số lượng khách tối thiểu là 1")
    private Integer guestCount;

    @NotBlank(message = "Họ và tên khách hàng không được để trống")
    @Size(max = 100, message = "Họ và tên không được vượt quá 100 ký tự")
    private String fullName;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Size(max = 20, message = "Số điện thoại không hợp lệ")
    private String phone;

    @Email(message = "Email không đúng định dạng")
    private String email;

    @Builder.Default
    private String idType = "CCCD";

    private String idNumber;

    @Builder.Default
    private String nationality = "Vietnam";

    private String note;

    private String voucherCode;

    // Các trường thanh toán & tiếp nhận tại quầy
    @Builder.Default
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Builder.Default
    private String paymentMethod = "CASH"; // CASH hoặc BANK_TRANSFER

    @Builder.Default
    private Boolean checkInImmediately = true; // Mặc định khách tại quầy sẽ nhận phòng ngay
}
