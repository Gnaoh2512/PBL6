package com.example.pbl6.common.enums;

public enum InvoiceStatus {
    DRAFT,      // Hóa đơn mở / dự thảo (tạo khi nhận cọc thành công, cộng dồn chi phí khi ở)
    ISSUED,     // Đã xuất hóa đơn chính thức khi check-out (chờ thanh toán nốt)
    PAID,       // Đã hoàn tất thanh toán tất toán
    CANCELED    // Hóa đơn bị hủy
}
