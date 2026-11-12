import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiCall, formatDate, formatVND } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
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

export default function GuestDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [folio, setFolio] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

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
          const detail = await apiCall(`/api/customer/bookings/history/${encodeURIComponent(nextStay.bookingCode)}`, { silentError: true });
          if (active && detail?.success) setFolio(detail.data);
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
  const balance = folio?.remainingBalance ?? (nextStay ? Math.max(0, Number(nextStay.totalAmount || 0) - Number(nextStay.depositPaid || 0)) : 0);
  const activeRequests = requests.filter((request) => !["COMPLETED", "CANCELED", "CANCELLED"].includes(request.status));

  const servicesLink = nextStay ? `/guest/services?bookingCode=${encodeURIComponent(nextStay.bookingCode)}` : "/guest/services";
  const firstName = user?.fullName?.split(" ")[0] || user?.username || "bạn";

  return (
    <div className="ops-page guest-page">
      <div className="hc-page-title">
        <div>
          <h2>Chào {firstName}.</h2>
          <p>{nextStay ? "Kỳ nghỉ của bạn sắp bắt đầu. Dưới đây là thông tin đặt phòng và thanh toán." : "Mọi điều bạn cần cho một kỳ nghỉ trọn vẹn tại Azure Bay."}</p>
        </div>

        <div className="guest-title-actions">
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
          {/* Next stay */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-suitcase-lg text-primary"></i> Kỳ nghỉ sắp tới
                </div>
                {nextStay && <span className={`hc-badge hc-badge-booking-${nextStay.bookingStatus}`}>{STATUS_LABEL[nextStay.bookingStatus] || nextStay.bookingStatus}</span>}
              </div>
            </div>

            {nextStay ? (
              <div className="hc-card-body guest-stay">
                <img className="guest-stay-photo" src={resortRoomPhoto} alt="Phòng nghỉ tại Azure Bay" />
                <div className="guest-stay-info">
                  <div>
                    <h3 className="guest-stay-name">{nextStay.roomTypeName || "Kỳ nghỉ tại Azure Bay"}</h3>
                    <div className="guest-cell-sub" style={{ fontSize: "14px" }}>
                      Mã đặt phòng <strong style={{ color: "var(--hc-primary)" }}>{nextStay.bookingCode}</strong>
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
                      <span>Khách</span>
                      <b>{nextStay.guestCount || 1} người</b>
                      <small className="guest-cell-sub">{nextStay.nights || 1} đêm</small>
                    </div>
                  </div>

                  <div className="guest-row-actions">
                    <button type="button" className="hc-btn hc-btn-primary" onClick={() => navigate("/guest/bookings")}>
                      <i className="bi bi-eye"></i> Xem đặt phòng
                    </button>
                    <Link className="hc-btn hc-btn-outline" to={servicesLink}>
                      <i className="bi bi-receipt"></i> Dịch vụ &amp; hóa đơn
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hc-empty-state">
                <i className="bi bi-sun"></i>
                <p>Bạn chưa có kỳ nghỉ nào sắp tới. Chọn ngày lưu trú để xem các phòng còn trống.</p>
                <Link className="hc-btn hc-btn-primary" to="/booking" style={{ marginTop: "16px" }}>
                  <i className="bi bi-search"></i> Tìm phòng nghỉ
                </Link>
              </div>
            )}
          </div>

          <div className="guest-two-col">
            {/* Payment */}
            <div className="hc-card">
              <div className="hc-card-header">
                <div className="guest-toolbar">
                  <div className="guest-toolbar-title">
                    <i className="bi bi-wallet2 text-primary"></i> Thanh toán
                  </div>
                  {nextStay && (
                    <span className={`hc-badge ${nextStay.isPaidFull || folio?.isFullySettled ? "hc-badge-success" : "hc-badge-warning"}`}>
                      {nextStay.isPaidFull || folio?.isFullySettled ? "Đã thanh toán đầy đủ" : "Thanh toán khi nhận phòng"}
                    </span>
                  )}
                </div>
              </div>
              <div className="hc-card-body">
                {nextStay ? (
                  <>
                    <div className="guest-balance">
                      <span>Số tiền còn lại</span>
                      <b>{formatVND(balance)}</b>
                    </div>
                    <div className="guest-sum-row">
                      <span>Đã nhận tiền cọc</span>
                      <strong>{formatVND(nextStay.depositPaid || 0)}</strong>
                    </div>
                    <div className="guest-sum-row" style={{ borderBottom: 0 }}>
                      <span>Tổng kỳ nghỉ</span>
                      <strong>{formatVND(folio?.totalAmount ?? nextStay.totalAmount)}</strong>
                    </div>
                    <Link className="hc-btn hc-btn-outline hc-btn-sm" to={servicesLink} style={{ marginTop: "8px" }}>
                      <i className="bi bi-receipt"></i> Xem hóa đơn &amp; thanh toán
                    </Link>
                  </>
                ) : (
                  <div className="hc-empty-state" style={{ padding: "24px 0" }}>
                    <p>Chi tiết thanh toán sẽ xuất hiện sau khi bạn đặt phòng.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="hc-card">
              <div className="hc-card-header">
                <div className="guest-toolbar">
                  <div className="guest-toolbar-title">
                    <i className="bi bi-compass text-primary"></i> Truy cập nhanh
                  </div>
                </div>
              </div>
              <div className="hc-card-body flush">
                <Link className="guest-link-row" to={servicesLink}>
                  <span className="hc-stat-icon" style={TONE.primary}>
                    <i className="bi bi-stars"></i>
                  </span>
                  <div>
                    <b>Khám phá dịch vụ</b>
                    <small>Ẩm thực, spa và trải nghiệm đảo</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>
                <Link className="guest-link-row" to="/guest/bookings">
                  <span className="hc-stat-icon" style={TONE.info}>
                    <i className="bi bi-calendar2-check"></i>
                  </span>
                  <div>
                    <b>Quản lý đặt phòng</b>
                    <small>{bookings.length} đặt phòng trong tài khoản</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>
                <Link className="guest-link-row" to="/guest/loyalty">
                  <span className="hc-stat-icon" style={TONE.warning}>
                    <i className="bi bi-gem"></i>
                  </span>
                  <div>
                    <b>Azure Bay Privilege</b>
                    <small>{loyalty ? `${loyalty.currentScore || 0} điểm · ${loyalty.tierName || "Thành viên"}` : "Xem quyền lợi hội viên"}</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="hc-card">
            <div className="hc-card-body guest-note">
              <span className="hc-stat-icon" style={TONE.warning}>
                <i className="bi bi-chat-heart"></i>
              </span>
              <div>
                <b>Đội ngũ Azure Bay luôn sẵn sàng hỗ trợ</b>
                <p>{activeRequests.length ? `Bạn đang có ${activeRequests.length} yêu cầu dịch vụ cần xử lý.` : "Hãy liên hệ với chúng tôi nếu bạn cần hỗ trợ trong kỳ nghỉ."}</p>
              </div>
              <Link className="hc-btn hc-btn-outline" to={servicesLink}>
                Xem dịch vụ
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
