import React, { useState, useEffect } from "react";
import Modal from "../../components/common/Modal";
import { apiCall } from "../../services/api";
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

const statusOf = (a) => String(a?.status || "ACTIVE").toUpperCase();

const roleCodeOf = (role) => (typeof role === "string" ? role : role?.roleCode || role?.code || "");

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

  const openEdit = (a) => {
    setEditTarget(a);
    setEditForm({
      fullName: a.fullName || "",
      phone: a.phone || "",
      email: a.email || "",
      role: roleCodeOf(a.role) || "ROLE_RECEPTIONIST",
      status: statusOf(a),
      password: "",
    });
  };

  const closeEdit = () => {
    if (savingEdit || deactivating) return;
    setEditTarget(null);
    setEditForm(null);
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
                            title="Xem & chỉnh sửa tài khoản"
                            onClick={() => openEdit(a)}
                            onKeyDown={(e) => {
                              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                openEdit(a);
                              }
                            }}
                          >
                            <td>
                              <strong>{a.username}</strong>
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
                                <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => openEdit(a)} title="Sửa tài khoản">
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

      {/* View / Edit / Deactivate Account Modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={closeEdit}
        title={`Tài khoản ${editTarget?.username || ""}`}
        subtitle="Xem, chỉnh sửa hoặc vô hiệu hóa tài khoản"
        icon="bi-person-gear"
        maxWidth="500px"
        headerExtra={
          editTarget ? (
            <span className={`hc-badge ${(STATUS_META[statusOf(editTarget)] || { badge: "hc-badge-muted" }).badge}`}>{(STATUS_META[statusOf(editTarget)] || { label: statusOf(editTarget) }).label}</span>
          ) : null
        }
        footer={
          <div className="u-actions-end">
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
        }
      >
        {editTarget && editForm && (
          <form onSubmit={handleSaveEdit}>
            <div className="hc-form-group">
              <label className="hc-label">Tên đăng nhập (Username)</label>
              <input type="text" className="hc-input" value={editTarget.username} disabled readOnly />
            </div>

            <div className="hc-form-group">
              <label className="hc-label">
                Họ và tên đầy đủ <span className="u-text-error">*</span>
              </label>
              <input type="text" className="hc-input" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} required />
            </div>

            <div className="u-grid-2">
              <div className="hc-form-group">
                <label className="hc-label">Vai trò (Role)</label>
                <SelectMenu ariaLabel="Vai trò" icon="bi-shield-check" value={editForm.role} onChange={(val) => setEditForm({ ...editForm, role: val })} options={ROLE_FORM_OPTIONS} />
              </div>
              <div className="hc-form-group">
                <label className="hc-label">Trạng thái</label>
                <SelectMenu ariaLabel="Trạng thái" icon="bi-toggles" value={editForm.status} onChange={(val) => setEditForm({ ...editForm, status: val })} options={STATUS_OPTIONS} />
              </div>
            </div>
            {isSelf(editTarget) && <div className="u-hint" style={{ marginTop: "-6px", marginBottom: "12px" }}>Đây là tài khoản của bạn — không thể đổi vai trò hoặc khóa chính mình.</div>}

            <div className="u-grid-2">
              <div className="hc-form-group">
                <label className="hc-label">Số điện thoại</label>
                <input type="tel" className="hc-input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="hc-form-group">
                <label className="hc-label">Email</label>
                <input type="email" className="hc-input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
            </div>

            <div className="hc-form-group">
              <label className="hc-label">
                Mật khẩu mới <span style={{ color: "var(--hc-text-muted)", fontWeight: 400 }}>(tùy chọn)</span>
              </label>
              <input type="password" className="hc-input" autoComplete="new-password" placeholder="Để trống = giữ nguyên mật khẩu hiện tại" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            </div>
          </form>
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
