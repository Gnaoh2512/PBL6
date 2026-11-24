import React, { useState, useEffect } from "react";
import Modal from "../../components/common/Modal";
import { apiCall, formatVND, formatDateTime } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import "../../components/common/SearchInput.css";
import SelectMenu from "../../components/common/SelectMenu";
import Paginated from "../../components/common/TablePagination";
import { roleLabel } from "../../utils/labels";

const ROLE_FILTER_OPTIONS = [
  { value: "ALL", label: "Tất cả vai trò" },
  { value: "ROLE_ADMIN", label: roleLabel("ADMIN") },
  { value: "ROLE_MANAGER", label: roleLabel("MANAGER") },
  { value: "ROLE_RECEPTIONIST", label: roleLabel("RECEPTIONIST") },
  { value: "ROLE_HOUSEKEEPING", label: roleLabel("HOUSEKEEPING") },
  { value: "ROLE_MAINTENANCE", label: roleLabel("MAINTENANCE") },
  { value: "ROLE_SERVICE_STAFF", label: roleLabel("SERVICE_STAFF") },
  { value: "ROLE_CUSTOMER", label: roleLabel("CUSTOMER") },
];

const ROLE_FORM_OPTIONS = [
  { value: "ROLE_RECEPTIONIST", label: roleLabel("RECEPTIONIST") },
  { value: "ROLE_HOUSEKEEPING", label: roleLabel("HOUSEKEEPING") },
  { value: "ROLE_MAINTENANCE", label: roleLabel("MAINTENANCE") },
  { value: "ROLE_SERVICE_STAFF", label: roleLabel("SERVICE_STAFF") },
  { value: "ROLE_MANAGER", label: roleLabel("MANAGER") },
  { value: "ROLE_ADMIN", label: roleLabel("ADMIN") },
  { value: "ROLE_CUSTOMER", label: roleLabel("CUSTOMER") },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "INACTIVE", label: "Vô hiệu hóa" },
  { value: "LOCKED", label: "Bị khóa" },
];

const STATUS_META = {
  ACTIVE: { label: "Hoạt động", badge: "hc-badge-success", icon: "bi-check-circle-fill" },
  INACTIVE: { label: "Vô hiệu hóa", badge: "hc-badge-muted", icon: "bi-pause-circle" },
  LOCKED: { label: "Bị khóa", badge: "hc-badge-error", icon: "bi-lock-fill" },
};

