import React, { useState, useEffect, useCallback, useMemo } from "react";
import Modal from "../../components/common/Modal";
import { apiCall, formatVND, formatDateTime } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import "./StaffShifts.css";
import SelectMenu from "../../components/common/SelectMenu";
import Paginated from "../../components/common/TablePagination";
import { roleLabel } from "../../utils/labels";

const FLOAT_PRESETS = [500000, 1000000, 2000000, 3000000, 5000000];

export default function StaffShiftsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("CURRENT"); // "CURRENT" | "HISTORY"
  const [currentShift, setCurrentShift] = useState(null);
  const [historyShifts, setHistoryShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [, setRefreshing] = useState(false);

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

  const hasRefunds = transactions.some((t) => (t.type || "").toUpperCase() === "REFUND");

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
      </div>

      {/* Tabs Switcher */}
      <div className="hc-tab-group">
        <button type="button" className={`hc-tab-btn ${activeTab === "CURRENT" ? "active" : ""}`} onClick={() => setActiveTab("CURRENT")}>
          <i className="bi bi-wallet2"></i>
          Ca trực hiện tại
        </button>
        <button type="button" className={`hc-tab-btn ${activeTab === "HISTORY" ? "active" : ""}`} onClick={() => setActiveTab("HISTORY")}>
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
                      Ca Thu Ngân Chung Đang Hoạt Động
                    </h3>
                    <div className="sh-shared-sub">
                      Người mở ca: <strong>{currentShift.accountFullName || "Lễ tân"}</strong>{" "}
                      {currentShift.accountRole ? `(${roleLabel(currentShift.accountRole, currentShift.accountRole)})` : ""} · Bắt đầu lúc:{" "}
                      <strong>{formatDateTime(currentShift.startTime)}</strong> ({elapsedText})
                    </div>
                  </div>
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

              </div>

              {/* Shared Transactions Table Card */}
              <div className="hc-card" style={{ marginBottom: "24px" }}>
                <div className="hc-card-header">
                  <div className="sh-txn-toolbar u-w-full">
                    <div className="u-row-10">
                      <div className="hc-card-title" style={{ margin: 0 }}>
                        <i className="bi bi-list-check text-primary u-mr-8"></i>
                        Giao Dịch Chung Phát Sinh Trong Ca
                      </div>
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

                      <div style={{ minWidth: "240px" }}>
                        <SelectMenu
                          ariaLabel="Lọc phương thức thanh toán"
                          icon="bi-funnel"
                          value={txnFilter}
                          onChange={setTxnFilter}
                          options={[
                            { value: "ALL", label: `Tất cả phương thức` },
                            { value: "CASH", label: "Tiền mặt" },
                            { value: "BANK", label: "Chuyển khoản / VietQR" },
                            { value: "CARD", label: "Thẻ tín dụng" },
                            ...(hasRefunds ? [{ value: "REFUND", label: "Hoàn tiền" }] : []),
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hc-card-body flush u-scroll-x">
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
                    <Paginated items={filteredTransactions}>
                      {(pageRows, pager) => (
                        <>
                          <table className="hc-table">
                            <thead>
                              <tr>
                                <th>Mã GD</th>
                                <th>Đơn đặt / Phòng</th>
                                <th>Khách hàng</th>
                                <th>Loại giao dịch</th>
                                <th>Phương thức</th>
                                <th className="u-text-right">Số tiền</th>
                                <th>Thời gian</th>
                                <th>Người thu</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageRows.map((t) => {
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
                                          <strong className="u-text-primary">{t.bookingCode}</strong>
                                          {t.roomNumber && (
                                            <span style={{ marginLeft: "6px", fontSize: "12px", color: "var(--hc-text-secondary)" }}>
                                              (P.{t.roomNumber})
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="u-text-muted">—</span>
                                      )}
                                    </td>
                                    <td>
                                      <div>{t.customerName || "Khách vãng lai"}</div>
                                      {t.note && (
                                        <div className="u-hint-sm">
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
                          {pager}
                        </>
                      )}
                    </Paginated>
                  )}
                </div>
              </div>

              {/* Shift Details & Close Action Footer */}
              <div className="hc-card">
                <div className="hc-card-header">
                  <div className="hc-card-title">
                    <i className="bi bi-file-earmark-text text-primary u-mr-8"></i>
                    Thông Tin Quản Trị Ca Trực
                  </div>
                </div>

                <div className="hc-card-body">
                  <div className="sh-details">
                    <div>
                      <div className="sh-detail-label">Nhân sự phụ trách mở ca:</div>
                      <strong style={{ fontSize: "15px" }}>
                        {currentShift.accountFullName || "Nhân viên lễ tân"}{" "}
                        {currentShift.accountRole ? `(${roleLabel(currentShift.accountRole, currentShift.accountRole)})` : ""}
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
                      <div className="u-text-success u-fw-600">
                        <i className="bi bi-check-all"></i> Đang tiếp nhận mọi giao dịch thanh toán
                      </div>
                    </div>
                  </div>

                  <div className="sh-close-footer">
                    <div className="sh-close-note">
                      <i className="bi bi-info-circle u-mr-4"></i>
                      Cả Lễ tân và Quản lý (Admin) đều có quyền kiểm đếm và đóng ca quyết toán khi kết thúc ca làm việc.
                    </div>

                    <div className="sh-close-actions">
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
                      Tiền mặt bàn giao đầu ca <span className="u-text-error">*</span>
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
              <i className="bi bi-clock-history text-primary u-mr-8"></i>
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

          <div className="hc-card-body flush u-scroll-x">
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
              <Paginated items={historyShifts}>
                {(pageRows, pager) => (
                  <>
                    <table className="hc-table">
                      <thead>
                        <tr>
                          <th>Thu ngân mở ca</th>
                          <th>Thời gian trực</th>
                          <th className="u-text-right">Tiền đầu ca</th>
                          <th className="u-text-right">Doanh thu ca</th>
                          <th className="u-text-right">Tiền bàn giao</th>
                          <th className="u-text-right">Chênh lệch</th>
                          <th>Bàn giao cho</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((sh) => {
                          const opCash = Number(sh.openingCash || 0);
                          const cashRev = Number(sh.totalCashRevenue || 0);
                          const theoCash = opCash + cashRev;
                          const actCash = sh.closingCashActual != null ? Number(sh.closingCashActual) : null;
                          const diffVal = actCash != null ? actCash - theoCash : 0;
                          const isOpen = sh.status === "OPEN";

                          return (
                            <tr
                              key={sh.cashierShiftId}
                              className="row-clickable"
                              tabIndex={0}
                              title="Xem chi tiết giao dịch ca này"
                              onClick={() => setSelectedHistoryShift(sh)}
                              onKeyDown={(e) => {
                                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                  e.preventDefault();
                                  setSelectedHistoryShift(sh);
                                }
                              }}
                            >
                              <td>
                                <div>{sh.accountFullName || "Lễ tân"}</div>
                                {sh.accountRole && (
                                  <div className="u-hint-sm">
                                    {roleLabel(sh.accountRole, sh.accountRole)}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ fontSize: "13px" }}>{formatDateTime(sh.startTime)}</div>
                                <div className="u-hint">
                                  ➔ {sh.endTime ? formatDateTime(sh.endTime) : "Đang hoạt động"}
                                </div>
                              </td>
                              <td className="u-text-right">{formatVND(opCash)}</td>
                              <td style={{ textAlign: "right", fontWeight: 600, color: "var(--hc-primary)" }}>
                                {formatVND(sh.totalRevenue || 0)}
                                <div className="u-hint-sm">
                                  {sh.transactionCount || 0} GD
                                </div>
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>
                                {actCash != null ? formatVND(actCash) : "—"}
                              </td>
                              <td className="u-text-right">
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
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {pager}
                  </>
                )}
              </Paginated>
            )}
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Đối Soát Doanh Thu &amp; Đóng Ca Thu Ngân"
        subtitle="Kiểm đếm tiền mặt và xác nhận kết thúc ca"
        icon="bi-cash-stack"
        maxWidth="540px"
        footer={
          <div className="u-actions-end">
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
              <span className="u-text-secondary">Tiền mặt bàn giao đầu ca (Float):</span>
              <strong>{formatVND(openingCash)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span className="u-text-secondary">Tiền mặt thu thêm trong ca:</span>
              <strong className="u-text-success">+{formatVND(totalCashRevenue)}</strong>
            </div>
            <hr className="hc-divider" style={{ margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "14px" }}>
              <span>Tiền mặt lý thuyết trong két cần bàn giao:</span>
              <span className="u-text-primary">{formatVND(totalPhysicalFund)}</span>
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
              Tiền mặt thực tế kiểm đếm trong két (VNĐ) <span className="u-text-error">*</span>
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
        title={"Chi Tiết Ca Thu Ngân"}
        subtitle={
          selectedHistoryShift
            ? `${selectedHistoryShift.accountFullName || "Thu ngân"} · ${formatDateTime(selectedHistoryShift.startTime)} → ${selectedHistoryShift.endTime ? formatDateTime(selectedHistoryShift.endTime) : "đang hoạt động"}`
            : undefined
        }
        icon="bi-cash-coin"
        maxWidth="760px"
        headerExtra={
          selectedHistoryShift ? (
            <span className={`hc-badge ${selectedHistoryShift.status === "OPEN" ? "hc-badge-success" : "hc-badge-muted"}`}>{selectedHistoryShift.status === "OPEN" ? "Đang mở" : "Đã đóng"}</span>
          ) : null
        }
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setSelectedHistoryShift(null)}>
              Đóng
            </button>
          </div>
        }
      >
        {selectedHistoryShift && (
          <div>
            <div className="u-col-16">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px 18px", fontSize: "13px" }}>
                <div>
                  <small className="u-text-secondary u-block">Thu ngân</small>
                  <strong>{selectedHistoryShift.accountFullName}</strong> ({roleLabel(selectedHistoryShift.accountRole, "Lễ tân")})
                </div>
                <div>
                  <small className="u-text-secondary u-block">Bắt đầu</small>
                  <strong>{formatDateTime(selectedHistoryShift.startTime)}</strong>
                </div>
                <div>
                  <small className="u-text-secondary u-block">Kết thúc</small>
                  <strong>{selectedHistoryShift.endTime ? formatDateTime(selectedHistoryShift.endTime) : "Đang hoạt động"}</strong>
                </div>
                <div>
                  <small className="u-text-secondary u-block">Tiền đầu ca</small>
                  <strong>{formatVND(selectedHistoryShift.openingCash)}</strong>
                </div>
                <div>
                  <small className="u-text-secondary u-block">Tổng doanh thu</small>
                  <strong className="u-text-primary">{formatVND(selectedHistoryShift.totalRevenue || 0)}</strong>
                </div>
              </div>
            </div>

            <div style={{ margin: "18px 0 10px", fontWeight: 700, fontSize: "14px" }}>
              Danh Sách Giao Dịch Trong Ca
            </div>

            <div style={{ maxHeight: "320px", overflowY: "auto", border: "1px solid var(--hc-border)", borderRadius: "var(--hc-radius-sm)" }}>
              {!selectedHistoryShift.transactions || selectedHistoryShift.transactions.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--hc-text-secondary)", fontSize: "13px" }}>
                  Ca này không ghi nhận giao dịch phát sinh nào.
                </div>
              ) : (
                <Paginated items={selectedHistoryShift.transactions}>
                  {(pageRows, pager) => (
                    <>
                      <table className="hc-table">
                        <thead>
                          <tr>
                            <th>Mã GD</th>
                            <th>Đơn / Phòng</th>
                            <th>Khách hàng</th>
                            <th>Phương thức</th>
                            <th className="u-text-right">Số tiền</th>
                            <th>Thời gian</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((t) => (
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
                      {pager}
                    </>
                  )}
                </Paginated>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
