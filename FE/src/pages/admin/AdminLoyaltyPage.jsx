import React, { useCallback, useEffect, useMemo, useState } from "react";
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

  // =========================================================================
  // TIER BENEFITS (ĐẶC QUYỀN HỘI VIÊN) STATE
  // =========================================================================
  const [benefits, setBenefits] = useState([]);
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [benefitTierFilter, setBenefitTierFilter] = useState("ALL");
  const [benefitTypeFilter, setBenefitTypeFilter] = useState("ALL");
  const [benefitSearch, setBenefitSearch] = useState("");

  // External options for dropdowns (services & room types)
  const [services, setServices] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);

  // Benefit Modal State
  const [benefitModal, setBenefitModal] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState(null);
  const [benefitForm, setBenefitForm] = useState({
    tierId: "",
    benefitName: "",
    benefitType: "ROOM_DISCOUNT",
    discountPercent: "10",
    serviceId: "",
    roomTypeId: "",
    quota: "",
    periodType: "YEAR",
    isActive: true,
    description: "",
  });
  const [benefitSubmitting, setBenefitSubmitting] = useState(false);

  // Load benefits from API
  const loadBenefits = useCallback(async () => {
    setBenefitsLoading(true);
    try {
      const res = await apiCall("/api/admin/loyalty/benefits", { silentError: true });
      setBenefits(unwrapList(res));
    } catch {
      setBenefits([]);
    } finally {
      setBenefitsLoading(false);
    }
  }, []);

  // Load services and room types for benefit modal
  const loadServicesAndRoomTypes = useCallback(async () => {
    try {
      const [svcRes, rtRes] = await Promise.allSettled([
        apiCall("/api/admin/services", { silentError: true }),
        apiCall("/api/public/rooms/room-types", { silentError: true }),
      ]);
      if (svcRes.status === "fulfilled") {
        setServices(unwrapList(svcRes.value));
      }
      if (rtRes.status === "fulfilled") {
        setRoomTypes(unwrapList(rtRes.value));
      }
    } catch {
      // silent
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const [tiersRes, customersRes] = await Promise.allSettled([
      apiCall("/api/admin/loyalty/tiers", { silentError: true }),
      apiCall("/api/admin/loyalty/customers", { silentError: true }),
    ]);
    const t = readList(tiersRes, "Không thể tải danh sách hạng thành viên.");
    const c = readList(customersRes, "Không thể tải danh sách khách hàng.");

    const tierList = t.list.map(normalizeTier).sort((a, b) => Number(a.minScore) - Number(b.minScore));
    setTiers(tierList);
    setCustomers(c.list.map((row) => normalizeCustomer(row, tierList[0])));
    setLoadError(c.error || t.error || "");
    setLoading(false);

    loadBenefits();
    loadServicesAndRoomTypes();
  }, [loadBenefits, loadServicesAndRoomTypes]);

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

  // =========================================================================
  // TIER BENEFIT CRUD ACTIONS
  // =========================================================================
  const openCreateBenefit = () => {
    setEditingBenefit(null);
    setBenefitForm({
      tierId: tiers[0]?.tierId ? String(tiers[0].tierId) : "",
      benefitName: "",
      benefitType: "ROOM_DISCOUNT",
      discountPercent: "10",
      serviceId: services[0]?.serviceId ? String(services[0].serviceId) : "",
      roomTypeId: roomTypes[0]?.roomTypeId ? String(roomTypes[0].roomTypeId) : "",
      quota: "",
      periodType: "YEAR",
      isActive: true,
      description: "",
    });
    setBenefitModal(true);
  };

  const openEditBenefit = (b) => {
    setEditingBenefit(b);
    setBenefitForm({
      tierId: b.tierId ? String(b.tierId) : "",
      benefitName: b.benefitName || "",
      benefitType: b.benefitType || "ROOM_DISCOUNT",
      discountPercent: b.discountPercent != null ? String(b.discountPercent) : "",
      serviceId: b.serviceId ? String(b.serviceId) : "",
      roomTypeId: b.roomTypeId ? String(b.roomTypeId) : "",
      quota: b.quota != null ? String(b.quota) : "",
      periodType: b.periodType || "YEAR",
      isActive: b.isActive ?? true,
      description: b.description || "",
    });
    setBenefitModal(true);
  };

  const saveBenefit = async (e) => {
    e?.preventDefault?.();
    if (!benefitForm.benefitName.trim()) {
      addToast("Vui lòng nhập tên đặc quyền.", "warning");
      return;
    }
    if (!benefitForm.tierId) {
      addToast("Vui lòng chọn hạng thành viên áp dụng.", "warning");
      return;
    }

    if (benefitForm.benefitType === "ROOM_DISCOUNT") {
      const discount = Number(benefitForm.discountPercent);
      if (isNaN(discount) || discount <= 0 || discount > 100) {
        addToast("Phần trăm giảm giá phòng phải từ 1% đến 100%.", "warning");
        return;
      }
    }

    setBenefitSubmitting(true);
    try {
      const payload = {
        tierId: Number(benefitForm.tierId),
        benefitName: benefitForm.benefitName.trim(),
        benefitType: benefitForm.benefitType,
        discountPercent: benefitForm.benefitType === "ROOM_DISCOUNT" && benefitForm.discountPercent ? Number(benefitForm.discountPercent) : null,
        serviceId: benefitForm.benefitType === "FREE_SERVICE" && benefitForm.serviceId ? Number(benefitForm.serviceId) : null,
        roomTypeId: benefitForm.benefitType === "FREE_NIGHT" && benefitForm.roomTypeId ? Number(benefitForm.roomTypeId) : null,
        quota: benefitForm.quota !== "" && benefitForm.quota != null ? Math.max(1, Number(benefitForm.quota)) : null,
        periodType: benefitForm.periodType || "YEAR",
        isActive: Boolean(benefitForm.isActive),
        description: benefitForm.description.trim() || null,
      };

      const url = editingBenefit ? `/api/admin/loyalty/benefits/${editingBenefit.tierBenefitId}` : "/api/admin/loyalty/benefits";
      const method = editingBenefit ? "PUT" : "POST";

      const res = await apiCall(url, { method, body: payload });
      if (res?.success !== false) {
        addToast(editingBenefit ? "Cập nhật đặc quyền thành công." : "Thêm đặc quyền mới thành công.", "success");
        setBenefitModal(false);
        loadBenefits();
      }
    } catch (err) {
      addToast(err?.message || "Không thể lưu đặc quyền.", "error");
    } finally {
      setBenefitSubmitting(false);
    }
  };

  const deleteBenefit = async (b) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đặc quyền "${b.benefitName}"?`)) return;
    try {
      const res = await apiCall(`/api/admin/loyalty/benefits/${b.tierBenefitId}`, { method: "DELETE" });
      if (res?.success !== false) {
        addToast("Đã xóa đặc quyền thành công.", "success");
        loadBenefits();
      }
    } catch (err) {
      addToast(err?.message || "Không thể xóa đặc quyền.", "error");
    }
  };

  const toggleBenefitActive = async (b) => {
    const nextStatus = !b.isActive;
    try {
      const res = await apiCall(`/api/admin/loyalty/benefits/${b.tierBenefitId}`, {
        method: "PUT",
        body: { isActive: nextStatus },
      });
      if (res?.success !== false) {
        addToast(`Đã ${nextStatus ? "kích hoạt" : "tạm dừng"} đặc quyền "${b.benefitName}".`, "success");
        loadBenefits();
      }
    } catch (err) {
      addToast(err?.message || "Không thể thay đổi trạng thái đặc quyền.", "error");
    }
  };

  // Filter customers
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

  // Filter benefits
  const filteredBenefits = useMemo(() => {
    return benefits.filter((b) => {
      const matchTier = benefitTierFilter === "ALL" || String(b.tierId) === String(benefitTierFilter) || b.tierCode === benefitTierFilter;
      const matchType = benefitTypeFilter === "ALL" || b.benefitType === benefitTypeFilter;
      const q = benefitSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (b.benefitName && b.benefitName.toLowerCase().includes(q)) ||
        (b.description && b.description.toLowerCase().includes(q)) ||
        (b.tierName && b.tierName.toLowerCase().includes(q)) ||
        (b.serviceName && b.serviceName.toLowerCase().includes(q)) ||
        (b.roomTypeName && b.roomTypeName.toLowerCase().includes(q));
      return matchTier && matchType && matchSearch;
    });
  }, [benefits, benefitTierFilter, benefitTypeFilter, benefitSearch]);

  const getTierColor = (tierCode) => TIER_COLORS[tierCode] || "#94a3b8";

  const tierFilterOptions = [{ value: "ALL", label: "Tất cả hạng thành viên" }, ...tiers.map((t) => ({ value: t.tierCode, label: t.tierName }))];

  const benefitTierFilterOptions = useMemo(
    () => [{ value: "ALL", label: "Tất cả các hạng" }, ...tiers.map((t) => ({ value: String(t.tierId), label: t.tierName }))],
    [tiers],
  );

  const benefitTypeFilterOptions = [
    { value: "ALL", label: "Tất cả loại đặc quyền" },
    { value: "ROOM_DISCOUNT", label: "Giảm giá phòng" },
    { value: "FREE_SERVICE", label: "Miễn phí dịch vụ" },
    { value: "FREE_NIGHT", label: "Đêm nghỉ miễn phí" },
  ];

  const renderBenefitTypeBadge = (b) => {
    switch (b.benefitType) {
      case "ROOM_DISCOUNT":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: "12px", background: "#f3e8ff", color: "#7e22ce", fontSize: 11, fontWeight: 700 }}>
            <i className="bi bi-tag-fill"></i> Giảm {b.discountPercent ? `${Number(b.discountPercent)}%` : ""} tiền phòng
          </span>
        );
      case "FREE_SERVICE":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: "12px", background: "#e0f2fe", color: "#0369a1", fontSize: 11, fontWeight: 700 }}>
            <i className="bi bi-stars"></i> Miễn phí DV {b.serviceName ? `(${b.serviceName})` : ""}
          </span>
        );
      case "FREE_NIGHT":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: "12px", background: "#fef3c7", color: "#b45309", fontSize: 11, fontWeight: 700 }}>
            <i className="bi bi-moon-stars-fill"></i> Đêm nghỉ miễn phí {b.roomTypeName ? `(${b.roomTypeName})` : ""}
          </span>
        );
      default:
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: "12px", background: "#f1f5f9", color: "#475569", fontSize: 11, fontWeight: 700 }}>
            {b.benefitType}
          </span>
        );
    }
  };

  const renderQuotaDisplay = (b) => {
    if (b.quota == null || b.quota === "") {
      return <span style={{ color: "var(--hc-success, #16a34a)", fontWeight: 600 }}>Không giới hạn</span>;
    }
    const periodLabel = b.periodType === "DAY" ? "ngày" : b.periodType === "MONTH" ? "tháng" : "năm";
    return (
      <span>
        <strong>{b.quota} lượt</strong> <small className="u-text-muted">/ {periodLabel}</small>
      </span>
    );
  };

  return (
    <div className="ops-page">
      <div className="hc-page-title u-bar">
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

      {/* Main Grid: Left Column (Customers + Tier Benefits) | Right Column (Customer Detail if selected) */}
      <div style={{ display: "grid", gridTemplateColumns: selectedCustomer ? "1fr 380px" : "1fr", gap: "20px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
          {/* =========================================================================
             CARD 1: DANH SÁCH KHÁCH HÀNG
             ========================================================================= */}
          <div className="hc-card">
            <div className="hc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--hc-border-light)" }}>
              <div>
                <h3 className="hc-card-title" style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                  <i className="bi bi-people u-text-primary u-mr-6"></i>
                  Danh sách Khách hàng ({filtered.length})
                </h3>
              </div>
            </div>

            <div className="hc-card-body u-row-ruled">
              <input
                type="search"
                className="hc-input u-flex-240"
                placeholder="Tên, SĐT, email, số giấy tờ, quốc tịch, hạng..."
                aria-label="Tìm kiếm hội viên"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="u-flex-220">
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
              <div className="hc-card-body flush u-scroll-x">
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Hạng</th>
                      <th>Điểm</th>
                      <th>Ngày lưu trú</th>
                      <th>Tổng chi tiêu</th>
                      <th className="u-text-right">Thao tác</th>
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
                            <small className="u-text-secondary">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</small>
                            <br />
                            <small className="u-text-muted">{[c.idNumber && `${c.idType || "Giấy tờ"}: ${c.idNumber}`, c.nationality].filter(Boolean).join(" · ")}</small>
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
                          <td className="u-text-right u-nowrap">
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm u-mr-6"
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

          {/* =========================================================================
             CARD 2: BẢNG CRUD ĐẶC QUYỀN HỘI VIÊN (TIER BENEFITS)
             Nằm ngay bên dưới danh sách Khách hàng theo đúng yêu cầu đề bài
             ========================================================================= */}
          <div className="hc-card">
            <div className="hc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--hc-border-light)" }}>
              <div>
                <h3 className="hc-card-title" style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <i className="bi bi-gift u-text-primary"></i>
                  Đặc quyền hội viên ({filteredBenefits.length})
                </h3>
                <span style={{ fontSize: "12.5px", color: "var(--hc-text-muted)" }}>
                  Cấu hình các ưu đãi, giảm giá phòng và dịch vụ miễn phí tự động theo hạng thành viên.
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={loadBenefits} disabled={benefitsLoading} title="Làm mới đặc quyền">
                  <i className={`bi bi-arrow-clockwise${benefitsLoading ? " admin-schedule-spin" : ""}`}></i> Làm mới
                </button>
                <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={openCreateBenefit}>
                  <i className="bi bi-plus-lg"></i> Thêm đặc quyền
                </button>
              </div>
            </div>

            {/* Filter Toolbar for Benefits */}
            <div className="hc-card-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--hc-border-light)", background: "var(--hc-bg-subtle, #f8fafc)" }}>
              <input
                type="search"
                className="hc-input u-flex-200"
                placeholder="Tìm tên đặc quyền, dịch vụ, mô tả..."
                value={benefitSearch}
                onChange={(e) => setBenefitSearch(e.target.value)}
              />
              <div style={{ flex: "0 1 180px", minWidth: 160 }}>
                <SelectMenu value={benefitTierFilter} onChange={setBenefitTierFilter} options={benefitTierFilterOptions} ariaLabel="Lọc theo hạng" icon="bi-gem" />
              </div>
              <div style={{ flex: "0 1 200px", minWidth: 170 }}>
                <SelectMenu value={benefitTypeFilter} onChange={setBenefitTypeFilter} options={benefitTypeFilterOptions} ariaLabel="Lọc theo loại" icon="bi-funnel" />
              </div>
            </div>

            {/* Benefits Table */}
            {benefitsLoading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : filteredBenefits.length === 0 ? (
              <div className="hc-empty-state" style={{ padding: "36px 16px" }}>
                <i className="bi bi-gift" style={{ fontSize: "32px", opacity: 0.5 }}></i>
                <p style={{ marginTop: 8, marginBottom: 12 }}>Chưa có đặc quyền nào phù hợp.</p>
                <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={openCreateBenefit}>
                  <i className="bi bi-plus-lg"></i> Tạo đặc quyền đầu tiên
                </button>
              </div>
            ) : (
              <div className="hc-card-body flush u-scroll-x">
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th style={{ width: "130px" }}>Hạng áp dụng</th>
                      <th>Tên đặc quyền &amp; Mô tả</th>
                      <th>Loại quyền lợi</th>
                      <th>Hạn mức (Quota)</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: "right", width: "140px" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBenefits.map((b) => (
                      <tr key={b.tierBenefitId}>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              background: getTierColor(b.tierCode),
                              color: "#fff",
                              borderRadius: "12px",
                              padding: "2px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {b.tierName || b.tierCode || "Mọi hạng"}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: "13.5px" }}>{b.benefitName}</strong>
                          {b.description && (
                            <div style={{ fontSize: "11.5px", color: "var(--hc-text-muted)", marginTop: "2px" }}>
                              {b.description}
                            </div>
                          )}
                        </td>
                        <td>{renderBenefitTypeBadge(b)}</td>
                        <td>{renderQuotaDisplay(b)}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleBenefitActive(b)}
                            title="Bấm để bật / tắt đặc quyền"
                            style={{
                              border: 0,
                              cursor: "pointer",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: b.isActive ? "var(--hc-success-bg, #dcfce7)" : "var(--hc-bg, #f1f5f9)",
                              color: b.isActive ? "var(--hc-success, #15803d)" : "var(--hc-text-muted, #64748b)",
                            }}
                          >
                            <i className={`bi ${b.isActive ? "bi-check-circle-fill" : "bi-pause-circle"} u-mr-4`}></i>
                            {b.isActive ? "Đang áp dụng" : "Tạm dừng"}
                          </button>
                        </td>
                        <td className="u-text-right u-nowrap">
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm u-mr-6"
                            onClick={() => openEditBenefit(b)}
                            title="Chỉnh sửa đặc quyền"
                          >
                            <i className="bi bi-pencil"></i> Sửa
                          </button>
                          <button
                            type="button"
                            className="hc-btn hc-btn-ghost hc-btn-sm text-danger"
                            onClick={() => deleteBenefit(b)}
                            title="Xóa đặc quyền này"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Customer Detail Panel (Right Column when selected) */}
        {selectedCustomer && (
          <div className="hc-card" style={{ position: "sticky", top: "20px" }}>
            <div className="hc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>{selectedCustomer.customerName || "Chi tiết hội viên"}</div>
                <div className="u-hint">{selectedCustomer.phone || selectedCustomer.email || ""}</div>
              </div>
              <div className="u-row-6">
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
                <button
                  type="button"
                  className="hc-btn hc-btn-ghost hc-btn-sm"
                  onClick={() => setSelectedId(null)}
                  title="Đóng chi tiết"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
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
                        <div className="u-fw-600">{txn.txnType === "EARN" ? "Tích điểm" : "Điều chỉnh"}</div>
                        <div className="u-hint-sm">{formatDateTime(txn.createdAt)}</div>
                        {txn.note && <div className="u-hint-sm">{txn.note}</div>}
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
          <div className="u-actions-end">
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
              Số điểm điều chỉnh <span className="u-text-error">*</span>
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

      {/* Edit Customer Modal */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={`Chỉnh sửa khách hàng: ${selectedCustomer?.customerName || ""}`}
        subtitle="Cập nhật thông tin cá nhân, giấy tờ, hạng và điểm của khách"
        icon="bi-person-lines-fill"
        maxWidth="680px"
        footer={
          <div className="u-actions-end">
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
                  {label} {required && <span className="u-text-error">*</span>}
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
          <small className="u-hint-sm">Muốn cộng/trừ điểm và lưu lý do trong lịch sử, hãy dùng nút "Điều chỉnh" ở danh sách.</small>
        </form>
      </Modal>

      {/* Tier Edit Modal */}
      <Modal
        isOpen={tierModal}
        onClose={() => setTierModal(false)}
        title={`Chỉnh sửa hạng: ${tierTarget?.tierName || ""}`}
        subtitle="Cập nhật tên, cấp độ, điểm tối thiểu và mô tả của hạng thành viên"
        icon="bi-gem"
        maxWidth="520px"
        footer={
          <div className="u-actions-end">
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
            <small className="u-hint-sm">Mã hạng dùng để liên kết trong hệ thống nên không thể đổi.</small>
          </div>
          <div className="hc-form-group">
            <label className="hc-label">
              Tên hạng <span className="u-text-error">*</span>
            </label>
            <input className="hc-input" type="text" value={tierForm.tierName} onChange={(e) => setTierForm({ ...tierForm, tierName: e.target.value })} required />
          </div>
          <div className="u-grid-auto">
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
          <small className="u-hint-sm">
            Hiện có {customers.filter((c) => c.tierCode === tierTarget?.tierCode).length} khách ở hạng này. Đổi điểm tối thiểu không xếp hạng lại khách ngay; hạng được tính lại khi điểm của khách thay đổi.
          </small>
        </form>
      </Modal>

      {/* =========================================================================
         MODAL TẠO / CHỈNH SỬA ĐẶC QUYỀN HỘI VIÊN (TIER BENEFIT MODAL)
         ========================================================================= */}
      <Modal
        isOpen={benefitModal}
        onClose={() => setBenefitModal(false)}
        title={editingBenefit ? `Chỉnh sửa đặc quyền: ${editingBenefit.benefitName}` : "Thêm đặc quyền hội viên mới"}
        subtitle="Thiết lập quyền lợi, ưu đãi giảm giá và quà tặng theo từng hạng thẻ"
        icon="bi-gift"
        maxWidth="560px"
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setBenefitModal(false)}>
              Hủy bỏ
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={saveBenefit} disabled={benefitSubmitting}>
              {benefitSubmitting ? "Đang lưu..." : editingBenefit ? "Lưu thay đổi" : "Tạo đặc quyền"}
            </button>
          </div>
        }
      >
        <form onSubmit={saveBenefit}>
          {/* Hạng thành viên áp dụng */}
          <div className="hc-form-group">
            <label className="hc-label">
              Hạng thành viên áp dụng <span className="u-text-error">*</span>
            </label>
            <SelectMenu
              value={benefitForm.tierId}
              onChange={(tierId) => setBenefitForm({ ...benefitForm, tierId })}
              options={tiers.map((t) => ({ value: String(t.tierId), label: `${t.tierName} (${t.tierCode})` }))}
              ariaLabel="Chọn hạng áp dụng"
              icon="bi-gem"
            />
          </div>

          {/* Tên đặc quyền */}
          <div className="hc-form-group">
            <label className="hc-label">
              Tên đặc quyền <span className="u-text-error">*</span>
            </label>
            <input
              type="text"
              className="hc-input"
              placeholder="VD: Giảm 10% tiền phòng, Miễn phí bữa sáng Buffet..."
              value={benefitForm.benefitName}
              onChange={(e) => setBenefitForm({ ...benefitForm, benefitName: e.target.value })}
              required
            />
          </div>

          {/* Loại đặc quyền */}
          <div className="hc-form-group">
            <label className="hc-label">
              Loại đặc quyền <span className="u-text-error">*</span>
            </label>
            <SelectMenu
              value={benefitForm.benefitType}
              onChange={(benefitType) => setBenefitForm({ ...benefitForm, benefitType })}
              options={[
                { value: "ROOM_DISCOUNT", label: "Giảm giá tiền phòng (ROOM_DISCOUNT)" },
                { value: "FREE_SERVICE", label: "Dịch vụ miễn phí (FREE_SERVICE)" },
                { value: "FREE_NIGHT", label: "Đêm nghỉ miễn phí (FREE_NIGHT)" },
              ]}
              ariaLabel="Chọn loại đặc quyền"
              icon="bi-tag"
            />
          </div>

          {/* Chi tiết theo Loại đặc quyền */}
          {benefitForm.benefitType === "ROOM_DISCOUNT" && (
            <div className="hc-form-group">
              <label className="hc-label">
                Phần trăm giảm giá phòng (%) <span className="u-text-error">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="0.5"
                className="hc-input"
                placeholder="VD: 10 (tương đương giảm 10%)"
                value={benefitForm.discountPercent}
                onChange={(e) => setBenefitForm({ ...benefitForm, discountPercent: e.target.value })}
                required
              />
              <small style={{ color: "var(--hc-text-muted)", fontSize: "11px", marginTop: 4, display: "block" }}>
                Hệ thống sẽ tự động áp dụng mức giảm này khi hội viên đặt phòng.
              </small>
            </div>
          )}

          {benefitForm.benefitType === "FREE_SERVICE" && (
            <div className="hc-form-group">
              <label className="hc-label">
                Dịch vụ được miễn phí
              </label>
              <SelectMenu
                value={benefitForm.serviceId}
                onChange={(serviceId) => setBenefitForm({ ...benefitForm, serviceId })}
                options={[
                  { value: "", label: "-- Không gắn dịch vụ cụ thể --" },
                  ...services.map((s) => ({ value: String(s.serviceId), label: `${s.serviceName} (${formatVND(s.unitPrice || 0)})` })),
                ]}
                ariaLabel="Chọn dịch vụ"
                icon="bi-stars"
              />
              <small style={{ color: "var(--hc-text-muted)", fontSize: "11px", marginTop: 4, display: "block" }}>
                Khách hàng được miễn phí sử dụng dịch vụ này theo hạn mức được cấp.
              </small>
            </div>
          )}

          {benefitForm.benefitType === "FREE_NIGHT" && (
            <div className="hc-form-group">
              <label className="hc-label">
                Hạng phòng áp dụng đêm miễn phí
              </label>
              <SelectMenu
                value={benefitForm.roomTypeId}
                onChange={(roomTypeId) => setBenefitForm({ ...benefitForm, roomTypeId })}
                options={[
                  { value: "", label: "-- Mọi hạng phòng --" },
                  ...roomTypes.map((rt) => ({ value: String(rt.roomTypeId), label: rt.typeName || `Hạng phòng #${rt.roomTypeId}` })),
                ]}
                ariaLabel="Chọn loại phòng"
                icon="bi-door-closed"
              />
            </div>
          )}

          {/* Hạn mức (Quota) & Kỳ hạn (Period) */}
          <div className="u-grid-2">
            <div className="hc-form-group">
              <label className="hc-label">Số lượt sử dụng (Quota)</label>
              <input
                type="number"
                min="1"
                step="1"
                className="hc-input"
                placeholder="Để trống = Không giới hạn"
                value={benefitForm.quota}
                onChange={(e) => setBenefitForm({ ...benefitForm, quota: e.target.value })}
              />
              <small style={{ color: "var(--hc-text-muted)", fontSize: "11px", marginTop: 4, display: "block" }}>
                Để trống nếu không giới hạn số lượt.
              </small>
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Chu kỳ áp dụng</label>
              <SelectMenu
                value={benefitForm.periodType}
                onChange={(periodType) => setBenefitForm({ ...benefitForm, periodType })}
                options={[
                  { value: "YEAR", label: "Mỗi năm (YEAR)" },
                  { value: "MONTH", label: "Mỗi tháng (MONTH)" },
                  { value: "DAY", label: "Mỗi ngày (DAY)" },
                ]}
                ariaLabel="Chu kỳ áp dụng"
                icon="bi-calendar-check"
              />
            </div>
          </div>

          {/* Trạng thái kích hoạt */}
          <div className="hc-form-group" style={{ marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={benefitForm.isActive}
                onChange={(e) => setBenefitForm({ ...benefitForm, isActive: e.target.checked })}
                style={{ width: 17, height: 17, accentColor: "var(--hc-primary)" }}
              />
              <span>Kích hoạt áp dụng đặc quyền này ngay</span>
            </label>
          </div>

          {/* Mô tả chi tiết */}
          <div className="hc-form-group">
            <label className="hc-label">Mô tả / Thể lệ áp dụng</label>
            <textarea
              className="hc-textarea"
              rows={3}
              placeholder="Ghi chú chi tiết điều kiện hoặc lưu ý khi sử dụng quyền lợi..."
              value={benefitForm.description}
              onChange={(e) => setBenefitForm({ ...benefitForm, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
