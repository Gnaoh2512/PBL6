import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiCall, formatDate, formatVND } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import VietQrPaymentModal from "../components/VietQrPaymentModal";
import "./PortalPages.css";
import "./GuestPages.css";

const resortRoomPhoto = "https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85";
const stayStates = new Set(["CONFIRMED", "CHECKED_IN"]);

const STATUS_LABEL = {
  PENDING: "Chờ xác nhận",
  PENDING_DEPOSIT: "Chờ đặt cọc",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đang lưu trú",
  CHECKED_OUT: "Đã trả phòng",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
};

const TONE = {
  primary: { background: "var(--hc-primary-subtle)", color: "var(--hc-primary)" },
  info: { background: "var(--hc-info-bg)", color: "var(--hc-info)" },
  success: { background: "var(--hc-success-bg)", color: "var(--hc-success)" },
  warning: { background: "var(--hc-warning-bg)", color: "var(--hc-warning)" },
};

const renderServiceStatusBadge = (status) => {
  const norm = (status || "PENDING").toUpperCase();
  if (norm === "DELIVERING" || norm === "IN_PROGRESS" || norm === "DANG_GIAO") {
    return (
      <span className="hc-badge-service-delivering" title="Nhân viên đang giao dịch vụ lên phòng">
        <i className="bi bi-bicycle"></i> DELIVERING
      </span>
    );
  }
  if (norm === "COMPLETED" || norm === "SETTLED" || norm === "HOAN_THANH" || norm === "DONE") {
    return (
      <span className="hc-badge-service-completed" title="Dịch vụ đã hoàn tất phục vụ">
        <i className="bi bi-check-circle-fill"></i> COMPLETED
      </span>
    );
  }
  if (norm === "CANCELED" || norm === "CANCELLED") {
    return (
      <span className="hc-badge-service-canceled" title="Yêu cầu dịch vụ đã bị hủy">
        <i className="bi bi-x-circle"></i> CANCELED
      </span>
    );
  }
  return (
    <span className="hc-badge-service-pending" title="Đã tiếp nhận yêu cầu, nhân viên đang chuẩn bị">
      <i className="bi bi-clock-history"></i> PENDING
    </span>
  );
};

