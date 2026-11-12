import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Modal from "../components/Modal";
import { apiCall, formatVND, formatDate, formatDateTime, getAuthUser } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import "./GuestPages.css";

const BOOKING_STATUS_LABEL = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đang lưu trú",
  CHECKED_OUT: "Đã trả phòng",
  CANCELLED: "Đã hủy",
};

const STATUS_FILTER_OPTIONS = [{ value: "ALL", label: "Tất cả trạng thái" }, ...Object.entries(BOOKING_STATUS_LABEL).map(([value, label]) => ({ value, label }))];

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
    const matchStatus = statusFilter === "ALL" || (b.status || "PENDING") === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || `${b.bookingCode || ""} ${b.roomNumber || ""}`.toLowerCase().includes(query);
    return matchStatus && matchSearch;
  });

  const hasFilter = statusFilter !== "ALL" || searchQuery.trim() !== "";

  return (
    <>
      {!portal && <Navbar />}

      <PageShell portal={portal}>
        <div className="hc-page-title">
          <div>
            <h2>Lịch Sử Đặt Phòng</h2>
            <p>Kiểm tra trạng thái đặt phòng, xem chi tiết hóa đơn lưu trú và gọi dịch vụ cho từng đơn.</p>
          </div>

          <div className="guest-title-actions">
            <button type="button" className="hc-btn hc-btn-outline" onClick={handleRefresh} disabled={loading || (activeTab === "PHONE" && !phoneInput.trim())}>
              <i className="bi bi-arrow-clockwise"></i> Làm mới
            </button>
          </div>
        </div>

        {/* Lookup source */}
        {(authUser || activeTab === "PHONE") && (
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

        {/* Bookings */}
        <div className="hc-card guest-card">
          <div className="hc-card-header">
            <div className="guest-toolbar">
              <div className="guest-search">
                <i className="bi bi-search"></i>
                <input
                  type="text"
                  className="hc-input"
                  placeholder="Lọc theo mã đơn, số phòng..."
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

          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            {loading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="hc-empty-state">
                <i className="bi bi-inbox"></i>
                <p>{hasFilter ? "Không có đơn nào khớp với bộ lọc." : activeTab === "PHONE" ? 'Nhập số điện thoại và bấm "Tìm đơn" để xem các đơn đặt phòng.' : "Bạn chưa có đơn đặt phòng nào."}</p>
              </div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Phòng</th>
                    <th>Thời gian lưu trú</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr key={b.bookingCode || b.bookingId}>
                      <td>
                        <strong style={{ color: "var(--hc-primary)" }}>{b.bookingCode}</strong>
                        <div className="guest-cell-sub">Khách: {b.customerName || b.fullName}</div>
                      </td>
                      <td>
                        <strong>Phòng {b.roomNumber || "---"}</strong>
                        <div className="guest-cell-sub">{b.roomTypeName || ""}</div>
                      </td>
                      <td>
                        <div>
                          {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                        </div>
                        <div className="guest-cell-sub">{b.guestCount} khách</div>
                      </td>
                      <td>
                        <strong>{formatVND(b.totalAmount)}</strong>
                        {b.depositAmount > 0 && (
                          <div className="guest-cell-sub" style={{ color: "var(--hc-success)" }}>
                            Đã cọc: {formatVND(b.depositAmount)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`hc-badge hc-badge-booking-${b.status || "PENDING"}`}>{statusLabel(b.status)}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => openDetailModal(b.bookingCode)}>
                            <i className="bi bi-eye"></i> Chi tiết
                          </button>
                          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => navigate(`/services?bookingCode=${b.bookingCode}`)}>
                            <i className="bi bi-cup-hot"></i> Dịch vụ
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
        maxWidth="600px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setDetailModalOpen(false)}>
              Đóng
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={() => {
                setDetailModalOpen(false);
                navigate(`/services?bookingCode=${selectedBookingCode}`);
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
              <span className={`hc-badge hc-badge-booking-${bookingDetail.status || "PENDING"}`}>{statusLabel(bookingDetail.status)}</span>
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
                  <div style={{ fontWeight: 600 }}>{bookingDetail.phone || "---"}</div>
                </div>
                <div>
                  <span style={{ color: "var(--hc-text-secondary)", fontSize: "12px" }}>Phòng nghỉ</span>
                  <div style={{ fontWeight: 600 }}>
                    Phòng {bookingDetail.roomNumber} ({bookingDetail.roomTypeName})
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--hc-text-secondary)", fontSize: "12px" }}>Thời gian</span>
                  <div style={{ fontWeight: 600 }}>
                    {formatDate(bookingDetail.checkInDate)} → {formatDate(bookingDetail.checkOutDate)}
                  </div>
                </div>
              </div>
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
              {bookingDetail.depositAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--hc-success)" }}>
                  <span>Tiền cọc đã thanh toán</span>
                  <strong>- {formatVND(bookingDetail.depositAmount)}</strong>
                </div>
              )}
              <hr className="hc-divider" style={{ margin: "8px 0" }} />
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
