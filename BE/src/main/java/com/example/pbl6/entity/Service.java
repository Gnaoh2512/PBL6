package com.example.pbl6.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "service")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Service {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "service_id")
    private Integer serviceId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "category_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ServiceCategory category;

    @Column(name = "service_name", nullable = false, length = 100)
    private String serviceName;

    @Column(name = "unit_price", precision = 15, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "unit", length = 50)
    private String unit;

    @Builder.Default
    @Column(name = "is_active")
    @JsonProperty("isActive")
    private Boolean isActive = true;

    @JsonProperty("active")
    public Boolean getActive() {
        return isActive != null ? isActive : true;
    }
}
