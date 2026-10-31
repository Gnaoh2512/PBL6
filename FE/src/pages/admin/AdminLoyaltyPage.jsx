import React, { useCallback, useEffect, useState } from "react";
import { apiCall, formatVND, formatDateTime } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";

const TIER_COLORS = {
  SEASHELL: "#94a3b8",
  STARFISH: "#f59e0b",
  CORAL: "#f97316",
  PEARL: "#8b5cf6",
};

export default function AdminLoyaltyPage() {
  const { addToast } = useToast();

  // Tier management
  const [tiers, setTiers] = useState([]);
  // Customer loyalty list
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Selected customer for detail / adjust
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);

  // Adjust modal
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ scoreAdjust: "", note: "" });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersRes, customersRes] = await Promise.allSettled([apiCall("/api/admin/loyalty/tiers", { silentError: true }), apiCall("/api/admin/loyalty/customers", { silentError: true })]);
      setTiers(tiersRes.status === "fulfilled" && tiersRes.value?.success ? tiersRes.value.data || [] : []);
      setCustomers(customersRes.status === "fulfilled" && customersRes.value?.success ? customersRes.value.data || [] : []);
    } catch (err) {
      addToast(err.message || "Không thể tải dữ liệu loyalty.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadTransactions = useCallback(async (customerId) => {
    setTxnLoading(true);
    try {
      const res = await apiCall(`/api/admin/loyalty/customers/${customerId}/transactions`, { silentError: true });
      setTransactions(res?.success ? res.data || [] : []);
    } catch {
      setTransactions([]);
    } finally {
      setTxnLoading(false);
    }
  }, []);

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setTransactions([]);
    loadTransactions(customer.customerId);
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const score = Number(adjustForm.scoreAdjust);
    if (isNaN(score) || score === 0) {
      addToast("Vui lòng nhập số điểm cần điều chỉnh (dương để cộng, âm để trừ).", "warning");
      return;
    }
    setAdjustSubmitting(true);
    try {
      const res = await apiCall(`/api/admin/loyalty/customers/${selectedCustomer.customerId}/adjust`, {
        method: "POST",
        body: {
          scoreAdjust: score,
          note: adjustForm.note.trim() || `Điều chỉnh điểm bởi quản trị viên (${score > 0 ? "+" : ""}${score})`,
        },
      });
      if (res?.success) {
        addToast(`Đã điều chỉnh điểm cho ${selectedCustomer.customerName || "khách hàng"}.`, "success");
        setAdjustModal(false);
        setAdjustForm({ scoreAdjust: "", note: "" });
        await loadData();
        loadTransactions(selectedCustomer.customerId);
        if (res.data) setSelectedCustomer(res.data);
      }
    } catch (err) {
      addToast(err.message || "Không thể điều chỉnh điểm.", "error");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const filtered = customers.filter((c) => {
    const matchTier = tierFilter === "ALL" || c.tierCode === tierFilter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || (c.customerName || "").toLowerCase().includes(q) || (c.phone || "").includes(q) || (c.email || "").toLowerCase().includes(q);
    return matchTier && matchSearch;
  });

  const getTierColor = (tierCode) => TIER_COLORS[tierCode] || "#94a3b8";

  const tierFilterOptions = [{ value: "ALL", label: "Tất cả hạng thành viên" }, ...tiers.map((t) => ({ value: t.tierCode, label: t.tierName }))];

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", textAlign: "left" }}>
        <div>
          <h2>Quản Lý Chương Trình Loyalty</h2>
          <p>Xem hạng thành viên, điểm tích lũy và điều chỉnh điểm thưởng cho khách hàng.</p>
        </div>
        <button type="button" className="hc-btn hc-btn-outline" onClick={loadData} disabled={loading}>
          <i className="bi bi-arrow-clockwise"></i> Làm mới
        </button>
      </div>

      {/* Tier Overview Cards */}
      {tiers.length > 0 && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
          {tiers.map((tier) => (
            <div
              key={tier.tierId}
              className="hc-card"
              style={{
                flex: "1 1 140px",
                padding: "16px",
                borderTop: `4px solid ${getTierColor(tier.tierCode)}`,
                minWidth: "140px",
                margin: 0,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "15px", color: getTierColor(tier.tierCode) }}>{tier.tierName}</div>
              <div style={{ fontSize: "12px", color: "var(--hc-text-muted)", marginTop: "4px" }}>Từ {Number(tier.minScore || 0).toLocaleString("vi-VN")} điểm</div>
              <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "8px" }}>
                {customers.filter((c) => c.tierCode === tier.tierCode).length}
                <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--hc-text-muted)", marginLeft: "4px" }}>khách</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selectedCustomer ? "1fr 380px" : "1fr", gap: "20px", alignItems: "start" }}>
        {/* Customer List Card */}
        <div className="hc-card">
          <div className="hc-card-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--hc-border-light)" }}>
            <input
              type="search"
              className="hc-input"
              style={{ flex: "1 1 240px" }}
              placeholder="Tên, SĐT, email..."
              aria-label="Tìm kiếm hội viên"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ flex: "0 0 220px" }}>
              <SelectMenu value={tierFilter} onChange={setTierFilter} options={tierFilterOptions} ariaLabel="Lọc hạng thành viên" icon="bi-funnel" />
            </div>
          </div>

          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-people"></i>
              <p>Không tìm thấy hội viên nào.</p>
            </div>
          ) : (
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Hạng</th>
                    <th>Điểm</th>
                    <th>Ngày lưu trú</th>
                    <th>Tổng chi tiêu</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isSelected = selectedCustomer?.customerId === c.customerId;
                    return (
                      <tr key={c.customerId} style={{ cursor: "pointer", background: isSelected ? "var(--hc-bg-light, rgba(2, 132, 199, 0.06))" : undefined }} onClick={() => selectCustomer(c)}>
                        <td>
                          <strong>{c.customerName || "—"}</strong>
                          <br />
                          <small style={{ color: "var(--hc-text-secondary)" }}>{c.phone || c.email || "—"}</small>
                        </td>
                        <td>
                          <span
                            style={{
                              background: getTierColor(c.tierCode),
                              color: "#fff",
                              borderRadius: "12px",
                              padding: "2px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {c.tierCode || "—"}
                          </span>
                        </td>
                        <td>
                          <strong>{Number(c.totalScore || 0).toLocaleString("vi-VN")}</strong>
                        </td>
                        <td>{c.totalStayDays || 0} đêm</td>
                        <td>{formatVND(c.totalSpent || 0)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectCustomer(c);
                              setAdjustModal(true);
                              setAdjustForm({ scoreAdjust: "", note: "" });
                            }}
                            title="Điều chỉnh điểm"
                          >
                            <i className="bi bi-plus-slash-minus"></i> Điều chỉnh
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer Detail Panel */}
        {selectedCustomer && (
          <div className="hc-card" style={{ position: "sticky", top: "20px" }}>
            <div className="hc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>{selectedCustomer.customerName || "Chi tiết hội viên"}</div>
                <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)" }}>{selectedCustomer.phone || selectedCustomer.email || ""}</div>
              </div>
              <button
                type="button"
                className="hc-btn hc-btn-primary hc-btn-sm"
                onClick={() => {
                  setAdjustModal(true);
                  setAdjustForm({ scoreAdjust: "", note: "" });
                }}
              >
                <i className="bi bi-plus-slash-minus"></i> Sửa điểm
              </button>
            </div>
            <div className="hc-card-body" style={{ padding: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                {[
                  { label: "Hạng hiện tại", value: selectedCustomer.tierCode, color: getTierColor(selectedCustomer.tierCode) },
                  { label: "Điểm tích lũy", value: `${Number(selectedCustomer.totalScore || 0).toLocaleString("vi-VN")} điểm` },
                  { label: "Tổng đêm lưu trú", value: `${selectedCustomer.totalStayDays || 0} đêm` },
                  { label: "Tổng chi tiêu", value: formatVND(selectedCustomer.totalSpent || 0) },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "var(--hc-bg-light, #f8fafc)", borderRadius: "8px", padding: "10px 12px", border: "1px solid var(--hc-border-light)" }}>
                    <div style={{ fontSize: "11px", color: "var(--hc-text-secondary)", marginBottom: "4px" }}>{stat.label}</div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: stat.color || "inherit" }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Lịch sử giao dịch điểm</div>
              {txnLoading ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--hc-text-secondary)", fontSize: "13px" }}>Đang tải...</div>
              ) : transactions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "var(--hc-text-secondary)", fontSize: "13px" }}>Chưa có lịch sử giao dịch điểm.</div>
              ) : (
                <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                  {transactions.slice(0, 20).map((txn) => (
                    <div
                      key={txn.txnId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--hc-border-light)",
                        fontSize: "13px",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{txn.txnType === "EARN" ? "Tích điểm" : "Điều chỉnh"}</div>
                        <div style={{ color: "var(--hc-text-secondary)", fontSize: "11px" }}>{formatDateTime(txn.createdAt)}</div>
                        {txn.note && <div style={{ color: "var(--hc-text-secondary)", fontSize: "11px" }}>{txn.note}</div>}
                      </div>
                      <div style={{ fontWeight: 700, color: Number(txn.scoreEarned) >= 0 ? "var(--hc-success)" : "var(--hc-error)" }}>
                        {Number(txn.scoreEarned) >= 0 ? "+" : ""}
                        {Number(txn.scoreEarned || 0).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      <Modal
        isOpen={adjustModal}
        onClose={() => setAdjustModal(false)}
        title={`Điều Chỉnh Điểm: ${selectedCustomer?.customerName || ""}`}
        subtitle={`Cộng hoặc trừ điểm thưởng tích lũy cho khách hàng`}
        icon="bi-plus-slash-minus"
        maxWidth="480px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setAdjustModal(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleAdjust} disabled={adjustSubmitting}>
              {adjustSubmitting ? "Đang xử lý..." : "Xác nhận điều chỉnh"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAdjust}>
          <div style={{ fontSize: "13px", color: "var(--hc-text-secondary)", marginBottom: "16px" }}>
            Điểm hiện tại: <strong>{Number(selectedCustomer?.totalScore || 0).toLocaleString("vi-VN")} điểm</strong>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Số điểm điều chỉnh <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input
              type="number"
              className="hc-input"
              placeholder="Ví dụ: 100 (cộng) hoặc -50 (trừ)"
              value={adjustForm.scoreAdjust}
              onChange={(e) => setAdjustForm({ ...adjustForm, scoreAdjust: e.target.value })}
              required
            />
            <small style={{ color: "var(--hc-text-secondary)", fontSize: "11px", marginTop: "4px", display: "block" }}>Nhập số dương để cộng điểm, số âm để trừ điểm.</small>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Lý do / Ghi chú</label>
            <textarea
              className="hc-textarea"
              rows={3}
              placeholder="Nhập lý do điều chỉnh điểm..."
              value={adjustForm.note}
              onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
            ></textarea>
          </div>
        </form>
      </Modal>
    </div>
  );
}
