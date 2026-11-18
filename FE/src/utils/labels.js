/**
 * Vietnamese display labels for every backend code (status, type, method…).
 * Screens must show these instead of the raw English / SNAKE_CASE value.
 */

// ── Service requests ──
export const SERVICE_STATUS_LABEL = {
  PENDING: "Chờ xử lý",
  DELIVERING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELED: "Đã hủy",
};

export const SERVICE_STATUS_BADGE = {
  PENDING: "hc-badge-service-pending",
  DELIVERING: "hc-badge-service-delivering",
  COMPLETED: "hc-badge-service-completed",
  CANCELED: "hc-badge-service-canceled",
};

export const SERVICE_STATUS_ICON = {
  PENDING: "bi-clock-history",
  DELIVERING: "bi-bicycle",
  COMPLETED: "bi-check-circle-fill",
  CANCELED: "bi-x-circle",
};

export const SERVICE_STATUS_HINT = {
  PENDING: "Đã tiếp nhận yêu cầu, nhân viên đang chuẩn bị",
  DELIVERING: "Nhân viên đang giao dịch vụ lên phòng",
  COMPLETED: "Dịch vụ đã hoàn tất phục vụ",
  CANCELED: "Yêu cầu dịch vụ đã bị hủy",
};

/** Maps every spelling the API may return onto PENDING / DELIVERING / COMPLETED / CANCELED. */
export function normalizeServiceStatus(status) {
  const norm = String(status || "PENDING").toUpperCase();
  if (["DELIVERING", "IN_PROGRESS", "DANG_GIAO"].includes(norm)) return "DELIVERING";
  if (["COMPLETED", "SETTLED", "HOAN_THANH", "DONE"].includes(norm)) return "COMPLETED";
  if (["CANCELED", "CANCELLED"].includes(norm)) return "CANCELED";
  return "PENDING"; // new order, waiting to be served, CHARGED_TO_ROOM…
}

export const serviceStatusLabel = (status) => SERVICE_STATUS_LABEL[normalizeServiceStatus(status)];

// ── Bookings ──
export const BOOKING_STATUS_LABEL = {
  PENDING: "Chờ xác nhận",
  PENDING_DEPOSIT: "Chờ đặt cọc",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đang lưu trú",
  CHECKED_OUT: "Đã trả phòng",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
  NO_SHOW: "Không đến",
};

export const bookingStatusLabel = (status) => BOOKING_STATUS_LABEL[String(status || "PENDING").toUpperCase()] || "Đang xử lý";

// ── Loyalty ──
export const LOYALTY_TXN_LABEL = {
  EARN: "Tích điểm",
  EARNED: "Tích điểm",
  ACCRUAL: "Tích điểm",
  BONUS: "Điểm thưởng",
  REDEEM: "Đổi điểm",
  REDEEMED: "Đổi điểm",
  SPEND: "Dùng điểm",
  ADJUST: "Điều chỉnh điểm",
  ADJUSTMENT: "Điều chỉnh điểm",
  EXPIRE: "Điểm hết hạn",
  EXPIRED: "Điểm hết hạn",
  REFUND: "Hoàn điểm",
  REVERSAL: "Hoàn điểm",
  TIER_UPGRADE: "Nâng hạng",
  TIER_DOWNGRADE: "Hạ hạng",
};
export const loyaltyTxnLabel = (type) => LOYALTY_TXN_LABEL[String(type || "").toUpperCase()] || "Giao dịch điểm";

export const BENEFIT_TYPE_LABEL = {
  DISCOUNT: "Giảm giá",
  DISCOUNT_PERCENT: "Giảm giá theo phần trăm",
  PERCENT_DISCOUNT: "Giảm giá theo phần trăm",
  FIXED_DISCOUNT: "Giảm giá cố định",
  FREE_SERVICE: "Dịch vụ miễn phí",
  FREE_NIGHT: "Tặng đêm nghỉ",
  ROOM_UPGRADE: "Nâng hạng phòng",
  UPGRADE: "Nâng hạng phòng",
  LATE_CHECKOUT: "Trả phòng muộn",
  EARLY_CHECKIN: "Nhận phòng sớm",
  BREAKFAST: "Bữa sáng miễn phí",
  SPA: "Ưu đãi spa",
  AIRPORT_TRANSFER: "Đưa đón sân bay",
  VOUCHER: "Mã ưu đãi",
};
export const benefitTypeLabel = (type) => BENEFIT_TYPE_LABEL[String(type || "").toUpperCase()] || "Ưu đãi hội viên";

// ── Payments (shown to staff and guests) ──
export const PAYMENT_METHOD_LABEL = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  TRANSFER: "Chuyển khoản",
  VIETQR: "VietQR",
  CARD: "Thẻ",
  CREDIT_CARD: "Thẻ tín dụng",
  MOMO: "Ví MoMo",
};
export const paymentMethodLabel = (method) => PAYMENT_METHOD_LABEL[String(method || "").toUpperCase()] || "Khác";
