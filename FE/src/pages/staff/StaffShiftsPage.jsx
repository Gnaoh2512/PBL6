import React, { useState, useEffect } from "react";
import Modal from "../../components/Modal";
import { apiCall, formatVND, formatDateTime } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import "./StaffShifts.css";

export default function StaffShiftsPage() {
  const { addToast } = useToast();
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // Open Shift Form State
  const [initialFloat, setInitialFloat] = useState(2000000);
  const [openNotes, setOpenNotes] = useState("Bàn giao tiền mặt đầu ca");
  const [opening, setOpening] = useState(false);

  // Close Shift Modal State
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [actualBalance, setActualBalance] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    loadCurrentShift();
  }, []);

  const loadCurrentShift = async () => {
    setLoading(true);
    try {
      const res = await apiCall("/api/staff/cashier-shifts/me", { silentError: true });
      if (res && res.success && res.data) {
        setCurrentShift(res.data);
      } else {
        setCurrentShift(null);
      }
    } catch {
      setCurrentShift(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setOpening(true);
    try {
      const res = await apiCall("/api/staff/cashier-shifts/open", {
        method: "POST",
        body: {
          openingCash: parseFloat(initialFloat) || 0,
          scheduleId: null,
          notes: openNotes,
        },
      });
      if (res && res.success) {
        addToast("Mở ca thu ngân thành công! Bây giờ bạn có thể thực hiện giao dịch.", "success");
        setCurrentShift(res.data);
      }
    } catch (err) {
      addToast(err.message || "Lỗi mở ca thu ngân", "error");
    } finally {
      setOpening(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!currentShift) return;

    setClosing(true);
    try {
      const shiftId = currentShift.cashierShiftId || currentShift.id;
      const res = await apiCall(`/api/staff/cashier-shifts/${shiftId}/close`, {
        method: "POST",
        body: {
          closingCashActual: parseFloat(actualBalance) || 0,
          receivedBy: receivedBy ? parseInt(receivedBy) : null,
          handoverNote: closeNotes,
        },
      });
      if (res && res.success) {
        addToast("Đã đóng ca và đối soát doanh thu thành công!", "success");
        setCloseModalOpen(false);
        loadCurrentShift();
      }
    } catch (err) {
      addToast(err.message || "Lỗi đóng ca", "error");
    } finally {
      setClosing(false);
    }
  };

  const isShiftOpen = currentShift && currentShift.status === "OPEN";

  const FLOAT_PRESETS = [500000, 1000000, 2000000, 3000000, 5000000];
  const floatNumber = parseFloat(initialFloat) || 0;

  const openingCash = currentShift?.openingCash || 0;
  const totalRevenue = currentShift?.totalRevenue || 0;
  const totalFund = openingCash + totalRevenue;
  const floatPct = totalFund > 0 ? (openingCash / totalFund) * 100 : 100;

  const elapsedText = (() => {
    if (!currentShift?.startTime) return "";
    const mins = Math.max(0, Math.floor((Date.now() - new Date(currentShift.startTime).getTime()) / 60000));
    return mins >= 60 ? `Đã mở ${Math.floor(mins / 60)} giờ ${mins % 60} phút` : `Đã mở ${mins} phút`;
  })();

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ marginBottom: "24px", textAlign: "left" }}>
        <h2>Quản Lý Ca Làm Việc & Thu Ngân</h2>
        <p>Bắt buộc mở ca trước khi tiếp nhận thanh toán phòng, cọc online hoặc check-in Walk-in</p>
      </div>

      {loading ? (
        <div className="hc-loading-spinner">
          <div className="hc-spinner"></div>
        </div>
      ) : isShiftOpen ? (
        /* Active Shift Dashboard */
        <div>
          <div className="sh-summary">
            <div className="sh-hero">
              <div className="sh-hero-label">
                <i className="bi bi-wallet2"></i> Tổng quỹ hiện tại
              </div>
              <div className="sh-hero-value">{formatVND(totalFund)}</div>
              <div className="sh-bar" aria-hidden="true">
                <div className="sh-bar-float" style={{ width: `${floatPct}%` }}></div>
                <div className="sh-bar-rev" style={{ flex: 1 }}></div>
              </div>
              <div className="sh-legend">
                <div className="sh-legend-item">
                  <span className="sh-swatch" style={{ background: "var(--hc-primary-light)" }}></span>
                  <div>
                    <span>Tiền đầu ca (Float)</span>
                    <strong>{formatVND(openingCash)}</strong>
                  </div>
                </div>
                <div className="sh-legend-item">
                  <span className="sh-swatch" style={{ background: "var(--hc-secondary)" }}></span>
                  <div>
                    <span>Doanh thu trong ca</span>
                    <strong>{formatVND(totalRevenue)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="sh-side">
              <div className="sh-tile">
                <div className="sh-tile-icon" style={{ background: "var(--hc-success-bg)", color: "var(--hc-success)" }}>
                  <i className="bi bi-graph-up-arrow"></i>
                </div>
                <div>
                  <div className="sh-tile-label">Doanh thu trong ca</div>
                  <div className="sh-tile-value">{formatVND(totalRevenue)}</div>
                </div>
              </div>
              <div className="sh-tile">
                <div className="sh-tile-icon" style={{ background: "var(--hc-primary-subtle)", color: "var(--hc-primary)" }}>
                  <i className="bi bi-cash-coin"></i>
                </div>
                <div>
                  <div className="sh-tile-label">Tiền đầu ca (Float)</div>
                  <div className="sh-tile-value">{formatVND(openingCash)}</div>
                </div>
              </div>
              <div className="sh-tile">
                <div className="sh-tile-icon" style={{ background: "var(--hc-info-bg)", color: "var(--hc-info)" }}>
                  <i className="bi bi-clock-history"></i>
                </div>
                <div>
                  <div className="sh-tile-label">Giờ bắt đầu ca</div>
                  <div className="sh-tile-value">{new Date(currentShift.startTime).toLocaleTimeString("vi-VN")}</div>
                  <div className="sh-tile-sub">{elapsedText}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="hc-card">
            <div className="hc-card-header">
              <div className="hc-card-title">
                <i className="bi bi-file-earmark-text text-primary" style={{ marginRight: "8px" }}></i>
                Thông Tin Chi Tiết Ca Trực #{currentShift.cashierShiftId || currentShift.id}
              </div>
              <span className="hc-badge hc-badge-success" style={{ padding: "6px 14px", fontSize: "13px" }}>
                <span className="hc-pulse-dot" style={{ background: "var(--hc-success)", marginRight: "6px" }}></span>
                Đang Mở (Active)
              </span>
            </div>

            <div className="hc-card-body">
              <div className="sh-details">
                <div>
                  <div style={{ color: "var(--hc-text-secondary)", fontSize: "13px" }}>Thu ngân phụ trách:</div>
                  <strong style={{ fontSize: "16px" }}>{currentShift.cashierName || "Nhân viên lễ tân"}</strong>
                </div>
                <div>
                  <div style={{ color: "var(--hc-text-secondary)", fontSize: "13px" }}>Thời gian mở ca:</div>
                  <strong style={{ fontSize: "16px" }}>{formatDateTime(currentShift.startTime)}</strong>
                </div>
                <div>
                  <div style={{ color: "var(--hc-text-secondary)", fontSize: "13px" }}>Ghi chú mở ca:</div>
                  <div>{currentShift.notes || "Không có ghi chú"}</div>
                </div>
                <div>
                  <div style={{ color: "var(--hc-text-secondary)", fontSize: "13px" }}>Trạng thái hệ thống:</div>
                  <div style={{ color: "var(--hc-success)", fontWeight: 600 }}>Sẵn sàng tiếp nhận đặt cọc & thanh toán</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--hc-border)", paddingTop: "20px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button type="button" className="hc-btn hc-btn-outline" onClick={loadCurrentShift}>
                  <i className="bi bi-arrow-clockwise"></i> Cập nhật số dư
                </button>
                <button
                  type="button"
                  className="hc-btn hc-btn-danger"
                  onClick={() => {
                    setActualBalance((currentShift.openingCash || 0) + (currentShift.totalRevenue || 0));
                    setCloseModalOpen(true);
                  }}
                >
                  <i className="bi bi-door-closed"></i> Đóng Ca & Quyết Toán Cuối Ca
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Open Shift Panel */
        <div className="sh-open">
          <div className="sh-open-head">
            <div className="sh-open-icon">
              <i className="bi bi-unlock"></i>
            </div>
            <div>
              <h3 className="sh-open-title">Mở Ca Làm Việc Thu Ngân Mới</h3>
              <p className="sh-open-sub">Bắt buộc mở ca trước khi nhận thanh toán hoặc check-in Walk-in</p>
            </div>
          </div>

          <div className="sh-open-body">
            <div className="sh-note">
              <i className="bi bi-info-circle-fill"></i>
              <div>
                Vui lòng kiểm đếm tiền mặt thực tế trong két để nhập chính xác <strong>Tiền đầu ca</strong> trước khi nhận tiền của khách hàng.
              </div>
            </div>

            <form onSubmit={handleOpenShift}>
              <div className="hc-form-group">
                <label className="hc-label" htmlFor="shift-float">
                  Tiền mặt bàn giao đầu ca <span style={{ color: "var(--hc-error)" }}>*</span>
                </label>
                <div className="sh-money">
                  <input id="shift-float" type="number" className="hc-input" min="0" step="50000" value={initialFloat} onChange={(e) => setInitialFloat(e.target.value)} required />
                  <span className="sh-money-unit">VNĐ</span>
                </div>
                <div className="sh-money-words">
                  Bằng chữ số: <strong>{formatVND(floatNumber)}</strong>
                </div>
                <div className="sh-chips" role="group" aria-label="Chọn nhanh số tiền">
                  {FLOAT_PRESETS.map((amount) => (
                    <button key={amount} type="button" className={`sh-chip ${floatNumber === amount ? "is-active" : ""}`} onClick={() => setInitialFloat(amount)}>
                      {formatVND(amount)}
                    </button>
                  ))}
                </div>
                <div className="hc-help-text" style={{ marginTop: "10px" }}>
                  Số tiền hiện có trong két thu ngân để trả lại khách.
                </div>
              </div>

              <div className="hc-form-group">
                <label className="hc-label" htmlFor="shift-note">
                  Ghi chú khi mở ca
                </label>
                <textarea
                  id="shift-note"
                  className="hc-textarea"
                  rows="3"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="Ví dụ: Nhận bàn giao từ ca sáng, két đủ tiền lẻ..."
                ></textarea>
              </div>

              <button type="submit" className="hc-btn hc-btn-primary hc-btn-lg" style={{ width: "100%", marginTop: "8px" }} disabled={opening}>
                {opening ? "Đang mở ca..." : "Xác Nhận Mở Ca Thu Ngân →"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Đối Soát Doanh Thu & Đóng Ca Thu Ngân"
        maxWidth="500px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setCloseModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-danger hc-btn-sm" onClick={handleCloseShift} disabled={closing}>
              {closing ? "Đang đóng ca..." : "Xác nhận Đóng Ca"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCloseShift}>
          <div style={{ background: "var(--hc-bg)", padding: "14px", borderRadius: "var(--hc-radius-md)", marginBottom: "16px", border: "1px solid var(--hc-border)", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "var(--hc-text-secondary)" }}>Tiền đầu ca:</span>
              <strong>{formatVND(currentShift?.openingCash || 0)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "var(--hc-text-secondary)" }}>Doanh thu thu được:</span>
              <strong>{formatVND(currentShift?.totalRevenue || 0)}</strong>
            </div>
            <hr className="hc-divider" style={{ margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Tổng tiền lý thuyết trong két:</span>
              <span style={{ color: "var(--hc-primary)" }}>{formatVND((currentShift?.openingCash || 0) + (currentShift?.totalRevenue || 0))}</span>
            </div>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Tiền mặt thực tế kiểm đếm cuối ca (VNĐ) <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input type="number" className="hc-input" value={actualBalance} onChange={(e) => setActualBalance(e.target.value)} required />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Ghi chú bàn giao ca sau</label>
            <textarea className="hc-textarea" rows="3" placeholder="Ghi chú về chênh lệch tiền (nếu có) hoặc bàn giao..." value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)}></textarea>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">ID Nhân viên tiếp nhận (Bàn giao cho)</label>
            <input
              type="number"
              className="hc-input"
              placeholder="Nhập accountId/staffId nhân viên ca tiếp theo (tùy chọn)"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              min="1"
            />
            <div className="hc-help-text">Nếu không nhập, hệ thống sẽ lưu trống.</div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
