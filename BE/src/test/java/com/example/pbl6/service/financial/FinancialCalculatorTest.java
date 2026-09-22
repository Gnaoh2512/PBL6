package com.example.pbl6.service.financial;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class FinancialCalculatorTest {

    private FinancialCalculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new FinancialCalculator();
    }

    @Test
    void calculateNights_NormalDates_ReturnsCorrectNights() {
        LocalDate checkIn = LocalDate.of(2026, 10, 1);
        LocalDate checkOut = LocalDate.of(2026, 10, 4);

        long nights = calculator.calculateNights(checkIn, checkOut);
        assertEquals(3, nights);
    }

    @Test
    void calculateNights_SameDay_ReturnsMinimumOneNight() {
        LocalDate checkIn = LocalDate.of(2026, 10, 1);
        LocalDate checkOut = LocalDate.of(2026, 10, 1);

        long nights = calculator.calculateNights(checkIn, checkOut);
        assertEquals(1, nights);
    }

    @Test
    void calculateTotalRoomCharge_ReturnsPriceMultipliedByNights() {
        BigDecimal pricePerNight = BigDecimal.valueOf(500000);
        long nights = 3;

        BigDecimal total = calculator.calculateTotalRoomCharge(pricePerNight, nights);
        assertEquals(new BigDecimal("1500000.00"), total);
    }

    @Test
    void calculateDeposit_30Percent_ReturnsCorrectDeposit() {
        BigDecimal total = BigDecimal.valueOf(1500000);

        BigDecimal deposit = calculator.calculateDeposit(total, 30);
        assertEquals(new BigDecimal("450000"), deposit);
    }

    @Test
    void calculateTax_10Percent_ReturnsCorrectTax() {
        BigDecimal subtotal = BigDecimal.valueOf(1000000);

        BigDecimal tax = calculator.calculateTax(subtotal);
        assertEquals(new BigDecimal("100000"), tax);
    }

    @Test
    void calculateFinalTotal_WithDeductions_ReturnsCorrectBalance() {
        BigDecimal subtotal = BigDecimal.valueOf(1500000);
        BigDecimal tax = BigDecimal.valueOf(150000);
        BigDecimal discount = BigDecimal.valueOf(50000);
        BigDecimal depositApplied = BigDecimal.valueOf(450000);

        // 1,500,000 + 150,000 - 50,000 - 450,000 = 1,150,000
        BigDecimal finalTotal = calculator.calculateFinalTotal(subtotal, tax, discount, depositApplied);
        assertEquals(BigDecimal.valueOf(1150000), finalTotal);
    }
}