export default function GuestDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [folio, setFolio] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [qrModalOpen, setQrModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiCall("/api/customer/bookings/history", { silentError: true }),
      apiCall("/api/customer/loyalty/profile", { silentError: true }),
      apiCall("/api/customer/service-requests/my-requests", { silentError: true }),
    ]).then(async ([bookingsResult, loyaltyResult, requestsResult]) => {
      if (!active) return;
      const bookingList = bookingsResult.status === "fulfilled" && bookingsResult.value?.success ? bookingsResult.value.data || [] : [];
      setBookings(bookingList);
      setLoyalty(loyaltyResult.status === "fulfilled" && loyaltyResult.value?.success ? loyaltyResult.value.data : null);
      setRequests(requestsResult.status === "fulfilled" && requestsResult.value?.success ? requestsResult.value.data || [] : []);

      const nextStay = bookingList
        .filter((booking) => stayStates.has(booking.bookingStatus) && booking.checkOutDate >= today)
        .sort((a, b) => String(a.checkInDate).localeCompare(String(b.checkInDate)))[0];

      if (nextStay) {
        try {
          const billing = await apiCall(`/api/public/bookings/${encodeURIComponent(nextStay.bookingCode)}/folio`, { silentError: true });
          if (active && billing?.success) {
            setFolio(billing.data);
          } else {
            const detail = await apiCall(`/api/customer/bookings/history/${encodeURIComponent(nextStay.bookingCode)}`, { silentError: true });
            if (active && detail?.success) setFolio(detail.data);
          }
        } catch {
          /* booking summary still provides the trip details */
        }
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [today]);

  const nextStay =
    bookings.filter((booking) => stayStates.has(booking.bookingStatus) && booking.checkOutDate >= today).sort((a, b) => String(a.checkInDate).localeCompare(String(b.checkInDate)))[0] || null;
  const balance = folio?.remainingBalance ?? (nextStay ? Math.max(0, Number(nextStay.totalAmount || 0) - Number(nextStay.depositPaid ?? nextStay.depositAmount ?? nextStay.depositApplied ?? 0)) : 0);
  const activeRequests = requests.filter((request) => !["COMPLETED", "CANCELED", "CANCELLED"].includes(request.status));

  const servicesLink = nextStay ? `/guest/services?bookingCode=${encodeURIComponent(nextStay.bookingCode)}` : "/guest/services";
  const firstName = user?.fullName?.split(" ").pop() || user?.fullName || user?.username || "quý khách";

  return (
    <div className="ops-page guest-page">
      {/* Page Title */}
      <div className="hc-page-title">
        <div>
          <h2>Xin chào, {firstName}</h2>
          <p>{nextStay ? "Kỳ nghỉ của bạn sắp bắt đầu. Dưới đây là thông tin phòng nghỉ, dịch vụ và thanh toán." : "Chào mừng bạn quay trở lại với khu nghỉ dưỡng Azure Bay."}</p>
        </div>

        <div className="guest-title-actions">
          <Link className="hc-btn hc-btn-primary" to="/booking">
            <i className="bi bi-calendar-plus"></i> Đặt thêm phòng
          </Link>
          <Link className="hc-btn hc-btn-outline" to="/guest/bookings">
            <i className="bi bi-clock-history"></i> Lịch sử đặt phòng
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="hc-card">
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        </div>
      ) : (
        <div className="guest-stack">
          {/* Next Stay Card */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-suitcase-lg text-primary"></i> Kỳ nghỉ của bạn
                </div>
                {nextStay && <span className={`hc-badge hc-badge-booking-${nextStay.bookingStatus}`}>{STATUS_LABEL[nextStay.bookingStatus] || nextStay.bookingStatus}</span>}
              </div>
            </div>

            {nextStay ? (
              <div className="hc-card-body guest-stay">
                <div className="guest-stay-photo-wrap">
                  <img className="guest-stay-photo" src={resortRoomPhoto} alt="Phòng nghỉ tại Azure Bay" />
                  <span className="guest-stay-tag">Azure Bay Resort</span>
                </div>

                <div className="guest-stay-info">
                  <div className="guest-stay-header">
                    <div>
                      <h3 className="guest-stay-name">{nextStay.roomTypeName || "Kỳ nghỉ dưỡng cao cấp"}</h3>
                      <div className="guest-cell-sub">
                        Mã đặt phòng: <strong style={{ color: "var(--hc-primary)", fontSize: "14px" }}>{nextStay.bookingCode}</strong>
                        {nextStay.roomNumber && (
                          <span>
                            {" "}
                            · Số phòng: <strong>{nextStay.roomNumber}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="guest-facts">
                    <div>
                      <span>Nhận phòng</span>
                      <b>{formatDate(nextStay.checkInDate)}</b>
                      <small className="guest-cell-sub">Từ 14:00</small>
                    </div>
                    <div>
                      <span>Trả phòng</span>
                      <b>{formatDate(nextStay.checkOutDate)}</b>
                      <small className="guest-cell-sub">Trước 12:00</small>
                    </div>
                    <div>
                      <span>Số lượng khách</span>
                      <b>{nextStay.guestCount || 1} người</b>
                      <small className="guest-cell-sub">{nextStay.nights || 1} đêm lưu trú</small>
                    </div>
                  </div>

                  <div className="guest-row-actions">
                    <button type="button" className="hc-btn hc-btn-primary" onClick={() => navigate("/guest/bookings")}>
                      <i className="bi bi-eye"></i> Xem chi tiết đặt phòng
                    </button>
                    <Link className="hc-btn hc-btn-outline" to={servicesLink}>
                      <i className="bi bi-receipt"></i> Gọi dịch vụ &amp; Hóa đơn
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hc-empty-state">
                <i className="bi bi-sun"></i>
                <p>Bạn chưa có kỳ nghỉ nào sắp tới. Hãy chọn ngày lưu trú để khám phá những căn phòng tuyệt đẹp tại Azure Bay.</p>
                <Link className="hc-btn hc-btn-primary" to="/booking" style={{ marginTop: "16px" }}>
                  <i className="bi bi-search"></i> Khám phá &amp; Đặt phòng ngay
                </Link>
              </div>
            )}
          </div>

          {/* Two Columns: Payment & Quick Access */}
          <div className="guest-two-col">
            {/* Payment Summary */}
            <div className="hc-card">
              <div className="hc-card-header">
                <div className="guest-toolbar">
                  <div className="guest-toolbar-title">
                    <i className="bi bi-wallet2 text-primary"></i> Thanh toán &amp; Chi phí
                  </div>
                  {nextStay && (
                    <span className={`hc-badge ${nextStay.isPaidFull || folio?.isFullySettled ? "hc-badge-success" : "hc-badge-warning"}`}>
                      {nextStay.isPaidFull || folio?.isFullySettled ? "Đã thanh toán đủ" : "Thanh toán tại quầy"}
                    </span>
                  )}
                </div>
              </div>
              <div className="hc-card-body">
                {nextStay ? (
                  <>
                    <div className="guest-balance">
                      <div>
                        <div className="guest-balance-label">Số tiền còn lại</div>
                        <small style={{ fontSize: "12px", color: "var(--hc-text-muted)" }}>Cần thanh toán khi làm thủ tục</small>
                      </div>
                      <b>{formatVND(balance)}</b>
                    </div>
                    <div className="guest-sum-row">
                      <span>Tiền phòng</span>
                      <strong>{formatVND(folio?.roomCharge ?? nextStay.roomCharge ?? nextStay.totalAmount ?? 0)}</strong>
                    </div>
                    {Number(folio?.serviceCharge ?? 0) > 0 && (
                      <div className="guest-sum-row">
                        <span>Dịch vụ phát sinh</span>
                        <strong>{formatVND(folio.serviceCharge)}</strong>
                      </div>
                    )}
                    {Number(folio?.taxAmount ?? 0) > 0 && (
                      <div className="guest-sum-row">
                        <span>Thuế VAT</span>
                        <strong>{formatVND(folio.taxAmount)}</strong>
                      </div>
                    )}
                    {Number(folio?.discountAmount ?? 0) > 0 && (
                      <div className="guest-sum-row" style={{ color: "var(--hc-success)" }}>
                        <span>Giảm giá (hội viên / voucher)</span>
                        <strong>- {formatVND(folio.discountAmount)}</strong>
                      </div>
                    )}
                    <div className="guest-sum-row">
                      <span>Tiền cọc đã thanh toán</span>
                      <strong style={{ color: "var(--hc-success)" }}>{formatVND(folio?.depositPaid ?? nextStay.depositPaid ?? nextStay.depositAmount ?? nextStay.depositApplied ?? 0)}</strong>
                    </div>
                    <div className="guest-sum-row" style={{ borderBottom: 0 }}>
                      <span>Tổng chi phí dự kiến</span>
                      <strong>{formatVND(folio?.totalAmount ?? nextStay.totalAmount)}</strong>
                    </div>
                    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {balance > 0 && (
                        <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={() => setQrModalOpen(true)} style={{ width: "100%", justifyContent: "center" }}>
                          <i className="bi bi-qr-code-scan"></i> Thanh toán VietQR ({formatVND(balance)})
                        </button>
                      )}
                      <Link className="hc-btn hc-btn-outline hc-btn-sm" to={servicesLink} style={{ width: "100%", justifyContent: "center" }}>
                        <i className="bi bi-receipt"></i> Xem chi tiết bảng kê hóa đơn
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="hc-empty-state" style={{ padding: "28px 0" }}>
                    <p>Chi tiết thanh toán sẽ xuất hiện sau khi bạn đặt phòng.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Access Navigation */}
            <div className="hc-card">
              <div className="hc-card-header">
                <div className="guest-toolbar">
                  <div className="guest-toolbar-title">
                    <i className="bi bi-compass text-primary"></i> Dịch vụ &amp; Tiện ích
                  </div>
                </div>
              </div>
              <div className="hc-card-body flush">
                <Link className="guest-link-row" to={servicesLink}>
                  <div className="guest-stat-icon" style={TONE.primary}>
                    <i className="bi bi-stars"></i>
                  </div>
                  <div>
                    <b>Dịch vụ khách sạn &amp; Ẩm thực</b>
                    <small>Gọi món tại phòng, spa thư giãn và đồ uống</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>

                <Link className="guest-link-row" to="/guest/bookings">
                  <div className="guest-stat-icon" style={TONE.info}>
                    <i className="bi bi-calendar2-check"></i>
                  </div>
                  <div>
                    <b>Lịch sử đặt phòng</b>
                    <small>{bookings.length} đơn đặt phòng trong tài khoản</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>

                <Link className="guest-link-row" to="/guest/loyalty">
                  <div className="guest-stat-icon" style={TONE.warning}>
                    <i className="bi bi-gem"></i>
                  </div>
                  <div>
                    <b>Đặc quyền hội viên</b>
                    <small>{loyalty ? `${(loyalty.currentScore || 0).toLocaleString("vi-VN")} điểm · Hạng ${loyalty.tierName || "Thành viên"}` : "Xem quyền lợi & nâng hạng"}</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>

                <Link className="guest-link-row" to="/guest/profile">
                  <div className="guest-stat-icon" style={TONE.success}>
                    <i className="bi bi-person-circle"></i>
                  </div>
                  <div>
                    <b>Hồ sơ tài khoản</b>
                    <small>Thông tin cá nhân &amp; bảo mật đăng nhập</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>
              </div>
            </div>
          </div>

          {/* Active Service Requests & Status Tracking */}
          {requests.length > 0 && (
            <div className="hc-card">
              <div className="hc-card-header">
                <div className="guest-toolbar">
                  <div className="guest-toolbar-title">
                    <i className="bi bi-bell-fill text-primary"></i> Tiến độ phục vụ dịch vụ phòng
                    <span className="hc-badge hc-badge-primary" style={{ marginLeft: "8px", fontSize: "11px" }}>
                      {requests.length} yêu cầu
                    </span>
                  </div>
                  <div className="svc-lifecycle-stepper" style={{ margin: 0, padding: "3px 8px" }}>
                    <span className="svc-step-node is-pending" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      <i className="bi bi-clock-history"></i> PENDING
                    </span>
                    <i className="bi bi-arrow-right svc-step-arrow"></i>
                    <span className="svc-step-node is-delivering" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      <i className="bi bi-bicycle"></i> DELIVERING
                    </span>
                    <i className="bi bi-arrow-right svc-step-arrow"></i>
                    <span className="svc-step-node is-completed" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      <i className="bi bi-check2-circle"></i> COMPLETED
                    </span>
                  </div>
                </div>
              </div>
              <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>Dịch vụ yêu cầu</th>
                      <th>Phòng</th>
                      <th style={{ textAlign: "center" }}>Trạng thái</th>
                      <th>Thời gian yêu cầu</th>
                      <th style={{ textAlign: "right" }}>Chi phí</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 5).map((req) => (
                      <tr key={req.serviceRequestId}>
                        <td>
                          <strong>{req.serviceName}</strong>
                          {req.quantity > 1 && <span className="guest-cell-sub"> (x{req.quantity})</span>}
                          {req.note && <div className="guest-cell-sub">"{req.note}"</div>}
                        </td>
                        <td>{req.roomNumber ? `Phòng ${req.roomNumber}` : req.bookingCode || "—"}</td>
                        <td style={{ textAlign: "center" }}>{renderServiceStatusBadge(req.status)}</td>
                        <td>
                          {req.requestedAt
                            ? new Date(req.requestedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " " + new Date(req.requestedAt).toLocaleDateString("vi-VN")
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(req.feeAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Concierge & Support Note */}
          <div className="hc-card">
            <div className="hc-card-body guest-note">
              <div className="guest-stat-icon" style={TONE.warning}>
                <i className="bi bi-headset"></i>
              </div>
              <div>
                <b>Dịch vụ Lễ tân &amp; Chăm sóc khách hàng 24/7</b>
                <p>
                  {activeRequests.length
                    ? `Bạn đang có ${activeRequests.length} yêu cầu phục vụ đang được xử lý. Bấm để xem chi tiết.`
                    : "Đội ngũ phục vụ Azure Bay luôn sẵn sàng đáp ứng mọi nhu cầu của bạn trong suốt kỳ nghỉ."}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Link className="hc-btn hc-btn-outline hc-btn-sm" to={servicesLink}>
                  <i className="bi bi-cup-hot"></i> Gọi dịch vụ
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* VietQR Payment Pop-up with Polling & Auto-Redirect */}
      {nextStay && (
        <VietQrPaymentModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          bookingCode={nextStay.bookingCode}
          amount={nextStay.bookingStatus === "PENDING_DEPOSIT" ? nextStay.depositRequired || balance : balance}
          type={nextStay.bookingStatus === "PENDING_DEPOSIT" ? "DEPOSIT" : "SETTLEMENT"}
          title={nextStay.bookingStatus === "PENDING_DEPOSIT" ? "Thanh Toán Tiền Cọc Qua VietQR" : "Thanh Toán Chi Phí Qua VietQR"}
          redirectUrl={`/guest/services?bookingCode=${encodeURIComponent(nextStay.bookingCode)}`}
          onSuccess={() => {
            apiCall("/api/customer/bookings/history", { silentError: true }).then((res) => {
              if (res?.success && res.data) setBookings(res.data);
            });
          }}
        />
      )}
    </div>
  );
}