const SERVICE_STATUS_META = {
  COMPLETED: { label: "Hoàn tất", badge: "hc-badge-success", icon: "bi-check-circle-fill" },
  DELIVERING: { label: "Đang phục vụ", badge: "hc-badge-info", icon: "bi-arrow-repeat" },
  PENDING: { label: "Chờ xử lý", badge: "hc-badge-warning", icon: "bi-clock-history" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-muted", icon: "bi-x-circle" },
  CANCELLED: { label: "Đã hủy", badge: "hc-badge-muted", icon: "bi-x-circle" },
};

const statusOf = (a) => String(a?.status || "ACTIVE").toUpperCase();

const roleCodeOf = (role) => (typeof role === "string" ? role : role?.roleCode || role?.code || "");

const isCustomerAccount = (a) => roleCodeOf(a?.role) === "ROLE_CUSTOMER";

export default function AdminAccountsPage() {
  const { addToast } = useToast();
  const { user } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    phone: "",
    email: "",
    role: "ROLE_RECEPTIONIST",
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit / view / deactivate modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Customer Service History Tab & Data
  const [modalTab, setModalTab] = useState("services"); // "services" | "info"
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("ALL");

  const fetchServiceHistory = async (accountId) => {
    setServicesLoading(true);
    try {
      const res = await apiCall(`/api/admin/accounts/${accountId}/service-history`, { silentError: true });
      if (res && res.success) {
        setServiceHistory(res.data || []);
      } else {
        setServiceHistory([]);
      }
    } catch {
      setServiceHistory([]);
    } finally {
      setServicesLoading(false);
    }
  };

  const openAccountDetail = (a, preferredTab = null) => {
    setEditTarget(a);
    const isCust = isCustomerAccount(a);
    const initialTab = preferredTab || (isCust ? "services" : "info");
    setModalTab(initialTab);
    setEditForm({
      fullName: a.fullName || "",
      phone: a.phone || "",
      email: a.email || "",
      role: roleCodeOf(a.role) || "ROLE_RECEPTIONIST",
      status: statusOf(a),
      password: "",
    });
    setServiceSearch("");
    setServiceStatusFilter("ALL");
    if (isCust) {
      fetchServiceHistory(a.accountId);
    } else {
      setServiceHistory([]);
    }
  };

  const closeEdit = () => {
    if (savingEdit || deactivating) return;
    setEditTarget(null);
    setEditForm(null);
    setServiceHistory([]);
  };

  const isSelf = (a) => !!a && !!user?.username && a.username?.toLowerCase() === user.username.toLowerCase();

  const handleSaveEdit = async (e) => {
    e?.preventDefault?.();
    if (!editTarget || !editForm) return;
    if (!editForm.fullName.trim()) {
      addToast("Vui lòng nhập họ tên!", "warning");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await apiCall(`/api/admin/accounts/${editTarget.accountId}`, {
        method: "PUT",
        body: {
          fullName: editForm.fullName.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          role: editForm.role,
          status: editForm.status,
          password: editForm.password || null,
        },
      });
      if (res && res.success) {
        addToast(`Đã cập nhật tài khoản ${editTarget.username}!`, "success");
        setEditTarget(null);
        setEditForm(null);
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi cập nhật tài khoản", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeactivate = async () => {
    if (!editTarget) return;
    if (!window.confirm(`Vô hiệu hóa tài khoản "${editTarget.username}"? Tài khoản sẽ không còn hoạt động nhưng dữ liệu lịch sử được giữ lại.`)) return;
    setDeactivating(true);
    try {
      const res = await apiCall(`/api/admin/accounts/${editTarget.accountId}`, { method: "DELETE" });
      if (res && res.success) {
        addToast(`Đã vô hiệu hóa tài khoản ${editTarget.username}.`, "success");
        setEditTarget(null);
        setEditForm(null);
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi vô hiệu hóa tài khoản", "error");
    } finally {
      setDeactivating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiCall("/api/admin/accounts", { silentError: true });
      if (res && res.success) setAccounts(res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password || !form.fullName.trim()) {
      addToast("Vui lòng điền đầy đủ username, password và họ tên!", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiCall("/api/admin/accounts", {
        method: "POST",
        body: {
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          role: form.role,
        },
      });

      if (res && res.success) {
        addToast(`Tạo tài khoản ${form.username} thành công!`, "success");
        setModalOpen(false);
        setForm({
          username: "",
          password: "",
          fullName: "",
          phone: "",
          email: "",
          role: "ROLE_RECEPTIONIST",
        });
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi tạo tài khoản", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAccounts = accounts.filter((a) => {
    const matchRole = roleFilter === "ALL" || roleCodeOf(a.role) === roleFilter;
    const query = searchQuery.toLowerCase();
    const matchSearch = !query || (a.username && a.username.toLowerCase().includes(query)) || (a.fullName && a.fullName.toLowerCase().includes(query)) || (a.phone && a.phone.includes(query));
    return matchRole && matchSearch;
  });

  const isCust = isCustomerAccount(editTarget);

  const filteredServices = serviceHistory.filter((s) => {
    const query = serviceSearch.toLowerCase().trim();
    const matchQuery =
      !query ||
      (s.serviceName && s.serviceName.toLowerCase().includes(query)) ||
      (s.categoryName && s.categoryName.toLowerCase().includes(query)) ||
      (s.roomNumber && String(s.roomNumber).toLowerCase().includes(query)) ||
      (s.bookingCode && s.bookingCode.toLowerCase().includes(query));

    const matchStatus =
      serviceStatusFilter === "ALL" ||
      s.status?.toUpperCase() === serviceStatusFilter.toUpperCase();

    return matchQuery && matchStatus;
  });

  const totalSpent = serviceHistory
    .filter((s) => !s.status?.toUpperCase().includes("CANCEL"))
    .reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);

  const totalCompleted = serviceHistory.filter(
    (s) => s.status?.toUpperCase() === "COMPLETED"
  ).length;

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2>Tài Khoản Người Dùng</h2>
          <p>Quản lý tài khoản và vai trò truy cập hệ thống.</p>
        </div>

        <div className="u-row-10">
          <button type="button" className="hc-btn hc-btn-primary" onClick={() => setModalOpen(true)}>
            <i className="bi bi-person-plus-fill"></i> Thêm Tài Khoản Mới
          </button>
        </div>
      </div>

      {
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="m-fields" style={{ display: "flex", gap: "12px", flexWrap: "wrap", width: "100%", justifyContent: "space-between" }}>
              <div style={{ position: "relative", width: "320px" }}>
                <i className="bi bi-search" style={{ position: "absolute", left: "12px", top: "10px", color: "var(--hc-text-muted)" }}></i>
                <input
                  type="text"
                  className="hc-input"
                  style={{ paddingLeft: "36px", height: "38px", fontSize: "13px" }}
                  placeholder="Tìm theo username, tên, SĐT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ width: "200px" }}>
                <SelectMenu ariaLabel="Lọc vai trò" icon="bi-funnel" value={roleFilter} onChange={setRoleFilter} options={ROLE_FILTER_OPTIONS} />
              </div>
            </div>
          </div>

          <div className="hc-card-body flush">
            {loading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="hc-empty-state">
                <i className="bi bi-person-x"></i>
                <p>Không tìm thấy tài khoản nào.</p>
              </div>
            ) : (
              <Paginated items={filteredAccounts}>
                {(pageRows, pager) => (
                  <>
                    <table className="hc-table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Họ và tên</th>
                          <th>Vai trò (Role)</th>
                          <th>Số điện thoại</th>
                          <th>Email</th>
                          <th>Trạng thái</th>
                          <th className="col-actions">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((a) => {
                          const st = STATUS_META[statusOf(a)] || { label: statusOf(a), badge: "hc-badge-muted", icon: "bi-circle" };
                          return (
                          <tr
                            key={a.accountId || a.id || a.username}
                            className="row-clickable"
                            tabIndex={0}
                            title={isCustomerAccount(a) ? "Bấm để xem lịch sử dịch vụ & tài khoản" : "Xem & chỉnh sửa tài khoản"}
                            onClick={() => openAccountDetail(a)}
                            onKeyDown={(e) => {
                              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                openAccountDetail(a);
                              }
                            }}
                          >
                            <td>
                              <strong>{a.username}</strong>
                              {isCustomerAccount(a) && (
                                <span className="hc-badge hc-badge-info" style={{ marginLeft: "8px", fontSize: "10px", padding: "1px 6px" }}>
                                  <i className="bi bi-person-heart"></i> Khách hàng
                                </span>
                              )}
                            </td>
                            <td>{a.fullName || "---"}</td>
                            <td>
                              <span className="hc-badge hc-badge-primary">{roleLabel(a.role, "—")}</span>
                            </td>
                            <td>{a.phone || "---"}</td>
                            <td>{a.email || "---"}</td>
                            <td>
                              <span className={`hc-badge ${st.badge}`}>
                                <i className={`bi ${st.icon}`}></i> {st.label}
                              </span>
                            </td>
                            <td className="col-actions">
                              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                                {isCustomerAccount(a) && (
                                  <button
                                    type="button"
                                    className="hc-btn hc-btn-outline-primary hc-btn-sm"
                                    onClick={() => openAccountDetail(a, "services")}
                                    title="Xem lịch sử dịch vụ khách hàng đã sử dụng"
                                    style={{ whiteSpace: "nowrap" }}
                                  >
                                    <i className="bi bi-clock-history"></i> Dịch vụ
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="hc-btn hc-btn-outline hc-btn-sm"
                                  onClick={() => openAccountDetail(a, "info")}
                                  title="Sửa tài khoản"
                                >
                                  <i className="bi bi-pencil-square"></i> Sửa
                                </button>
                              </div>
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
      }

      {/* View / Edit / Deactivate Account / Customer Service History Modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={closeEdit}
        title={
          isCust
            ? `Khách hàng: ${editTarget?.fullName || editTarget?.username || ""}`
            : `Tài khoản ${editTarget?.username || ""}`
        }
        subtitle={
          isCust && modalTab === "services"
            ? `Xem chi tiết lịch sử dịch vụ khách hàng đã sử dụng (${editTarget?.username})`
            : "Xem, chỉnh sửa hoặc vô hiệu hóa tài khoản"
        }
        icon={isCust ? "bi-person-badge" : "bi-person-gear"}
        maxWidth={isCust && modalTab === "services" ? "880px" : "500px"}
        headerExtra={
          editTarget ? (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {isCust && (
                <span className="hc-badge hc-badge-info">
                  <i className="bi bi-person-heart"></i> Khách hàng
                </span>
              )}
              <span className={`hc-badge ${(STATUS_META[statusOf(editTarget)] || { badge: "hc-badge-muted" }).badge}`}>
                {(STATUS_META[statusOf(editTarget)] || { label: statusOf(editTarget) }).label}
              </span>
            </div>
          ) : null
        }
        footer={
          isCust && modalTab === "services" ? (
            <div className="u-actions-end" style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
              <button
                type="button"
                className="hc-btn hc-btn-outline hc-btn-sm"
                onClick={() => setModalTab("info")}
              >
                <i className="bi bi-pencil-square"></i> Sửa thông tin tài khoản
              </button>
              <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={closeEdit}>
                Đóng
              </button>
            </div>
          ) : (
            <div className="u-actions-end" style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
              {isCust ? (
                <button
                  type="button"
                  className="hc-btn hc-btn-outline-primary hc-btn-sm"
                  onClick={() => setModalTab("services")}
                >
                  <i className="bi bi-clock-history"></i> Xem lịch sử dịch vụ
                </button>
              ) : <div />}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="hc-btn hc-btn-outline-danger hc-btn-sm"
                  onClick={handleDeactivate}
                  disabled={deactivating || savingEdit || isSelf(editTarget) || (editTarget && statusOf(editTarget) === "INACTIVE")}
                  title={isSelf(editTarget) ? "Không thể vô hiệu hóa chính mình" : "Vô hiệu hóa tài khoản"}
                >
                  <i className="bi bi-person-slash"></i> {deactivating ? "Đang xử lý..." : "Vô hiệu hóa"}
                </button>
                <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={closeEdit}>
                  Hủy
                </button>
                <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSaveEdit} disabled={savingEdit || deactivating}>
                  {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          )
        }
      >
        {editTarget && (
          <div>
            {isCust && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  borderBottom: "1px solid var(--hc-border, #e2e8f0)",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                <button
                  type="button"
                  className={`hc-btn ${modalTab === "services" ? "hc-btn-primary" : "hc-btn-outline"} hc-btn-sm`}
                  onClick={() => setModalTab("services")}
                >
                  <i className="bi bi-clock-history"></i> Lịch Sử Dịch Vụ{" "}
                  {serviceHistory.length > 0 && (
                    <span
                      style={{
                        background: modalTab === "services" ? "rgba(255,255,255,0.25)" : "var(--hc-bg-muted, #e2e8f0)",
                        color: modalTab === "services" ? "#fff" : "inherit",
                        borderRadius: "10px",
                        padding: "1px 7px",
                        fontSize: "11px",
                        marginLeft: "4px",
                      }}
                    >
                      {serviceHistory.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`hc-btn ${modalTab === "info" ? "hc-btn-primary" : "hc-btn-outline"} hc-btn-sm`}
                  onClick={() => setModalTab("info")}
                >
                  <i className="bi bi-person-gear"></i> Thông Tin Tài Khoản
                </button>
              </div>
            )}

            {isCust && modalTab === "services" ? (
              <div>
                {/* Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "10px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      background: "var(--hc-bg-card, #f8fafc)",
                      border: "1px solid var(--hc-border, #e2e8f0)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "var(--hc-text-muted, #64748b)", textTransform: "uppercase" }}>
                      Tổng dịch vụ đã dùng
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--hc-text-dark, #0f172a)" }}>
                      {serviceHistory.length} <small style={{ fontSize: "12px", fontWeight: "400" }}>lượt</small>
                    </div>
                  </div>
                  <div
                    style={{
                      background: "var(--hc-bg-card, #f8fafc)",
                      border: "1px solid var(--hc-border, #e2e8f0)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "var(--hc-text-muted, #64748b)", textTransform: "uppercase" }}>
                      Tổng chi phí dịch vụ
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: "#0284c7" }}>
                      {formatVND(totalSpent)}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "var(--hc-bg-card, #f8fafc)",
                      border: "1px solid var(--hc-border, #e2e8f0)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "var(--hc-text-muted, #64748b)", textTransform: "uppercase" }}>
                      Đã hoàn tất
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: "#16a34a" }}>
                      {totalCompleted} <small style={{ fontSize: "12px", fontWeight: "400" }}>dịch vụ</small>
                    </div>
                  </div>
                </div>

                {/* Filter and Search */}
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginBottom: "12px",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                    <i
                      className="bi bi-search"
                      style={{ position: "absolute", left: "10px", top: "9px", color: "var(--hc-text-muted, #94a3b8)" }}
                    ></i>
                    <input
                      type="text"
                      className="hc-input"
                      style={{ paddingLeft: "32px", height: "34px", fontSize: "12px" }}
                      placeholder="Tìm theo tên dịch vụ, số phòng, mã đơn..."
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ width: "160px" }}>
                    <SelectMenu
                      ariaLabel="Lọc trạng thái dịch vụ"
                      icon="bi-funnel"
                      value={serviceStatusFilter}
                      onChange={setServiceStatusFilter}
                      options={[
                        { value: "ALL", label: "Tất cả trạng thái" },
                        { value: "COMPLETED", label: "Hoàn tất" },
                        { value: "DELIVERING", label: "Đang phục vụ" },
                        { value: "PENDING", label: "Chờ xử lý" },
                        { value: "CANCELED", label: "Đã hủy" },
                      ]}
                    />
                  </div>
                </div>

                {/* Table or Empty or Spinner */}
                {servicesLoading ? (
                  <div className="hc-loading-spinner" style={{ padding: "40px 0" }}>
                    <div className="hc-spinner"></div>
                    <p style={{ marginTop: "10px", color: "var(--hc-text-muted, #64748b)", fontSize: "13px" }}>
                      Đang tải lịch sử dịch vụ...
                    </p>
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className="hc-empty-state" style={{ padding: "30px 0" }}>
                    <i className="bi bi-bag-x" style={{ fontSize: "32px" }}></i>
                    <p style={{ marginTop: "8px" }}>
                      {serviceHistory.length === 0
                        ? "Khách hàng này chưa từng sử dụng dịch vụ nào."
                        : "Không có dịch vụ nào khớp với bộ lọc."}
                    </p>
                  </div>
                ) : (
                  <Paginated items={filteredServices} pageSize={5}>
                    {(pageRows, pager) => (
                      <>
                        <div style={{ overflowX: "auto" }}>
                          <table className="hc-table" style={{ fontSize: "13px" }}>
                            <thead>
                              <tr>
                                <th>Dịch vụ</th>
                                <th>Phòng / Đơn</th>
                                <th>Thời gian</th>
                                <th style={{ textAlign: "center" }}>Số lượng</th>
                                <th style={{ textAlign: "right" }}>Đơn giá</th>
                                <th style={{ textAlign: "right" }}>Thành tiền</th>
                                <th style={{ textAlign: "center" }}>Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageRows.map((s, idx) => {
                                const st =
                                  SERVICE_STATUS_META[s.status?.toUpperCase()] || {
                                    label: s.status,
                                    badge: "hc-badge-muted",
                                    icon: "bi-circle",
                                  };
                                return (
                                  <tr key={s.id ? `${s.id}-${idx}` : idx}>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>{s.serviceName}</div>
                                      <div style={{ display: "flex", gap: "4px", marginTop: "2px", flexWrap: "wrap" }}>
                                        {s.categoryName && (
                                          <span
                                            className="hc-badge hc-badge-outline"
                                            style={{ fontSize: "10px", padding: "1px 6px" }}
                                          >
                                            {s.categoryName}
                                          </span>
                                        )}
                                        {s.isLoyaltyBenefit && (
                                          <span
                                            className="hc-badge hc-badge-success"
                                            style={{ fontSize: "10px", padding: "1px 6px" }}
                                          >
                                            <i className="bi bi-gem"></i> Hội viên
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <div>
                                        <strong>Phòng {s.roomNumber || "---"}</strong>
                                      </div>
                                      {s.bookingCode && (
                                        <small style={{ color: "var(--hc-text-muted, #64748b)" }}>
                                          #{s.bookingCode}
                                        </small>
                                      )}
                                    </td>
                                    <td>
                                      <div style={{ whiteSpace: "nowrap" }}>
                                        {s.usedAt ? formatDateTime(s.usedAt) : "---"}
                                      </div>
                                      {s.recordedBy && (
                                        <small style={{ color: "var(--hc-text-muted, #64748b)" }}>
                                          Ghi nhận: {s.recordedBy}
                                        </small>
                                      )}
                                    </td>
                                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                                      {s.quantity} {s.unit || ""}
                                    </td>
                                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                      {s.unitPrice != null ? formatVND(s.unitPrice) : "---"}
                                    </td>
                                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                      {s.isLoyaltyBenefit || Number(s.totalPrice) === 0 ? (
                                        <span className="hc-badge hc-badge-success" style={{ fontSize: "11px" }}>
                                          Miễn phí
                                        </span>
                                      ) : (
                                        <strong style={{ color: "var(--hc-text-dark, #0f172a)" }}>
                                          {formatVND(s.totalPrice)}
                                        </strong>
                                      )}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                      <span className={`hc-badge ${st.badge}`} style={{ fontSize: "11px" }}>
                                        <i className={`bi ${st.icon}`}></i> {st.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {pager}
                      </>
                    )}
                  </Paginated>
                )}
              </div>
            ) : (
              editForm && (
                <form onSubmit={handleSaveEdit}>
                  <div className="hc-form-group">
                    <label className="hc-label">Tên đăng nhập (Username)</label>
                    <input type="text" className="hc-input" value={editTarget.username} disabled readOnly />
                  </div>

                  <div className="hc-form-group">
                    <label className="hc-label">
                      Họ và tên đầy đủ <span className="u-text-error">*</span>
                    </label>
                    <input
                      type="text"
                      className="hc-input"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="u-grid-2">
                    <div className="hc-form-group">
                      <label className="hc-label">Vai trò (Role)</label>
                      <SelectMenu
                        ariaLabel="Vai trò"
                        icon="bi-shield-check"
                        value={editForm.role}
                        onChange={(val) => setEditForm({ ...editForm, role: val })}
                        options={ROLE_FORM_OPTIONS}
                      />
                    </div>
                    <div className="hc-form-group">
                      <label className="hc-label">Trạng thái</label>
                      <SelectMenu
                        ariaLabel="Trạng thái"
                        icon="bi-toggles"
                        value={editForm.status}
                        onChange={(val) => setEditForm({ ...editForm, status: val })}
                        options={STATUS_OPTIONS}
                      />
                    </div>
                  </div>
                  {isSelf(editTarget) && (
                    <div className="u-hint" style={{ marginTop: "-6px", marginBottom: "12px" }}>
                      Đây là tài khoản của bạn — không thể đổi vai trò hoặc khóa chính mình.
                    </div>
                  )}

                  <div className="u-grid-2">
                    <div className="hc-form-group">
                      <label className="hc-label">Số điện thoại</label>
                      <input
                        type="tel"
                        className="hc-input"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="hc-form-group">
                      <label className="hc-label">Email</label>
                      <input
                        type="email"
                        className="hc-input"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="hc-form-group">
                    <label className="hc-label">
                      Mật khẩu mới{" "}
                      <span style={{ color: "var(--hc-text-muted)", fontWeight: 400 }}>(tùy chọn)</span>
                    </label>
                    <input
                      type="password"
                      className="hc-input"
                      autoComplete="new-password"
                      placeholder="Để trống = giữ nguyên mật khẩu hiện tại"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    />
                  </div>
                </form>
              )
            )}
          </div>
        )}
      </Modal>

      {/* Create Account Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Thêm Mới Tài Khoản Người Dùng"
        maxWidth="500px"
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleCreateAccount} disabled={submitting}>
              {submitting ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateAccount}>
          <div className="hc-form-group">
            <label className="hc-label">
              Tên đăng nhập (Username) <span className="u-text-error">*</span>
            </label>
            <input type="text" className="hc-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Mật khẩu <span className="u-text-error">*</span>
            </label>
            <input type="password" className="hc-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Họ và tên đầy đủ <span className="u-text-error">*</span>
            </label>
            <input type="text" className="hc-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Vai trò phân quyền (Role) <span className="u-text-error">*</span>
            </label>
            <SelectMenu ariaLabel="Vai trò phân quyền" icon="bi-shield-check" value={form.role} onChange={(val) => setForm({ ...form, role: val })} options={ROLE_FORM_OPTIONS} />
          </div>

          <div className="u-grid-2">
            <div className="hc-form-group">
              <label className="hc-label">Số điện thoại</label>
              <input type="tel" className="hc-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Email</label>
              <input type="email" className="hc-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
