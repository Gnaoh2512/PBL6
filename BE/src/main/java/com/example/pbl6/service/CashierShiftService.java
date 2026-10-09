package com.example.pbl6.service;

import com.example.pbl6.dto.cashier.CashierShiftResponse;
import com.example.pbl6.dto.cashier.CloseCashierShiftRequest;
import com.example.pbl6.dto.cashier.OpenCashierShiftRequest;
import com.example.pbl6.security.CustomUserDetails;

public interface CashierShiftService {
    CashierShiftResponse openShift(CustomUserDetails userDetails, OpenCashierShiftRequest request);
    CashierShiftResponse closeShift(Integer cashierShiftId, CustomUserDetails userDetails, CloseCashierShiftRequest request);
    CashierShiftResponse getActiveShift(CustomUserDetails userDetails);
}