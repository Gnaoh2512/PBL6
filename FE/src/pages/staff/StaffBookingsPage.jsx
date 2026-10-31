import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatDate, formatVND } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";

const STATUS_META = {
  PENDING_DEPOSIT: { label: "Chờ đặt cọc", badge: "hc-badge-warning" },
  CONFIRMED: { label: "Đã xác nhận", badge: "hc-badge-success" },
  CHECKED_IN: { label: "Đang lưu trú", badge: "hc-badge-info" },
  CHECKED_OUT: { label: "Đã trả phòng", badge: "hc-badge-muted" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-error" },
  EXPIRED: { label: "Hết hạn", badge: "hc-badge-muted" },
};

const STATUS_OPTIONS = [{ value: "", label: "Tất cả trạng thái" }, ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))];

export default function StaffBookingsPage() {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");

  // Cancel-with-refund modal state
  const [refundModal, setRefundModal] = useState(null); // booking object
  const [refundNote, setRefundNote] = useState("");
  const [refundWorking, setRefundWorking] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (keyword.trim()) query.set("keyword", keyword.trim());
      if (status) query.set("status", status);
      const response = await apiCall(`/api/staff/bookings${query.size ? `?${query}` : ""}`, { silentError: true });
      setBookings(response?.success ? response.data || [] : []);
    } catch (error) {
      setBookings([]);
      addToast(error.message || "Không thể tải danh sách đặt phòng.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, keyword, status]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const updateBooking = async (booking, action) => {
    setWorking(`${booking.bookingCode}-${action}`);
    try {
      let body;
      if (action === "cancel") body = { reason: "Hủy theo thao tác của nhân viên." };
      const response = await apiCall(
        action === "check-in" ? `/api/staff/billing/bookings/${encodeURIComponent(booking.bookingCode)}/check-in` : `/api/staff/bookings/${encodeURIComponent(booking.bookingCode)}/${action}`,
        { method: "POST", body },
      );
      if (response?.success) {
        const messages = {
          "confirm-deposit": "Đã xác nhận tiền cọc.",
          cancel: "Đã hủy đặt phòng.",
          "check-in": "Check-in thành công! Phòng chuyển sang OCCUPIED.",
        };
        addToast(messages[action] || "Cập nhật thành công.", "success");
        await loadBookings();
      }
    } catch (error) {
      addToast(error.message || "Không thể cập nhật đặt phòng.", "error");
    } finally {
      setWorking("");
    }
  };

  const handleCancelWithRefund = async () => {
    if (!refundModal) return;
    setRefundWorking(true);
    try {
      const response = await apiCall(`/api/staff/billing/bookings/${encodeURIComponent(refundModal.bookingCode)}/cancel-with-refund`, {
        method: "POST",
        body: { note: refundNote || "Hủy và hoàn tiền cọc." },
      });
      if (response?.success) {
        addToast("Đã hủy đặt phòng và tính hoàn cọc theo chính sách.", "success");
        setRefundModal(null);
        setRefundNote("");
        await loadBookings();
      }
    } catch (error) {
      addToast(error.message || "Không thể hủy và hoàn tiền.", "error");
    } finally {
      setRefundWorking(false);
    }
  };

  return (
    <div className="ops-page">
      <div
        className="hc-page-title"
        style={{
          display: "flex",
          justify: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          textAlign: "left",
        }}
      >
        <div>
          <h2>Đặt phòng</h2>
          <p>Tìm kiếm, xác nhận cọc, check-in và xử lý các đặt phòng theo trạng thái.</p>
        </div>
        <Link className="hc-btn hc-btn-primary" to="/staff/walkin">
          <i className="bi bi-plus-lg"></i> Khách vãng lai
        </Link>
      </div>

      <div className="hc-card">
        <div
          className="hc-card-body"
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
            borderBottom: "1px solid var(--hc-border-light)",
          }}
        >
          <input
            type="search"
            className="hc-input"
            style={{ flex: "1 1 280px" }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tên khách, số điện thoại, mã đặt phòng"
            aria-label="Tìm khách hoặc mã đặt phòng"
          />
          <div style={{ flex: "0 0 220px" }}>
            <SelectMenu value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Lọc trạng thái" icon="bi-funnel" />
          </div>
          <button type="button" className="hc-btn hc-btn-outline" onClick={loadBookings} disabled={loading}>
            <i className="bi bi-search"></i> Tìm kiếm
          </button>
        </div>

        {loading ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="hc-empty-state">
            <i className="bi bi-calendar-x"></i>
            <p>Không tìm thấy đặt phòng phù hợp.</p>
          </div>
        ) : (
          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Mã đặt phòng</th>
                  <th>Khách</th>
                  <th>Phòng</th>
                  <th>Lưu trú</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const meta = STATUS_META[booking.status] || { label: booking.status, badge: "hc-badge-muted" };
                  return (
                    <tr key={booking.bookingCode}>
                      <td>
                        <strong>{booking.bookingCode}</strong>
                        {booking.source && <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)" }}>{booking.source}</div>}
                      </td>
                      <td>
                        {booking.customerName}
                        <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)" }}>{booking.customerPhone}</div>
                      </td>
                      <td>
                        {booking.roomType?.typeName || booking.roomNumber || "—"}
                        {booking.roomNumber ? ` · ${booking.roomNumber}` : ""}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {formatDate(booking.checkInDate)} – {formatDate(booking.checkOutDate)}
                      </td>
                      <td>
                        {formatVND(booking.totalAmount || booking.totalRoomCharge)}
                        {booking.depositPaid > 0 && <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)" }}>Cọc: {formatVND(booking.depositPaid)}</div>}
                      </td>
                      <td>
                        <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {/* Xác nhận cọc (PENDING_DEPOSIT) */}
                          {booking.status === "PENDING_DEPOSIT" && (
                            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={!!working} onClick={() => updateBooking(booking, "confirm-deposit")}>
                              {working === `${booking.bookingCode}-confirm-deposit` ? "Đang xử lý…" : "Xác nhận cọc"}
                            </button>
                          )}

                          {/* Check-in (chỉ khi CONFIRMED) */}
                          {booking.status === "CONFIRMED" && (
                            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={!!working} onClick={() => updateBooking(booking, "check-in")}>
                              {working === `${booking.bookingCode}-check-in` ? "Đang xử lý…" : "Check-in"}
                            </button>
                          )}

                          {/* Xem folio & check-out (CHECKED_IN) */}
                          {booking.status === "CHECKED_IN" && (
                            <Link className="hc-btn hc-btn-outline hc-btn-sm" to="/staff/rooms" title="Mở sơ đồ phòng để thực hiện quyết toán">
                              <i className="bi bi-receipt"></i> Quyết toán
                            </Link>
                          )}

                          {/* Hủy có hoàn cọc (CONFIRMED) */}
                          {booking.status === "CONFIRMED" && (
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              disabled={!!working}
                              onClick={() => {
                                setRefundModal(booking);
                                setRefundNote("");
                              }}
                            >
                              Hủy & hoàn cọc
                            </button>
                          )}

                          {/* Hủy đơn giản */}
                          {!["CANCELED", "CHECKED_OUT", "EXPIRED", "CHECKED_IN"].includes(booking.status) && (
                            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" disabled={!!working} onClick={() => updateBooking(booking, "cancel")}>
                              {working === `${booking.bookingCode}-cancel` ? "Đang hủy…" : "Hủy đơn"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Hủy & Hoàn cọc */}
      <Modal
        isOpen={!!refundModal}
        onClose={() => setRefundModal(null)}
        title="Hủy đặt phòng & Hoàn cọc"
        subtitle={refundModal ? `Đơn đặt phòng #${refundModal.bookingCode}` : undefined}
        icon="bi-exclamation-triangle"
        accent="var(--hc-warning)"
        maxWidth="500px"
        footer={
          <>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setRefundModal(null)}>
              Quay lại
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={refundWorking} onClick={handleCancelWithRefund}>
              {refundWorking ? "Đang xử lý…" : "Xác nhận hủy & hoàn cọc"}
            </button>
          </>
        }
      >
        {refundModal && (
          <div>
            <p style={{ marginTop: 0 }}>
              Bạn đang hủy đặt phòng <strong>{refundModal.bookingCode}</strong> của khách <strong>{refundModal.customerName}</strong>.
            </p>
            <div
              style={{
                padding: "12px",
                borderRadius: "var(--hc-radius-md)",
                backgroundColor: "var(--hc-warning-bg, #fffbe6)",
                color: "var(--hc-warning, #d97706)",
                fontSize: "13px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <i className="bi bi-info-circle"></i>
              <span>Hệ thống sẽ tự động tính số tiền hoàn cọc theo chính sách hủy phòng.</span>
            </div>
            <div className="hc-form-group" style={{ marginBottom: 0 }}>
              <label className="hc-label">Ghi chú lý do hủy</label>
              <textarea className="hc-textarea" value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="Nhập lý do hủy (tùy chọn)" rows={3} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
