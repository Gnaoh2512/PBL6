import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Modal from "../components/Modal";
import { apiCall, formatVND, formatDate, formatDateTime, getAuthUser } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import "./GuestPages.css";

const BOOKING_STATUS_LABEL = {
  PENDING: "Chờ xác nhận",
  PENDING_DEPOSIT: "Chờ cọc",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đang lưu trú",
  CHECKED_OUT: "Đã trả phòng",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
};

const getBookingStatus = (b) => b?.status || b?.bookingStatus || "PENDING";

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "CHECKED_IN", label: "Đang lưu trú" },
  { value: "CHECKED_OUT", label: "Đã trả phòng" },
  { value: "CANCELED", label: "Đã hủy" },
];

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

function PageShell({ portal, children }) {
  return portal ? (
    <div className="ops-page guest-page">{children}</div>
  ) : (
    <main className="hc-page">
      <div className="hc-container guest-page">{children}</div>
    </main>
  );
}

const statusLabel = (status) => BOOKING_STATUS_LABEL[status || "PENDING"] || status;

export default function HistoryPage({ portal = false }) {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const authUser = getAuthUser();

  const [activeTab, setActiveTab] = useState(authUser ? "MEMBER" : "PHONE");
  const [phoneInput, setPhoneInput] = useState(authUser?.phone || "");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters (applied to the loaded list)
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Folio Detail Modal
  const [selectedBookingCode, setSelectedBookingCode] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (authUser && activeTab === "MEMBER") {
      loadMemberHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadPhoneHistory = async () => {
    if (!phoneInput.trim()) {
      addToast("Vui lòng nhập số điện thoại để tra cứu!", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall(`/api/public/history/lookup?phone=${encodeURIComponent(phoneInput.trim())}`);
      if (res && res.success) {
        setBookings(res.data || []);
        if (res.data.length === 0) {
          addToast("Không tìm thấy đơn đặt phòng nào với số điện thoại này", "info");
        }
      } else {
        setBookings([]);
      }
    } catch (err) {
      setBookings([]);
      addToast(err.message || "Lỗi tra cứu đơn đặt phòng", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMemberHistory = async () => {
    setLoading(true);
    try {
      const res = await apiCall("/api/customer/bookings/history");
      if (res && res.success) {
        setBookings(res.data || []);
      } else {
        setBookings([]);
      }
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === "MEMBER") loadMemberHistory();
    else loadPhoneHistory();
  };

  const openDetailModal = async (code) => {
    setSelectedBookingCode(code);
    setDetailModalOpen(true);
    setLoadingDetail(true);

    try {
      let endpoint = "";
      if (activeTab === "MEMBER") {
        endpoint = `/api/customer/bookings/history/${code}`;
      } else {
        endpoint = `/api/public/history/lookup/${code}?phone=${encodeURIComponent(phoneInput.trim())}`;
      }

      const res = await apiCall(endpoint);
      if (res && res.success) {
        setBookingDetail(res.data);
      } else {
        setBookingDetail(null);
      }
    } catch (err) {
      setBookingDetail(null);
      addToast(err.message || "Không thể tải chi tiết đơn", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const currentStatus = getBookingStatus(b);
    const matchStatus = statusFilter === "ALL" || currentStatus === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchSearch =
      !query ||
      `${b.bookingCode || ""} ${b.roomNumber || ""} ${b.roomTypeName || ""} ${b.customerName || b.fullName || ""}`
        .toLowerCase()
        .includes(query);
    return matchStatus && matchSearch;
  });

  const hasFilter = statusFilter !== "ALL" || searchQuery.trim() !== "";

  // Stat calculations
  const totalCount = bookings.length;
  const inStayCount = bookings.filter((b) => getBookingStatus(b) === "CHECKED_IN").length;
  const confirmedCount = bookings.filter((b) => getBookingStatus(b) === "CONFIRMED").length;
  const completedCount = bookings.filter((b) => getBookingStatus(b) === "CHECKED_OUT").length;

  const navigateServices = (code) => {
    const target = portal ? `/guest/services?bookingCode=${encodeURIComponent(code)}` : `/services?bookingCode=${encodeURIComponent(code)}`;
    navigate(target);
  };

  return (
    <>
      {!portal && <Navbar />}

      <PageShell portal={portal}>
        {/* Header */}
        <div className="hc-page-title">
          <div>
            <h2>Lịch Sử Đặt Phòng</h2>
            <p>Kiểm tra trạng thái phòng nghỉ, theo dõi lịch trình nhận/trả phòng và xem hóa đơn chi tiết.</p>
          </div>

          <div className="guest-title-actions">
            <Link to="/booking" className="hc-btn hc-btn-primary">
              <i className="bi bi-calendar-plus"></i> Đặt thêm phòng
            </Link>
            <button
              type="button"
              className="hc-btn hc-btn-outline"
              onClick={handleRefresh}
              disabled={loading || (activeTab === "PHONE" && !phoneInput.trim())}
            >
              <i className="bi bi-arrow-clockwise"></i> Làm mới
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="guest-stats-grid">
          <div className="guest-stat-card">
            <div className="guest-stat-icon" style={TONE.primary}>
              <i className="bi bi-journal-check"></i>
            </div>
            <div className="guest-stat-content">
              <div className="guest-stat-val">{totalCount}</div>
              <div className="guest-stat-lbl">Tổng số đơn</div>
            </div>
          </div>

          <div className="guest-stat-card">
            <div className="guest-stat-icon" style={TONE.info}>
              <i className="bi bi-door-open"></i>
            </div>
            <div className="guest-stat-content">
              <div className="guest-stat-val">{inStayCount}</div>
              <div className="guest-stat-lbl">Đang lưu trú</div>
            </div>
          </div>

          <div className="guest-stat-card">
            <div className="guest-stat-icon" style={TONE.warning}>
              <i className="bi bi-calendar-heart"></i>
            </div>
            <div className="guest-stat-content">
              <div className="guest-stat-val">{confirmedCount}</div>
              <div className="guest-stat-lbl">Đã xác nhận</div>
            </div>
          </div>

          <div className="guest-stat-card">
            <div className="guest-stat-icon" style={TONE.success}>
              <i className="bi bi-check-circle"></i>
            </div>
            <div className="guest-stat-content">
              <div className="guest-stat-val">{completedCount}</div>
              <div className="guest-stat-lbl">Đã hoàn tất</div>
            </div>
          </div>
        </div>

        {/* Lookup source (when outside portal or switching mode) */}
        {(!portal || activeTab === "PHONE") && (
          <div className="hc-card guest-card">
            <div className="hc-card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {authUser && (
                <div className="hc-tab-group" style={{ marginBottom: 0, alignSelf: "flex-start" }}>
                  <button type="button" className={`hc-tab-btn ${activeTab === "MEMBER" ? "active" : ""}`} onClick={() => setActiveTab("MEMBER")}>
                    <i className="bi bi-person-check"></i> Đơn của tôi ({authUser.username})
                  </button>
                  <button type="button" className={`hc-tab-btn ${activeTab === "PHONE" ? "active" : ""}`} onClick={() => setActiveTab("PHONE")}>
                    <i className="bi bi-telephone"></i> Tra cứu theo số điện thoại
                  </button>
                </div>
              )}

              {activeTab === "PHONE" && (
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div className="guest-search" style={{ flex: "1 1 320px", width: "auto" }}>
                    <i className="bi bi-telephone"></i>
                    <input
                      type="tel"
                      className="hc-input"
                      placeholder="Nhập số điện thoại đã dùng khi đặt phòng..."
                      aria-label="Số điện thoại tra cứu"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") loadPhoneHistory();
                      }}
                    />
                  </div>
                  <button type="button" className="hc-btn hc-btn-primary" onClick={loadPhoneHistory} disabled={loading}>
                    <i className="bi bi-search"></i> {loading ? "Đang tra cứu..." : "Tìm đơn"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bookings Card */}
        <div className="hc-card guest-card">
          <div className="hc-card-header">
            <div className="guest-toolbar">
              <div className="guest-toolbar-title">
                <i className="bi bi-list-check text-primary"></i> Danh sách đơn đặt phòng
                {filteredBookings.length > 0 && (
                  <span className="hc-badge hc-badge-primary" style={{ marginLeft: "6px", fontSize: "11px" }}>
                    {filteredBookings.length} đơn
                  </span>
                )}
              </div>

              <div className="guest-toolbar-controls">
                <div className="guest-search">
                  <i className="bi bi-search"></i>
                  <input
                    type="text"
                    className="hc-input"
                    placeholder="Lọc theo mã đơn, số phòng, hạng phòng..."
                    aria-label="Lọc danh sách đơn"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select className="hc-select guest-select" aria-label="Lọc trạng thái đơn" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {STATUS_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            {loading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="hc-empty-state">
                <i className="bi bi-inbox"></i>
                <p>
                  {hasFilter
                    ? "Không tìm thấy đơn đặt phòng nào khớp với bộ lọc."
                    : activeTab === "PHONE"
                    ? 'Nhập số điện thoại và bấm "Tìm đơn" để xem các đơn đặt phòng.'
                    : "Bạn chưa có đơn đặt phòng nào. Hãy khám phá và đặt phòng nghỉ dưỡng tại Azure Bay ngay hôm nay!"}
                </p>
                {!hasFilter && (
                  <Link to="/booking" className="hc-btn hc-btn-primary" style={{ marginTop: "14px" }}>
                    <i className="bi bi-search"></i> Tìm phòng nghỉ
                  </Link>
                )}
              </div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Phòng nghỉ</th>
                    <th>Thời gian lưu trú</th>
                    <th>Tổng chi phí</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr
                      key={b.bookingCode || b.bookingId}
                      className="guest-booking-row"
                      onClick={() => openDetailModal(b.bookingCode)}
                      title="Nhấn để mở chi tiết lượt đặt phòng & dịch vụ đã sử dụng"
                    >
                      <td>
                        <strong style={{ color: "var(--hc-primary)", fontSize: "14px" }}>{b.bookingCode}</strong>
                        <div className="guest-cell-sub">Khách: {b.customerName || b.fullName}</div>
                      </td>
                      <td>
                        <strong>{b.roomNumber ? `Phòng ${b.roomNumber}` : "Đang bố trí"}</strong>
                        <div className="guest-cell-sub">{b.roomTypeName || "Hạng tiêu chuẩn"}</div>
                      </td>
                      <td>
                        <div>
                          {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                        </div>
                        <div className="guest-cell-sub">
                          {b.nights ? `${b.nights} đêm` : ""} {b.guestCount ? `· ${b.guestCount} khách` : ""}
                        </div>
                      </td>
                      <td>
                        <strong style={{ fontSize: "14px" }}>{formatVND(b.totalAmount)}</strong>
                        {Number(b.depositPaid ?? b.depositAmount ?? b.depositApplied ?? 0) > 0 && (
                          <div className="guest-cell-sub" style={{ color: "var(--hc-success)" }}>
                            Đã cọc: {formatVND(b.depositPaid ?? b.depositAmount ?? b.depositApplied ?? 0)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`hc-badge hc-badge-booking-${getBookingStatus(b)}`}>
                          {statusLabel(getBookingStatus(b))}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetailModal(b.bookingCode);
                            }}
                            title="Xem chi tiết đơn đặt phòng & dịch vụ đã sử dụng"
                          >
                            <i className="bi bi-eye"></i> Chi tiết
                          </button>
                          <button
                            type="button"
                            className="hc-btn hc-btn-primary hc-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateServices(b.bookingCode);
                            }}
                            title="Mở hóa đơn & gọi dịch vụ"
                          >
                            <i className="bi bi-receipt"></i> Mở hóa đơn &amp; dịch vụ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </PageShell>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Chi Tiết Đơn Đặt Phòng #${selectedBookingCode}`}
        maxWidth="660px"
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%", flexWrap: "wrap" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setDetailModalOpen(false)}>
              Đóng
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={() => {
                setDetailModalOpen(false);
                navigateServices(selectedBookingCode);
              }}
            >
              <i className="bi bi-receipt"></i> Mở hóa đơn &amp; dịch vụ
            </button>
          </div>
        }
      >
        {loadingDetail ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : !bookingDetail ? (
          <div className="hc-empty-state">
            <i className="bi bi-receipt-cutoff"></i>
            <p>Không thể tải chi tiết đơn này.</p>
          </div>
        ) : (
          <div style={{ fontSize: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              <span className={`hc-badge hc-badge-booking-${getBookingStatus(bookingDetail)}`}>
                {statusLabel(getBookingStatus(bookingDetail))}
              </span>
              <span style={{ color: "var(--hc-text-muted)", fontSize: "12px" }}>Tạo lúc: {formatDateTime(bookingDetail.createdAt)}</span>
            </div>

            <div style={{ background: "var(--hc-bg)", padding: "16px", borderRadius: "var(--hc-radius-md)", marginBottom: "16px", border: "1px solid var(--hc-border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                <div>
                  <span style={{ color: "var(--hc-text-secondary)", fontSize: "12px" }}>Khách hàng</span>
                  <div style={{ fontWeight: 600 }}>{bookingDetail.customerName || bookingDetail.fullName}</div>
                </div>
                <div>
                  <span style={{ color: "var(--hc-text-secondary)", fontSize: "12px" }}>Số điện thoại</span>
                  <div style={{ fontWeight: 600 }}>{bookingDetail.customerPhone || bookingDetail.phone || "—"}</div>
                </div>
                <div>
                  <span style={{ color: "var(--hc-text-secondary)", fontSize: "12px" }}>Phòng nghỉ</span>
                  <div style={{ fontWeight: 600 }}>
                    {bookingDetail.roomNumber ? `Phòng ${bookingDetail.roomNumber}` : "Đang xếp phòng"} ({bookingDetail.roomTypeName || "Tiêu chuẩn"})
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--hc-text-secondary)", fontSize: "12px" }}>Thời gian lưu trú</span>
                  <div style={{ fontWeight: 600 }}>
                    {formatDate(bookingDetail.checkInDate)} → {formatDate(bookingDetail.checkOutDate)}
                  </div>
                </div>
              </div>
            </div>

            {/* Chi tiết dịch vụ đã sử dụng trong kỳ */}
            <div style={{ borderTop: "1px solid var(--hc-border-light)", paddingTop: "14px", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--hc-primary-dark)" }}>
                  <i className="bi bi-stars" style={{ marginRight: "6px" }}></i>
                  Dịch vụ đã đăng ký &amp; sử dụng ({bookingDetail.servicesUsed ? bookingDetail.servicesUsed.length : 0})
                </span>
                <div className="svc-lifecycle-stepper" style={{ margin: 0, padding: "2px 8px" }}>
                  <span className="svc-step-node is-pending" style={{ fontSize: "9px", padding: "1px 5px" }}>PENDING</span>
                  <i className="bi bi-arrow-right svc-step-arrow"></i>
                  <span className="svc-step-node is-delivering" style={{ fontSize: "9px", padding: "1px 5px" }}>DELIVERING</span>
                  <i className="bi bi-arrow-right svc-step-arrow"></i>
                  <span className="svc-step-node is-completed" style={{ fontSize: "9px", padding: "1px 5px" }}>COMPLETED</span>
                </div>
              </div>

              {bookingDetail.servicesUsed && bookingDetail.servicesUsed.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table className="hc-table" style={{ fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>Dịch vụ</th>
                        <th style={{ textAlign: "center" }}>Trạng thái</th>
                        <th style={{ textAlign: "center" }}>SL</th>
                        <th style={{ textAlign: "right" }}>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingDetail.servicesUsed.map((u, idx) => (
                        <tr key={u.usageId || idx}>
                          <td>
                            <strong>{u.serviceName}</strong>
                            <div className="guest-cell-sub">
                              {u.categoryName && <span>{u.categoryName} · </span>}
                              {formatDateTime(u.usedAt || u.orderTime)}
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {renderServiceStatusBadge(u.status)}
                          </td>
                          <td style={{ textAlign: "center" }}>{u.quantity}</td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {u.status === "CANCELED" || u.status === "CANCELLED" ? (
                              <span style={{ textDecoration: "line-through", color: "var(--hc-text-muted)" }}>
                                {formatVND(u.totalAmount || u.totalPrice)}
                              </span>
                            ) : (
                              formatVND(u.totalAmount || u.totalPrice)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ background: "var(--hc-bg)", padding: "16px", borderRadius: "var(--hc-radius-md)", textAlign: "center", border: "1px dashed var(--hc-border)" }}>
                  <p style={{ color: "var(--hc-text-secondary)", margin: 0, fontSize: "13px" }}>
                    Chưa có dịch vụ nào được đăng ký trong lần đặt phòng này.
                  </p>
                  {(getBookingStatus(bookingDetail) === "CHECKED_IN" || getBookingStatus(bookingDetail) === "CONFIRMED") && (
                    <button
                      type="button"
                      className="hc-btn hc-btn-outline hc-btn-sm"
                      style={{ marginTop: "10px" }}
                      onClick={() => {
                        setDetailModalOpen(false);
                        navigateServices(selectedBookingCode);
                      }}
                    >
                      <i className="bi bi-plus-circle"></i> Gọi dịch vụ lên phòng ngay
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--hc-border-light)", paddingTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "var(--hc-text-secondary)" }}>Tiền phòng</span>
                <strong>{formatVND(bookingDetail.roomCharge || bookingDetail.totalAmount)}</strong>
              </div>
              {bookingDetail.serviceCharge > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "var(--hc-text-secondary)" }}>Dịch vụ phát sinh</span>
                  <strong>{formatVND(bookingDetail.serviceCharge)}</strong>
                </div>
              )}
              {Number(bookingDetail.depositPaid ?? bookingDetail.depositAmount ?? bookingDetail.depositApplied ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--hc-success)" }}>
                  <span>Tiền cọc đã thanh toán</span>
                  <strong>- {formatVND(bookingDetail.depositPaid ?? bookingDetail.depositAmount ?? bookingDetail.depositApplied ?? 0)}</strong>
                </div>
              )}
              <hr className="hc-divider" style={{ margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "16px" }}>
                <span>Tổng chi phí</span>
                <span style={{ color: "var(--hc-primary)" }}>{formatVND(bookingDetail.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {!portal && <Footer />}
    </>
  );
}
