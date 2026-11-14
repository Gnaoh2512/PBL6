package com.example.pbl6.dto.customer;

import com.example.pbl6.entity.Customer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerResponse {
    private Integer customerId;
    private Integer accountId;
    private String username;
    private String fullName;
    private String phone;
    private String email;
    private String idType;
    private String idNumber;
    private LocalDate idIssueDate;
    private String idIssuePlace;
    private String nationality;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CustomerResponse fromEntity(Customer entity) {
        if (entity == null) {
            return null;
        }
        return CustomerResponse.builder()
                .customerId(entity.getCustomerId())
                .accountId(entity.getAccount() != null ? entity.getAccount().getAccountId() : null)
                .username(entity.getAccount() != null ? entity.getAccount().getUsername() : null)
                .fullName(entity.getFullName())
                .phone(entity.getPhone())
                .email(entity.getEmail())
                .idType(entity.getIdType())
                .idNumber(entity.getIdNumber())
                .idIssueDate(entity.getIdIssueDate())
                .idIssuePlace(entity.getIdIssuePlace())
                .nationality(entity.getNationality())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
