import React, { useState, useEffect, useCallback, useMemo } from "react";
import Modal from "../../components/Modal";
import { apiCall, formatVND, formatDateTime } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import "./StaffShifts.css";

const FLOAT_PRESETS = [500000, 1000000, 2000000, 3000000, 5000000];

export default function StaffShiftsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("CURRENT"); // "CURRENT" | "HISTORY"
  const [currentShift, setCurrentShift] = useState(null);
  const [historyShifts, setHistoryShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Open Shift Form State
  const [initialFloat, setInitialFloat] = useState(2000000);
  const [openNotes, setOpenNotes] = useState("Bàn giao tiền mặt đầu ca trực chung");
  const [opening, setOpening] = useState(false);

  // Close Shift Modal State
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [actualBalance, setActualBalance] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [closing, setClosing] = useState(false);

  // Transaction Filters State (for active shift)
  const [txnSearch, setTxnSearch] = useState("");
  const [txnFilter, setTxnFilter] = useState("ALL"); // ALL | CASH | BANK | CARD | REFUND

  // Detail Modal for historical shift
  const [selectedHistoryShift, setSelectedHistoryShift] = useState(null);

  const loadCurrentShift = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
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
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadHistoryShifts = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiCall("/api/staff/cashier-shifts", { silentError: true });
      if (res && res.success && Array.isArray(res.data)) {
        setHistoryShifts(res.data);
      } else {
        setHistoryShifts([]);
      }
    } catch {
      setHistoryShifts([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentShift();
  }, [loadCurrentShift]);

  useEffect(() => {
    if (activeTab === "HISTORY") {
      loadHistoryShifts();
    }
  }, [activeTab, loadHistoryShifts]);

  // Periodic background sync every 30 seconds if on active shift
  useEffect(() => {
    if (activeTab !== "CURRENT") return;
    const timer = setInterval(() => {
      loadCurrentShift(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [activeTab, loadCurrentShift]);

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
        addToast("Mở ca thu ngân thành công! Ca dùng chung đã được đồng bộ cho cả Lễ tân và Admin.", "success");
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
          receivedByAccountId: receivedBy ? parseInt(receivedBy) : null,
          handoverNote: closeNotes,
        },
      });
      if (res && res.success) {
        addToast("Đã đóng ca và đối soát doanh thu thành công!", "success");
        setCloseModalOpen(false);
        loadCurrentShift();
        if (activeTab === "HISTORY") {
          loadHistoryShifts();
        }
      }
    } catch (err) {
      addToast(err.message || "Lỗi đóng ca", "error");
    } finally {
      setClosing(false);
    }
  };

  const isShiftOpen = currentShift && currentShift.status === "OPEN";

  // Financial calculations
  const openingCash = Number(currentShift?.openingCash || 0);
  const totalCashRevenue = Number(currentShift?.totalCashRevenue || 0);
  const totalBankRevenue = Number(currentShift?.totalBankRevenue || 0);
  const totalCardRevenue = Number(currentShift?.totalCardRevenue || 0);
  const totalRefund = Number(currentShift?.totalRefund || 0);
  const totalRevenue = Number(currentShift?.totalRevenue || 0);
  // Total physical cash in the drawer
  const totalPhysicalFund = openingCash + totalCashRevenue;

  const floatPct = totalPhysicalFund > 0 ? Math.min(100, Math.round((openingCash / totalPhysicalFund) * 100)) : 100;

  const elapsedText = (() => {
    if (!currentShift?.startTime) return "";
    const mins = Math.max(0, Math.floor((Date.now() - new Date(currentShift.startTime).getTime()) / 60000));
    return mins >= 60 ? `Đã mở ${Math.floor(mins / 60)} giờ ${mins % 60} phút` : `Đã mở ${mins} phút`;
  })();

  // Filter transactions
  const transactions = currentShift?.transactions || [];
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Filter by method / type
      if (txnFilter === "CASH" && (t.method || "").toUpperCase() !== "CASH") return false;
      if (
        txnFilter === "BANK" &&
        !["BANK_TRANSFER", "VIETQR", "TRANSFER"].includes((t.method || "").toUpperCase())
      )
        return false;
      if (txnFilter === "CARD" && !["CREDIT_CARD", "CARD"].includes((t.method || "").toUpperCase())) return false;
      if (txnFilter === "REFUND" && (t.type || "").toUpperCase() !== "REFUND") return false;

      // Filter by search query
      if (txnSearch.trim()) {
        const q = txnSearch.trim().toLowerCase();
        const str = `${t.paymentId || ""} ${t.bookingCode || ""} ${t.customerName || ""} ${t.roomNumber || ""} ${t.note || ""} ${t.receivedByFullName || ""}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, txnFilter, txnSearch]);

  const cashCount = transactions.filter((t) => (t.method || "").toUpperCase() === "CASH").length;
  const bankCount = transactions.filter((t) =>
    ["BANK_TRANSFER", "VIETQR", "TRANSFER"].includes((t.method || "").toUpperCase())
  ).length;
  const cardCount = transactions.filter((t) =>
    ["CREDIT_CARD", "CARD"].includes((t.method || "").toUpperCase())
  ).length;
  const refundCount = transactions.filter((t) => (t.type || "").toUpperCase() === "REFUND").length;

  // Discrepancy calculation in close modal
  const enteredActual = parseFloat(actualBalance);
  const diff = !isNaN(enteredActual) ? enteredActual - totalPhysicalFund : 0;

  return (
    <div className="ops-page">
      {/* Page Title & Sync Control */}
      <div
        className="hc-page-title"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2>Quản Lý Ca Làm Việc &amp; Thu Ngân</h2>
          <p>
            Hệ thống ca thu ngân dùng chung đồng bộ giữa Lễ tân và Quản lý (Admin). Tự động ghi nhận mọi giao dịch phòng, cọc và dịch vụ.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="hc-btn hc-btn-outline"
            onClick={() => (activeTab === "CURRENT" ? loadCurrentShift() : loadHistoryShifts())}
            disabled={refreshing}
            title="Đồng bộ dữ liệu mới nhất"
          >
            <i className={`bi bi-arrow-clockwise ${refreshing ? "spin-icon" : ""}`}></i>
            {refreshing ? "Đang đồng bộ..." : "Đồng bộ ngay"}
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="sh-tabs">
        <button
          type="button"
          className={`sh-tab ${activeTab === "CURRENT" ? "is-active" : ""}`}
          onClick={() => setActiveTab("CURRENT")}
        >
          <i className="bi bi-wallet2"></i>
          Ca trực hiện tại
          {isShiftOpen && (
            <span
              style={{
                background: "var(--hc-success, #16a34a)",
                color: "#fff",
                fontSize: "10px",
                padding: "2px 7px",
                borderRadius: "10px",
                fontWeight: 700,
                marginLeft: "4px",
              }}
            >
              Đang mở
            </span>
          )}
        </button>

        <button
          type="button"
          className={`sh-tab ${activeTab === "HISTORY" ? "is-active" : ""}`}
          onClick={() => setActiveTab("HISTORY")}
        >
          <i className="bi bi-clock-history"></i>
          Lịch sử các ca thu ngân
        </button>
      </div>

      {/* TAB 1: CURRENT ACTIVE SHIFT VIEW */}
      {activeTab === "CURRENT" && (
        <>
          {loading ? (
            <div className="hc-loading-spinner" style={{ padding: "60px 0" }}>
              <div className="hc-spinner"></div>
            </div>
          ) : isShiftOpen ? (
            <div>
              {/* Shared Shift Indicator Banner */}
              <div className="sh-shared-banner">
                <div className="sh-shared-left">
                  <div className="sh-shared-icon">
                    <i className="bi bi-people-fill"></i>
                  </div>
                  <div>
                    <h3 className="sh-shared-title">
                      Ca Thu Ngân Chung Đang Hoạt Động #{currentShift.cashierShiftId}
                      <span className="hc-badge hc-badge-success" style={{ fontSize: "12px", marginLeft: "6px" }}>
                        Active
                      </span>
                    </h3>
                    <div className="sh-shared-sub">
                      Người mở ca: <strong>{currentShift.accountFullName || "Lễ tân"}</strong>{" "}
                      {currentShift.accountRole ? `(${currentShift.accountRole})` : ""} · Bắt đầu lúc:{" "}
                      <strong>{formatDateTime(currentShift.startTime)}</strong> ({elapsedText})
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "12px", color: "var(--hc-text-secondary)", display: "block" }}>
                    Chế độ đồng bộ thời gian thực
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--hc-success)" }}>
                    <i className="bi bi-check-circle-fill" style={{ marginRight: "4px" }}></i>
                    Lễ tân &amp; Admin cùng thao tác
                  </span>
                </div>
              </div>

              {/* Fund Summary & Hero Bar */}
              <div className="sh-summary">
                <div className="sh-hero">
                  <div className="sh-hero-label">
                    <i className="bi bi-safe2"></i> Quỹ tiền mặt trong két (Tiền bàn giao + Thu tiền mặt)
                  </div>
                  <div className="sh-hero-value">{formatVND(totalPhysicalFund)}</div>

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
                        <span>Tiền mặt thu thêm trong ca</span>
                        <strong>+{formatVND(totalCashRevenue)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Side Tile Summary */}
                <div className="sh-side">
                  <div className="sh-tile">
                    <div className="sh-tile-icon" style={{ background: "var(--hc-success-bg)", color: "var(--hc-success)" }}>
                      <i className="bi bi-graph-up-arrow"></i>
                    </div>
                    <div>
                      <div className="sh-tile-label">Tổng doanh thu ca</div>
                      <div className="sh-tile-value">{formatVND(totalRevenue)}</div>
                      <div className="sh-tile-sub">{transactions.length} giao dịch phát sinh</div>
                    </div>
                  </div>

                  <div className="sh-tile">
                    <div className="sh-tile-icon" style={{ background: "var(--hc-primary-subtle)", color: "var(--hc-primary)" }}>
                      <i className="bi bi-cash-stack"></i>
                    </div>
                    <div>
                      <div className="sh-tile-label">Tiền mặt bàn giao đầu ca</div>
                      <div className="sh-tile-value">{formatVND(openingCash)}</div>
                      <div className="sh-tile-sub">Két tiền ban đầu</div>
                    </div>
                  </div>

                  <div className="sh-tile">
                    <div className="sh-tile-icon" style={{ background: "var(--hc-info-bg)", color: "var(--hc-info)" }}>
                      <i className="bi bi-clock-history"></i>
                    </div>
                    <div>
                      <div className="sh-tile-label">Thời gian mở ca</div>
                      <div className="sh-tile-value">{new Date(currentShift.startTime).toLocaleTimeString("vi-VN")}</div>
                      <div className="sh-tile-sub">{elapsedText}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Column Payment Breakdown Grid */}
              <div className="sh-breakdown-grid">
                <div className="sh-breakdown-card">
                  <div className="sh-breakdown-head">
                    <span className="sh-breakdown-lbl">Tiền Mặt (Cash)</span>
                    <div className="sh-breakdown-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
                      <i className="bi bi-cash"></i>
                    </div>
                  </div>
                  <div className="sh-breakdown-val" style={{ color: "#b45309" }}>
                    {formatVND(totalCashRevenue)}
                  </div>
                  <div className="sh-breakdown-hint">Cộng dồn vào két tiền mặt ({cashCount} GD)</div>
                </div>

                <div className="sh-breakdown-card">
                  <div className="sh-breakdown-head">
                    <span className="sh-breakdown-lbl">VietQR / Chuyển Khoản</span>
                    <div className="sh-breakdown-icon" style={{ background: "#e0e7ff", color: "#4338ca" }}>
                      <i className="bi bi-qr-code-scan"></i>
                    </div>
                  </div>
                  <div className="sh-breakdown-val" style={{ color: "#4338ca" }}>
                    {formatVND(totalBankRevenue)}
                  </div>
                  <div className="sh-breakdown-hint">Tự động đối soát SePay / VietQR ({bankCount} GD)</div>
                </div>

                <div className="sh-breakdown-card">
                  <div className="sh-breakdown-head">
                    <span className="sh-breakdown-lbl">Thẻ Tín Dụng (POS)</span>
                    <div className="sh-breakdown-icon" style={{ background: "#dbeafe", color: "#1d4ed8" }}>
                      <i className="bi bi-credit-card"></i>
                    </div>
                  </div>
                  <div className="sh-breakdown-val" style={{ color: "#1d4ed8" }}>
                    {formatVND(totalCardRevenue)}
                  </div>
                  <div className="sh-breakdown-hint">Quẹt thẻ qua máy POS ({cardCount} GD)</div>
                </div>

                <div className="sh-breakdown-card">
                  <div className="sh-breakdown-head">
                    <span className="sh-breakdown-lbl">Hoàn Tiền (Refunds)</span>
                    <div className="sh-breakdown-icon" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                      <i className="bi bi-arrow-return-left"></i>
                    </div>
                  </div>
                  <div className="sh-breakdown-val" style={{ color: totalRefund > 0 ? "#b91c1c" : "inherit" }}>
                    {formatVND(totalRefund)}
                  </div>
                  <div className="sh-breakdown-hint">Hoàn cọc hủy phòng ({refundCount} GD)</div>
                </div>
              </div>

              {/* Shared Transactions Table Card */}
              <div className="hc-card" style={{ marginBottom: "24px" }}>
                <div className="hc-card-header">
                  <div className="sh-txn-toolbar" style={{ width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className="hc-card-title" style={{ margin: 0 }}>
                        <i className="bi bi-list-check text-primary" style={{ marginRight: "8px" }}></i>
                        Giao Dịch Chung Phát Sinh Trong Ca
                      </div>
                      <span className="hc-badge hc-badge-primary">{transactions.length} GD</span>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <div className="sh-txn-search">
                        <i className="bi bi-search"></i>
                        <input
                          type="text"
                          className="hc-input"
                          placeholder="Tìm theo mã đơn, phòng, khách..."
                          value={txnSearch}
                          onChange={(e) => setTxnSearch(e.target.value)}
                        />
                      </div>

                      <select
                        className="hc-select"
                        value={txnFilter}
                        onChange={(e) => setTxnFilter(e.target.value)}
                        style={{ width: "auto" }}
                      >
                        <option value="ALL">Tất cả phương thức ({transactions.length})</option>
                        <option value="CASH">💵 Tiền mặt ({cashCount})</option>
                        <option value="BANK">📱 Chuyển khoản / VietQR ({bankCount})</option>
                        <option value="CARD">💳 Thẻ tín dụng ({cardCount})</option>
                        {refundCount > 0 && <option value="REFUND">🔄 Hoàn tiền ({refundCount})</option>}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
                  {filteredTransactions.length === 0 ? (
                    <div className="hc-empty-state" style={{ padding: "40px 20px" }}>
                      <i className="bi bi-receipt" style={{ fontSize: "2.4rem", opacity: 0.4 }}></i>
                      <p style={{ marginTop: "12px", color: "var(--hc-text-secondary)" }}>
                        {txnSearch.trim() || txnFilter !== "ALL"
                          ? "Không tìm thấy giao dịch nào khớp với bộ lọc."
                          : "Chưa có giao dịch phát sinh trong ca này. Mọi khoản thu tiền phòng, cọc hoặc dịch vụ sẽ tự động hiển thị ở đây."}
                      </p>
                    </div>
                  ) : (
                    <table className="hc-table">
                      <thead>
                        <tr>
                          <th>Mã GD</th>
                          <th>Đơn đặt / Phòng</th>
                          <th>Khách hàng</th>
                          <th>Loại giao dịch</th>
                          <th>Phương thức</th>
                          <th style={{ textAlign: "right" }}>Số tiền</th>
                          <th>Thời gian</th>
                          <th>Người thu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((t) => {
                          const isRef = (t.type || "").toUpperCase() === "REFUND";
                          const isCash = (t.method || "").toUpperCase() === "CASH";
                          const isBank = ["BANK_TRANSFER", "VIETQR", "TRANSFER"].includes((t.method || "").toUpperCase());

                          return (
                            <tr key={t.paymentId}>
                              <td>
                                <strong>#TXN-{t.paymentId}</strong>
                              </td>
                              <td>
                                {t.bookingCode ? (
                                  <div>
                                    <strong style={{ color: "var(--hc-primary)" }}>{t.bookingCode}</strong>
                                    {t.roomNumber && (
                                      <span style={{ marginLeft: "6px", fontSize: "12px", color: "var(--hc-text-secondary)" }}>
                                        (P.{t.roomNumber})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--hc-text-muted)" }}>—</span>
                                )}
                              </td>
                              <td>
                                <div>{t.customerName || "Khách vãng lai"}</div>
                                {t.note && (
                                  <div style={{ fontSize: "11px", color: "var(--hc-text-secondary)" }}>
                                    {t.note}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span
                                  className={`hc-badge ${
                                    isRef
                                      ? "hc-badge-danger"
                                      : t.type === "DEPOSIT"
                                      ? "hc-badge-info"
                                      : "hc-badge-success"
                                  }`}
                                >
                                  {t.type === "DEPOSIT"
                                    ? "Đặt cọc"
                                    : t.type === "SETTLEMENT"
                                    ? "Tất toán"
                                    : t.type === "REFUND"
                                    ? "Hoàn tiền"
                                    : t.type || "Thanh toán"}
                                </span>
                              </td>
                              <td>
                                {isCash ? (
                                  <span className="sh-method-badge cash">
                                    <i className="bi bi-cash"></i> Tiền mặt
                                  </span>
                                ) : isBank ? (
                                  <span className="sh-method-badge bank">
                                    <i className="bi bi-qr-code"></i> VietQR / CK
                                  </span>
                                ) : (
                                  <span className="sh-method-badge card">
                                    <i className="bi bi-credit-card"></i> Thẻ POS
                                  </span>
                                )}
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  fontWeight: 700,
                                  fontSize: "14px",
                                  color: isRef ? "var(--hc-error, #dc2626)" : "var(--hc-success, #16a34a)",
                                }}
                              >
                                {isRef ? "-" : "+"}
                                {formatVND(t.amount)}
                              </td>
                              <td>{formatDateTime(t.paidAt)}</td>
                              <td>
                                <span className="hc-badge hc-badge-neutral">
                                  {t.receivedByFullName || "Hệ thống"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Shift Details & Close Action Footer */}
              <div className="hc-card">
                <div className="hc-card-header">
                  <div className="hc-card-title">
                    <i className="bi bi-file-earmark-text text-primary" style={{ marginRight: "8px" }}></i>
                    Thông Tin Quản Trị Ca Trực #{currentShift.cashierShiftId}
                  </div>
                  <span className="hc-badge hc-badge-success" style={{ padding: "6px 14px", fontSize: "13px" }}>
                    <span className="hc-pulse-dot" style={{ background: "var(--hc-success)", marginRight: "6px" }}></span>
                    Đang mở — Đồng bộ Lễ tân &amp; Admin
                  </span>
                </div>

                <div className="hc-card-body">
                  <div className="sh-details">
                    <div>
                      <div className="sh-detail-label">Nhân sự phụ trách mở ca:</div>
                      <strong style={{ fontSize: "15px" }}>
                        {currentShift.accountFullName || "Nhân viên lễ tân"}{" "}
                        {currentShift.accountRole ? `(${currentShift.accountRole})` : ""}
                      </strong>
                    </div>
                    <div>
                      <div className="sh-detail-label">Thời gian mở ca:</div>
                      <strong style={{ fontSize: "15px" }}>{formatDateTime(currentShift.startTime)}</strong>
                    </div>
                    <div>
                      <div className="sh-detail-label">Ghi chú khi mở ca:</div>
                      <div>{currentShift.handoverNote || currentShift.notes || "Không có ghi chú"}</div>
                    </div>
                    <div>
                      <div className="sh-detail-label">Trạng thái hệ thống:</div>
                      <div style={{ color: "var(--hc-success)", fontWeight: 600 }}>
                        <i className="bi bi-check-all"></i> Đang tiếp nhận mọi giao dịch thanh toán
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid var(--hc-border)",
                      paddingTop: "20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ fontSize: "13px", color: "var(--hc-text-secondary)" }}>
                      <i className="bi bi-info-circle" style={{ marginRight: "4px" }}></i>
                      Cả Lễ tân và Quản lý (Admin) đều có quyền kiểm đếm và đóng ca quyết toán khi kết thúc ca làm việc.
                    </div>

                    <div style={{ display: "flex", gap: "12px" }}>
                      <button type="button" className="hc-btn hc-btn-outline" onClick={() => loadCurrentShift()}>
                        <i className="bi bi-arrow-clockwise"></i> Cập nhật số dư
                      </button>
                      <button
                        type="button"
                        className="hc-btn hc-btn-danger"
                        onClick={() => {
                          setActualBalance(totalPhysicalFund);
                          setCloseModalOpen(true);
                        }}
                      >
                        <i className="bi bi-door-closed"></i> Đóng Ca &amp; Quyết Toán Cuối Ca
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Open Shift Panel (when no shift is active) */
            <div className="sh-open">
              <div className="sh-open-head">
                <div className="sh-open-icon">
                  <i className="bi bi-unlock"></i>
                </div>
                <div>
                  <h3 className="sh-open-title">Mở Ca Làm Việc Thu Ngân Mới</h3>
                  <p className="sh-open-sub">
                    Ca thu ngân dùng chung sẽ được khởi tạo cho cả Lễ tân và Admin tiếp nhận giao dịch
                  </p>
                </div>
              </div>

              <div className="sh-open-body">
                <div className="sh-note">
                  <i className="bi bi-info-circle-fill"></i>
                  <div>
                    Vui lòng kiểm đếm tiền mặt thực tế trong két quầy lễ tân để nhập chính xác <strong>Tiền đầu ca</strong>{" "}
                    trước khi tiếp nhận thanh toán phòng hoặc check-in.
                  </div>
                </div>

                <form onSubmit={handleOpenShift}>
                  <div className="hc-form-group">
                    <label className="hc-label" htmlFor="shift-float">
                      Tiền mặt bàn giao đầu ca <span style={{ color: "var(--hc-error)" }}>*</span>
                    </label>
                    <div className="sh-money">
                      <input
                        id="shift-float"
                        type="number"
                        className="hc-input"
                        min="0"
                        step="50000"
                        value={initialFloat}
                        onChange={(e) => setInitialFloat(e.target.value)}
                        required
                      />
                      <span className="sh-money-unit">VNĐ</span>
                    </div>
                    <div className="sh-money-words">
                      Bằng chữ số: <strong>{formatVND(parseFloat(initialFloat) || 0)}</strong>
                    </div>
                    <div className="sh-chips" role="group" aria-label="Chọn nhanh số tiền">
                      {FLOAT_PRESETS.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          className={`sh-chip ${parseFloat(initialFloat) === amount ? "is-active" : ""}`}
                          onClick={() => setInitialFloat(amount)}
                        >
                          {formatVND(amount)}
                        </button>
                      ))}
                    </div>
                    <div className="hc-help-text" style={{ marginTop: "10px" }}>
                      Số tiền tiền mặt dự trữ hiện có trong két để trả lại khách.
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
                      placeholder="Ví dụ: Nhận bàn giao từ ca trước, két đủ tiền lẻ, máy POS hoạt động tốt..."
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="hc-btn hc-btn-primary hc-btn-lg"
                    style={{ width: "100%", marginTop: "8px" }}
                    disabled={opening}
                  >
                    {opening ? "Đang mở ca..." : "Xác Nhận Mở Ca Thu Ngân →"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: SHIFT HISTORY VIEW */}
      {activeTab === "HISTORY" && (
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-clock-history text-primary" style={{ marginRight: "8px" }}></i>
              Lịch Sử Đối Soát Ca Thu Ngân ({historyShifts.length} ca)
            </div>
            <button
              type="button"
              className="hc-btn hc-btn-outline hc-btn-sm"
              onClick={loadHistoryShifts}
              disabled={loadingHistory}
            >
              <i className={`bi bi-arrow-clockwise ${loadingHistory ? "spin-icon" : ""}`}></i> Làm mới
            </button>
          </div>

          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            {loadingHistory ? (
              <div className="hc-loading-spinner" style={{ padding: "40px 0" }}>
                <div className="hc-spinner"></div>
              </div>
            ) : historyShifts.length === 0 ? (
              <div className="hc-empty-state" style={{ padding: "40px 20px" }}>
                <i className="bi bi-inbox" style={{ fontSize: "2rem", opacity: 0.4 }}></i>
                <p style={{ marginTop: "10px", color: "var(--hc-text-secondary)" }}>
                  Chưa có ca thu ngân nào được lưu lại trong lịch sử.
                </p>
              </div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Mã ca</th>
                    <th>Thu ngân mở ca</th>
                    <th>Thời gian trực</th>
                    <th style={{ textAlign: "right" }}>Tiền đầu ca</th>
                    <th style={{ textAlign: "right" }}>Doanh thu ca</th>
                    <th style={{ textAlign: "right" }}>Tiền bàn giao</th>
                    <th style={{ textAlign: "right" }}>Chênh lệch</th>
                    <th>Bàn giao cho</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "center" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {historyShifts.map((sh) => {
                    const opCash = Number(sh.openingCash || 0);
                    const cashRev = Number(sh.totalCashRevenue || 0);
                    const theoCash = opCash + cashRev;
                    const actCash = sh.closingCashActual != null ? Number(sh.closingCashActual) : null;
                    const diffVal = actCash != null ? actCash - theoCash : 0;
                    const isOpen = sh.status === "OPEN";

                    return (
                      <tr key={sh.cashierShiftId}>
                        <td>
                          <strong>#{sh.cashierShiftId}</strong>
                        </td>
                        <td>
                          <div>{sh.accountFullName || "Lễ tân"}</div>
                          {sh.accountRole && (
                            <div style={{ fontSize: "11px", color: "var(--hc-text-secondary)" }}>
                              {sh.accountRole}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: "13px" }}>{formatDateTime(sh.startTime)}</div>
                          <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)" }}>
                            ➔ {sh.endTime ? formatDateTime(sh.endTime) : "Đang hoạt động"}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>{formatVND(opCash)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "var(--hc-primary)" }}>
                          {formatVND(sh.totalRevenue || 0)}
                          <div style={{ fontSize: "11px", color: "var(--hc-text-secondary)" }}>
                            {sh.transactionCount || 0} GD
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {actCash != null ? formatVND(actCash) : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {actCash == null ? (
                            "—"
                          ) : diffVal === 0 ? (
                            <span className="hc-badge hc-badge-success">Khớp 100%</span>
                          ) : diffVal > 0 ? (
                            <span className="hc-badge hc-badge-info">+{formatVND(diffVal)}</span>
                          ) : (
                            <span className="hc-badge hc-badge-danger">-{formatVND(Math.abs(diffVal))}</span>
                          )}
                        </td>
                        <td>{sh.receivedByFullName || "—"}</td>
                        <td>
                          <span className={`hc-badge ${isOpen ? "hc-badge-success" : "hc-badge-neutral"}`}>
                            {isOpen ? "ĐANG MỞ" : "ĐÃ ĐÓNG"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            onClick={() => setSelectedHistoryShift(sh)}
                            title="Xem chi tiết giao dịch ca này"
                          >
                            <i className="bi bi-eye"></i> Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Đối Soát Doanh Thu &amp; Đóng Ca Thu Ngân"
        maxWidth="540px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setCloseModalOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-danger hc-btn-sm"
              onClick={handleCloseShift}
              disabled={closing}
            >
              {closing ? "Đang đóng ca..." : "Xác nhận Đóng Ca"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCloseShift}>
          <div
            style={{
              background: "var(--hc-bg, #f8fafc)",
              padding: "16px",
              borderRadius: "var(--hc-radius-md)",
              marginBottom: "16px",
              border: "1px solid var(--hc-border, #e2e8f0)",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "var(--hc-text-secondary)" }}>Tiền mặt bàn giao đầu ca (Float):</span>
              <strong>{formatVND(openingCash)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "var(--hc-text-secondary)" }}>Tiền mặt thu thêm trong ca:</span>
              <strong style={{ color: "var(--hc-success)" }}>+{formatVND(totalCashRevenue)}</strong>
            </div>
            <hr className="hc-divider" style={{ margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "14px" }}>
              <span>Tiền mặt lý thuyết trong két cần bàn giao:</span>
              <span style={{ color: "var(--hc-primary)" }}>{formatVND(totalPhysicalFund)}</span>
            </div>

            <div
              style={{
                marginTop: "12px",
                paddingTop: "10px",
                borderTop: "1px dashed var(--hc-border)",
                fontSize: "12px",
                color: "var(--hc-text-secondary)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Doanh thu VietQR / Chuyển khoản (Đã vào NH):</span>
                <span>{formatVND(totalBankRevenue)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Doanh thu Quẹt thẻ POS:</span>
                <span>{formatVND(totalCardRevenue)}</span>
              </div>
            </div>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Tiền mặt thực tế kiểm đếm trong két (VNĐ) <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input
              type="number"
              className="hc-input"
              value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              required
              min="0"
              step="1000"
            />

            {!isNaN(enteredActual) && (
              <div
                className={`sh-diff-box ${
                  diff === 0 ? "match" : diff > 0 ? "surplus" : "shortage"
                }`}
              >
                <span>
                  {diff === 0
                    ? "✓ Số tiền kiểm đếm khớp hoàn toàn với lý thuyết"
                    : diff > 0
                    ? `▲ Thừa tiền trong két:`
                    : `▼ Thiếu hụt tiền trong két:`}
                </span>
                <span>{diff === 0 ? "Khớp 100%" : (diff > 0 ? "+" : "") + formatVND(diff)}</span>
              </div>
            )}
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Ghi chú bàn giao ca sau</label>
            <textarea
              className="hc-textarea"
              rows="3"
              placeholder="Ghi chú về chênh lệch tiền (nếu có), bàn giao két tiền lẻ, chìa khóa..."
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
            ></textarea>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">ID Nhân viên tiếp nhận (Bàn giao cho)</label>
            <input
              type="number"
              className="hc-input"
              placeholder="Nhập accountId của nhân viên ca tiếp theo (tùy chọn)"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              min="1"
            />
            <div className="hc-help-text">Nếu ca sau chưa có mặt, để trống để lưu vào lịch sử.</div>
          </div>
        </form>
      </Modal>

      {/* History Shift Detail Modal */}
      <Modal
        isOpen={!!selectedHistoryShift}
        onClose={() => setSelectedHistoryShift(null)}
        title={`Chi Tiết Ca Thu Ngân #${selectedHistoryShift?.cashierShiftId || ""}`}
        maxWidth="760px"
        footer={
          <button
            type="button"
            className="hc-btn hc-btn-outline hc-btn-sm"
            onClick={() => setSelectedHistoryShift(null)}
          >
            Đóng
          </button>
        }
      >
        {selectedHistoryShift && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                padding: "14px",
                background: "var(--hc-bg, #f8fafc)",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "13px",
              }}
            >
              <div>
                <span style={{ color: "var(--hc-text-secondary)" }}>Thu ngân:</span>{" "}
                <strong>{selectedHistoryShift.accountFullName}</strong> ({selectedHistoryShift.accountRole || "Lễ tân"})
              </div>
              <div>
                <span style={{ color: "var(--hc-text-secondary)" }}>Trạng thái:</span>{" "}
                <span className={`hc-badge ${selectedHistoryShift.status === "OPEN" ? "hc-badge-success" : "hc-badge-neutral"}`}>
                  {selectedHistoryShift.status}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--hc-text-secondary)" }}>Bắt đầu:</span>{" "}
                {formatDateTime(selectedHistoryShift.startTime)}
              </div>
              <div>
                <span style={{ color: "var(--hc-text-secondary)" }}>Kết thúc:</span>{" "}
                {selectedHistoryShift.endTime ? formatDateTime(selectedHistoryShift.endTime) : "Đang hoạt động"}
              </div>
              <div>
                <span style={{ color: "var(--hc-text-secondary)" }}>Tiền đầu ca:</span>{" "}
                <strong>{formatVND(selectedHistoryShift.openingCash)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--hc-text-secondary)" }}>Tổng doanh thu:</span>{" "}
                <strong style={{ color: "var(--hc-primary)" }}>{formatVND(selectedHistoryShift.totalRevenue || 0)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: "12px", fontWeight: 700, fontSize: "14px" }}>
              Danh Sách Giao Dịch Trong Ca ({selectedHistoryShift.transactions?.length || 0})
            </div>

            <div style={{ maxHeight: "320px", overflowY: "auto", border: "1px solid var(--hc-border)", borderRadius: "6px" }}>
              {!selectedHistoryShift.transactions || selectedHistoryShift.transactions.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--hc-text-secondary)", fontSize: "13px" }}>
                  Ca này không ghi nhận giao dịch phát sinh nào.
                </div>
              ) : (
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>Mã GD</th>
                      <th>Đơn / Phòng</th>
                      <th>Khách hàng</th>
                      <th>Phương thức</th>
                      <th style={{ textAlign: "right" }}>Số tiền</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHistoryShift.transactions.map((t) => (
                      <tr key={t.paymentId}>
                        <td>#TXN-{t.paymentId}</td>
                        <td>
                          {t.bookingCode ? (
                            <strong>{t.bookingCode}</strong>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{t.customerName || "Khách"}</td>
                        <td>
                          <span className="hc-badge hc-badge-neutral">{t.method}</span>
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: t.type === "REFUND" ? "var(--hc-error)" : "var(--hc-success)",
                          }}
                        >
                          {t.type === "REFUND" ? "-" : "+"}
                          {formatVND(t.amount)}
                        </td>
                        <td>{formatDateTime(t.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
