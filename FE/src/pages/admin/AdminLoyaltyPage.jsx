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

const unwrapList = (res) => {
  if (Array.isArray(res)) return res;
  const d = res && typeof res === "object" && "data" in res ? res.data : res;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.content)) return d.content;
  if (Array.isArray(d?.items)) return d.items;
  return [];
};

const readList = (settled, fallbackMsg) => {
  if (settled.status === "rejected") return { list: [], error: settled.reason?.message || fallbackMsg };
  const res = settled.value;
  if (res == null) return { list: [], error: fallbackMsg };
  if (res.success === false) return { list: [], error: res.message || fallbackMsg };
  return { list: unwrapList(res), error: null };
};

const toDateInput = (v) => {
  if (!v) return "";
  if (Array.isArray(v)) {
    const [y, m = 1, d = 1] = v;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return String(v).slice(0, 10);
};

const normalizeTier = (t) => ({
  ...t,
  tierId: t.tierId ?? t.tier_id ?? t.id,
  tierCode: t.tierCode ?? t.tier_code ?? t.code,
  tierName: t.tierName ?? t.tier_name ?? t.name ?? t.tierCode,
  minScore: t.minScore ?? t.min_score ?? 0,
  tierLevel: t.tierLevel ?? t.tier_level ?? t.level ?? 1,
  description: t.description ?? "",
});

// Every guest is shown. A guest without a loyalty record falls back to the lowest tier.
const normalizeCustomer = (c, lowestTier) => {
  const tierCode = c.tierCode ?? c.tier_code ?? c.tier?.tierCode ?? lowestTier?.tierCode ?? "";
  return {
    ...c,
    customerId: c.customerId ?? c.customer_id ?? c.id,
    customerName: c.customerName ?? c.fullName ?? c.full_name ?? c.name ?? "",
    fullName: c.fullName ?? c.full_name ?? c.customerName ?? c.name ?? "",
    phone: c.phone ?? c.phoneNumber ?? "",
    email: c.email ?? "",
    idType: c.idType ?? c.id_type ?? "",
    idNumber: c.idNumber ?? c.id_number ?? "",
    idIssueDate: toDateInput(c.idIssueDate ?? c.id_issue_date),
    idIssuePlace: c.idIssuePlace ?? c.id_issue_place ?? "",
    nationality: c.nationality ?? "",
    tierCode,
    tierName: c.tierName ?? c.tier_name ?? c.tier?.tierName ?? lowestTier?.tierName ?? tierCode,
    totalScore: c.totalScore ?? c.currentScore ?? c.total_score ?? 0,
    totalStayDays: c.totalStayDays ?? c.total_stay_days ?? 0,
    totalSpent: c.totalSpent ?? c.total_spent ?? 0,
  };
};

export default function AdminLoyaltyPage() {
  const { addToast } = useToast();

  // Tier management
  const [tiers, setTiers] = useState([]);
  // Customer loyalty list
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Selected customer for detail / adjust
  const [selectedId, setSelectedId] = useState(null);
  const selectedCustomer = customers.find((c) => c.customerId === selectedId) || null;
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);

  // Adjust modal
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ scoreAdjust: "", note: "" });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Tier (loyalty level) edit modal
  const [tierModal, setTierModal] = useState(false);
  const [tierTarget, setTierTarget] = useState(null);
  const [tierForm, setTierForm] = useState({ tierName: "", tierLevel: "", minScore: "", description: "" });
  const [tierSubmitting, setTierSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const [tiersRes, customersRes] = await Promise.allSettled([apiCall("/api/admin/loyalty/tiers", { silentError: true }), apiCall("/api/admin/loyalty/customers", { silentError: true })]);
    const t = readList(tiersRes, "Không thể tải danh sách hạng thành viên.");
    const c = readList(customersRes, "Không thể tải danh sách khách hàng.");

    // Temporary diagnostics: DevTools > Console shows what the API returned
    console.debug("[AdminLoyalty] tiers ->", tiersRes);
    console.debug("[AdminLoyalty] customers ->", customersRes);

    const tierList = t.list.map(normalizeTier).sort((a, b) => Number(a.minScore) - Number(b.minScore));
    setTiers(tierList);
    setCustomers(c.list.map((row) => normalizeCustomer(row, tierList[0])));
    setLoadError(c.error || t.error || "");
    setLoading(false);
  }, []);

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
    setSelectedId(customer.customerId);
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
      const res = await apiCall(`/api/admin/loyalty/adjust-points`, {
        method: "POST",
        body: {
          customerId: selectedCustomer.customerId,
          points: score,
          note: adjustForm.note.trim() || `Điều chỉnh điểm bởi quản trị viên (${score > 0 ? "+" : ""}${score})`,
        },
      });
      if (res?.success) {
        addToast(`Đã điều chỉnh điểm cho ${selectedCustomer.customerName || "khách hàng"}.`, "success");
        setAdjustModal(false);
        setAdjustForm({ scoreAdjust: "", note: "" });
        await loadData();
        loadTransactions(selectedCustomer.customerId);
      }
    } catch (err) {
      addToast(err.message || "Không thể điều chỉnh điểm.", "error");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const openEdit = (customer) => {
    setSelectedId(customer.customerId);
    setEditForm({
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      idType: customer.idType,
      idNumber: customer.idNumber,
      idIssueDate: customer.idIssueDate,
      idIssuePlace: customer.idIssuePlace,
      nationality: customer.nationality,
      tierCode: customer.tierCode || tiers[0]?.tierCode || "",
      totalScore: String(customer.totalScore ?? 0),
      totalStayDays: String(customer.totalStayDays ?? 0),
      totalSpent: String(customer.totalSpent ?? 0),
    });
    loadTransactions(customer.customerId);
    setEditModal(true);
  };

  const saveCustomer = async (e) => {
    e?.preventDefault?.();
    if (!selectedCustomer) return;
    if (!String(editForm.fullName || "").trim()) {
      addToast("Vui lòng nhập họ và tên.", "warning");
      return;
    }
    setEditSubmitting(true);
    try {
      const body = {
        ...editForm,
        fullName: editForm.fullName.trim(),
        idIssueDate: editForm.idIssueDate || null,
        totalScore: Number(editForm.totalScore) || 0,
        totalStayDays: Number(editForm.totalStayDays) || 0,
        totalSpent: Number(editForm.totalSpent) || 0,
      };
      const res = await apiCall(`/api/admin/loyalty/customers/${selectedCustomer.customerId}`, { method: "PUT", body });
      if (res?.success !== false) {
        addToast("Đã cập nhật thông tin khách hàng.", "success");
        setEditModal(false);
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Không thể cập nhật khách hàng.", "error");
    } finally {
      setEditSubmitting(false);
    }
  };

  const openTierEdit = (tierCode) => {
    const tier = tiers.find((t) => t.tierCode === tierCode);
    if (!tier) {
      addToast("Không tìm thấy thông tin hạng này.", "warning");
      return;
    }
    setTierTarget(tier);
    setTierForm({
      tierName: tier.tierName || "",
      tierLevel: String(tier.tierLevel ?? ""),
      minScore: String(tier.minScore ?? 0),
      description: tier.description || "",
    });
    setTierModal(true);
  };

  const saveTier = async (e) => {
    e?.preventDefault?.();
    if (!tierTarget) return;
    if (!tierForm.tierName.trim()) {
      addToast("Vui lòng nhập tên hạng.", "warning");
      return;
    }
    const level = Number(tierForm.tierLevel);
    const minScore = Number(tierForm.minScore);
    if (!Number.isInteger(level) || level < 1) {
      addToast("Cấp độ hạng phải là số nguyên từ 1 trở lên.", "warning");
      return;
    }
    if (isNaN(minScore) || minScore < 0) {
      addToast("Điểm tối thiểu phải là số không âm.", "warning");
      return;
    }
    setTierSubmitting(true);
    try {
      const res = await apiCall(`/api/admin/loyalty/tiers/${tierTarget.tierId}`, {
        method: "PUT",
        body: { tierName: tierForm.tierName.trim(), tierLevel: level, minScore, description: tierForm.description.trim() },
      });
      if (res?.success !== false) {
        addToast(`Đã cập nhật hạng ${tierForm.tierName.trim()}.`, "success");
        setTierModal(false);
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Không thể cập nhật hạng thành viên.", "error");
    } finally {
      setTierSubmitting(false);
    }
  };

  const filtered = customers.filter((c) => {
    const matchTier = tierFilter === "ALL" || c.tierCode === tierFilter;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      [c.customerName, c.phone, c.email, c.idNumber, c.nationality, c.tierName, c.tierCode].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(q),
      );
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
              role="button"
              tabIndex={0}
              title="Bấm để chỉnh sửa hạng này"
              onClick={() => openTierEdit(tier.tierCode)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTierEdit(tier.tierCode);
                }
              }}
              style={{
                flex: "1 1 140px",
                padding: "16px",
                borderTop: `4px solid ${getTierColor(tier.tierCode)}`,
                minWidth: "140px",
                margin: 0,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "15px", color: getTierColor(tier.tierCode), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {tier.tierName}
                <i className="bi bi-pencil" style={{ fontSize: "12px", opacity: 0.6 }}></i>
              </div>
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
              placeholder="Tên, SĐT, email, số giấy tờ, quốc tịch, hạng..."
              aria-label="Tìm kiếm hội viên"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ flex: "0 0 220px" }}>
              <SelectMenu value={tierFilter} onChange={setTierFilter} options={tierFilterOptions} ariaLabel="Lọc hạng thành viên" icon="bi-funnel" />
            </div>
          </div>

          {loadError && !loading && (
            <div
              role="alert"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                color: "var(--hc-error)",
                borderBottom: "1px solid var(--hc-border-light)",
              }}
            >
              <span>
                <i className="bi bi-exclamation-triangle"></i> {loadError}
              </span>
              <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={loadData}>
                Thử lại
              </button>
            </div>
          )}

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
                          <small style={{ color: "var(--hc-text-secondary)" }}>{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</small>
                          <br />
                          <small style={{ color: "var(--hc-text-muted)" }}>{[c.idNumber && `${c.idType || "Giấy tờ"}: ${c.idNumber}`, c.nationality].filter(Boolean).join(" · ")}</small>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTierEdit(c.tierCode);
                            }}
                            title="Bấm để chỉnh sửa hạng này"
                            style={{ border: 0, cursor: "pointer", background: getTierColor(c.tierCode), color: "#fff", borderRadius: "12px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}
                          >
                            {c.tierName || c.tierCode || "—"}
                          </button>
                        </td>
                        <td>
                          <strong>{Number(c.totalScore || 0).toLocaleString("vi-VN")}</strong>
                        </td>
                        <td>{c.totalStayDays || 0} đêm</td>
                        <td>{formatVND(c.totalSpent || 0)}</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            style={{ marginRight: 6 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(c);
                            }}
                            title="Chỉnh sửa thông tin khách hàng"
                          >
                            <i className="bi bi-pencil"></i> Sửa
                          </button>
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
                  { label: "Hạng hiện tại", value: selectedCustomer.tierName || selectedCustomer.tierCode, color: getTierColor(selectedCustomer.tierCode) },
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
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={`Chỉnh sửa khách hàng: ${selectedCustomer?.customerName || ""}`}
        subtitle="Cập nhật thông tin cá nhân, giấy tờ, hạng và điểm của khách"
        icon="bi-person-lines-fill"
        maxWidth="680px"
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setEditModal(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={saveCustomer} disabled={editSubmitting}>
              {editSubmitting ? "Đang lưu..." : "Lưu thông tin"}
            </button>
          </div>
        }
      >
        <form onSubmit={saveCustomer}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Thông tin cá nhân</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              ["fullName", "Họ và tên", "text", true],
              ["phone", "Số điện thoại", "tel"],
              ["email", "Email", "email"],
              ["nationality", "Quốc tịch", "text"],
              ["idType", "Loại giấy tờ", "text", false, "id-type-options"],
              ["idNumber", "Số giấy tờ", "text"],
              ["idIssueDate", "Ngày cấp", "date"],
              ["idIssuePlace", "Nơi cấp", "text"],
            ].map(([key, label, type, required, list]) => (
              <div className="hc-form-group" key={key}>
                <label className="hc-label">
                  {label} {required && <span style={{ color: "var(--hc-error)" }}>*</span>}
                </label>
                <input className="hc-input" type={type} list={list} value={editForm[key] || ""} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <datalist id="id-type-options">
            <option value="CCCD" />
            <option value="CMND" />
            <option value="PASSPORT" />
          </datalist>

          <div style={{ fontWeight: 600, fontSize: 13, margin: "8px 0" }}>Hạng &amp; điểm tích lũy</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div className="hc-form-group">
              <label className="hc-label">Hạng thành viên</label>
              <SelectMenu
                value={editForm.tierCode || ""}
                onChange={(tierCode) => setEditForm({ ...editForm, tierCode })}
                options={tiers.map((tier) => ({ value: tier.tierCode, label: `${tier.tierName} (từ ${Number(tier.minScore || 0).toLocaleString("vi-VN")} điểm)` }))}
                ariaLabel="Hạng thành viên"
                icon="bi-gem"
              />
            </div>
            {[
              ["totalScore", "Điểm tích lũy"],
              ["totalStayDays", "Tổng đêm lưu trú"],
              ["totalSpent", "Tổng chi tiêu (VND)"],
            ].map(([key, label]) => (
              <div className="hc-form-group" key={key}>
                <label className="hc-label">{label}</label>
                <input className="hc-input" type="number" min="0" value={editForm[key] ?? ""} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <small style={{ color: "var(--hc-text-secondary)", fontSize: 11 }}>Muốn cộng/trừ điểm và lưu lý do trong lịch sử, hãy dùng nút "Điều chỉnh" ở danh sách.</small>
        </form>
      </Modal>
      {/* Tier edit modal */}
      <Modal
        isOpen={tierModal}
        onClose={() => setTierModal(false)}
        title={`Chỉnh sửa hạng: ${tierTarget?.tierName || ""}`}
        subtitle="Cập nhật tên, cấp độ, điểm tối thiểu và mô tả của hạng thành viên"
        icon="bi-gem"
        maxWidth="520px"
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setTierModal(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={saveTier} disabled={tierSubmitting}>
              {tierSubmitting ? "Đang lưu..." : "Lưu hạng"}
            </button>
          </div>
        }
      >
        <form onSubmit={saveTier}>
          <div className="hc-form-group">
            <label className="hc-label">Mã hạng</label>
            <input className="hc-input" type="text" value={tierTarget?.tierCode || ""} disabled readOnly />
            <small style={{ color: "var(--hc-text-secondary)", fontSize: 11 }}>Mã hạng dùng để liên kết trong hệ thống nên không thể đổi.</small>
          </div>
          <div className="hc-form-group">
            <label className="hc-label">
              Tên hạng <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input className="hc-input" type="text" value={tierForm.tierName} onChange={(e) => setTierForm({ ...tierForm, tierName: e.target.value })} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div className="hc-form-group">
              <label className="hc-label">Cấp độ (thứ tự hạng)</label>
              <input className="hc-input" type="number" min="1" step="1" value={tierForm.tierLevel} onChange={(e) => setTierForm({ ...tierForm, tierLevel: e.target.value })} />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Điểm tối thiểu</label>
              <input className="hc-input" type="number" min="0" step="any" value={tierForm.minScore} onChange={(e) => setTierForm({ ...tierForm, minScore: e.target.value })} />
            </div>
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Mô tả</label>
            <textarea
              className="hc-textarea"
              rows={3}
              value={tierForm.description}
              onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
              placeholder="Quyền lợi hoặc ghi chú về hạng này..."
            ></textarea>
          </div>
          <small style={{ color: "var(--hc-text-secondary)", fontSize: 11 }}>
            Hiện có {customers.filter((c) => c.tierCode === tierTarget?.tierCode).length} khách ở hạng này. Đổi điểm tối thiểu không xếp hạng lại khách ngay; hạng được tính lại khi điểm của khách thay
            đổi.
          </small>
        </form>
      </Modal>
    </div>
  );
}
