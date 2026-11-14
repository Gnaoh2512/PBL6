package com.example.pbl6.dto.customer;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerCreateRequest {

    @NotBlank(message = "Họ tên khách hàng không được để trống")
    private String fullName;

    @NotBlank(message = "Số điện thoại khách hàng không được để trống")
    private String phone;

    private String email;

    @Builder.Default
    private String idType = "CCCD";

    private String idNumber;

    private LocalDate idIssueDate;

    private String idIssuePlace;

    @Builder.Default
    private String nationality = "Việt Nam";

    private Integer accountId; // Optional (nullable for walk-in guest)
}
