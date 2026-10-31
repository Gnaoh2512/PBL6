import React, { useState, useEffect } from "react";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatDate } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";

const roleCodeOf = (role) => {
  if (!role) return "";
  if (typeof role === "string") return role;
  return role?.roleCode || role?.code || role?.roleName || "";
};

const formatTimeOnly = (t) => {
  if (!t) return "";
  if (Array.isArray(t)) {
    return `${String(t[0]).padStart(2, "0")}:${String(t[1] || 0).padStart(2, "0")}`;
  }
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
};

export default function AdminSchedulesPage() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("SCHEDULES"); // SCHEDULES | SHIFTS
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState("ALL");

  // Assign Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    accountId: "",
    shiftId: "",
    workDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // Shift Modal (Create / Edit Shift definition)
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editShiftId, setEditShiftId] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    shiftName: "",
    startTime: "06:00",
    endTime: "14:00",
    description: "",
  });
  const [submittingShift, setSubmittingShift] = useState(false);

  useEffect(() => {
    loadAll();
  }, [activeTab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [shiftsRes, accountsRes, schedulesRes] = await Promise.allSettled([
        apiCall("/api/admin/shifts", { silentError: true }),
        apiCall("/api/admin/accounts", { silentError: true }),
        apiCall("/api/admin/schedules", { silentError: true }),
      ]);

      if (shiftsRes.status === "fulfilled" && shiftsRes.value) {
        const d = shiftsRes.value.data ?? (Array.isArray(shiftsRes.value) ? shiftsRes.value : []);
        setShifts(Array.isArray(d) ? d : []);
      }
      if (accountsRes.status === "fulfilled" && accountsRes.value) {
        const d = accountsRes.value.data ?? (Array.isArray(accountsRes.value) ? accountsRes.value : []);
        const staffList = (Array.isArray(d) ? d : []).filter((a) => roleCodeOf(a.role) !== "ROLE_CUSTOMER");
        setAccounts(staffList);
      }
      if (schedulesRes.status === "fulfilled" && schedulesRes.value) {
        const d = schedulesRes.value.data ?? (Array.isArray(schedulesRes.value) ? schedulesRes.value : []);
        setSchedules(Array.isArray(d) ? d : []);
      }
    } catch (err) {
      console.warn("Error loading schedules:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSchedule = async (e) => {
    e.preventDefault();
    if (!assignForm.accountId || !assignForm.shiftId || !assignForm.workDate) {
      addToast("Vui lòng chọn nhân viên, ca làm việc và ngày phân công!", "warning");
      return;
    }

    setSubmittingSchedule(true);
    try {
      const res = await apiCall("/api/admin/schedules", {
        method: "POST",
        body: {
          accountId: parseInt(assignForm.accountId),
          shiftId: parseInt(assignForm.shiftId),
          workDate: assignForm.workDate,
          notes: assignForm.notes.trim() || null,
        },
      });

      if (res && res.success) {
        addToast("Phân ca làm việc cho nhân viên thành công!", "success");
        setScheduleModalOpen(false);
        loadAll();
      }
    } catch (err) {
      addToast(err.message || "Lỗi phân ca làm việc", "error");
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy phân ca này?")) return;
    try {
      const res = await apiCall(`/api/admin/schedules/${scheduleId}`, { method: "DELETE" });
      if (res && res.success) {
        addToast("Đã xóa phân ca thành công!", "success");
        loadAll();
      }
    } catch (err) {
      addToast(err.message || "Lỗi xóa phân ca", "error");
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.shiftName.trim()) {
      addToast("Vui lòng nhập tên ca làm việc!", "warning");
      return;
    }

    setSubmittingShift(true);
    const payload = {
      shiftName: shiftForm.shiftName.trim(),
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      description: shiftForm.description.trim() || null,
    };

    try {
      let res;
      if (editShiftId) {
        res = await apiCall(`/api/admin/shifts/${editShiftId}`, { method: "PUT", body: payload });
      } else {
        res = await apiCall("/api/admin/shifts", { method: "POST", body: payload });
      }

      if (res && res.success) {
        addToast(`${editShiftId ? "Cập nhật" : "Thêm"} ca làm việc thành công!`, "success");
        setShiftModalOpen(false);
        loadAll();
      }
    } catch (err) {
      addToast(err.message || "Lỗi lưu ca làm việc", "error");
    } finally {
      setSubmittingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa ca làm việc này?")) return;
    try {
      const res = await apiCall(`/api/admin/shifts/${shiftId}`, { method: "DELETE" });
      if (res && res.success) {
        addToast("Đã xóa ca thành công!", "success");
        loadAll();
      }
    } catch (err) {
      addToast(err.message || "Lỗi xóa ca làm việc", "error");
    }
  };

  // Options mapping for SelectMenu components
  const shiftFilterOptions = [{ value: "ALL", label: "Tất cả ca trực" }, ...shifts.map((s) => ({ value: String(s.shiftId), label: s.shiftName || `Ca #${s.shiftId}` }))];

  const staffFormOptions = accounts.map((a) => ({
    value: String(a.accountId || a.id),
    label: `${a.fullName || a.username} (${roleCodeOf(a.role).replace("ROLE_", "") || "—"})`,
  }));

  const shiftFormOptions = shifts.map((s) => ({
    value: String(s.shiftId),
    label: `${s.shiftName || `Ca #${s.shiftId}`} (${formatTimeOnly(s.startTime)} - ${formatTimeOnly(s.endTime)})`,
  }));

  // Filtering lists
  const filteredSchedules = schedules.filter((sch) => {
    const matchShift = shiftFilter === "ALL" || String(sch.shiftId) === String(shiftFilter);
    const query = searchQuery.toLowerCase();
    const staffName = (sch.fullName || sch.accountFullName || sch.username || sch.accountUsername || "").toLowerCase();
    const notes = (sch.notes || "").toLowerCase();
    const matchSearch = !query || staffName.includes(query) || notes.includes(query);
    return matchShift && matchSearch;
  });

  const filteredShifts = shifts.filter((s) => {
    const query = searchQuery.toLowerCase();
    const name = (s.shiftName || "").toLowerCase();
    const desc = (s.description || "").toLowerCase();
    return !query || name.includes(query) || desc.includes(query);
  });

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", textAlign: "left" }}>
        <div>
          <h2>Phân Ca & Lịch Làm Việc</h2>
          <p>Quản lý danh mục ca trực và phân công lịch làm việc cho nhân viên.</p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {activeTab === "SCHEDULES" ? (
            <button
              type="button"
              className="hc-btn hc-btn-primary"
              onClick={() => {
                setAssignForm({
                  accountId: accounts[0]?.accountId || accounts[0]?.id || "",
                  shiftId: shifts[0]?.shiftId || "",
                  workDate: new Date().toISOString().split("T")[0],
                  notes: "",
                });
                setScheduleModalOpen(true);
              }}
            >
              <i className="bi bi-person-check-fill"></i> Phân Ca Cho Nhân Viên
            </button>
          ) : (
            <button
              type="button"
              className="hc-btn hc-btn-primary"
              onClick={() => {
                setEditShiftId(null);
                setShiftForm({ shiftName: "", startTime: "06:00", endTime: "14:00", description: "" });
                setShiftModalOpen(true);
              }}
            >
              <i className="bi bi-plus-lg"></i> Thêm Ca Mới
            </button>
          )}
        </div>
      </div>

      <div className="hc-tab-group" style={{ marginBottom: "24px" }}>
        <button className={`hc-tab-btn ${activeTab === "SCHEDULES" ? "active" : ""}`} onClick={() => setActiveTab("SCHEDULES")}>
          <i className="bi bi-calendar3"></i> Lịch Phân Công Nhân Viên ({schedules.length})
        </button>
        <button className={`hc-tab-btn ${activeTab === "SHIFTS" ? "active" : ""}`} onClick={() => setActiveTab("SHIFTS")}>
          <i className="bi bi-clock"></i> Danh Mục Ca Làm Việc ({shifts.length})
        </button>
      </div>

      {activeTab === "SCHEDULES" ? (
        /* Schedules Table Card */
        <div className="hc-card">
          <div className="hc-card-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--hc-border-light)" }}>
            <input
              type="search"
              className="hc-input"
              style={{ flex: "1 1 280px" }}
              placeholder="Tìm theo tên nhân viên, ghi chú..."
              aria-label="Tìm lịch làm việc"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div style={{ flex: "0 0 220px" }}>
              <SelectMenu value={shiftFilter} onChange={setShiftFilter} options={shiftFilterOptions} ariaLabel="Lọc ca trực" icon="bi-funnel" />
            </div>
          </div>

          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-calendar-x"></i>
              <p>Không tìm thấy lịch phân công nào.</p>
            </div>
          ) : (
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Ngày làm việc</th>
                    <th>Nhân viên</th>
                    <th>Vai trò</th>
                    <th>Ca trực</th>
                    <th>Thời gian</th>
                    <th>Ghi chú</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((sch) => {
                    const empName = sch.fullName || sch.accountFullName || sch.username || sch.accountUsername || "Nhân viên";
                    const rawRole = sch.role || sch.roleCode || sch.roleName || sch.account?.role;
                    const roleDisplay = roleCodeOf(rawRole).replace("ROLE_", "") || "NHÂN VIÊN";
                    const shiftName = sch.shiftName || sch.shift?.shiftName || (sch.shiftId ? `Ca #${sch.shiftId}` : "Ca trực");
                    const start = sch.startTime || sch.shift?.startTime;
                    const end = sch.endTime || sch.shift?.endTime;
                    const timeRange = start && end ? `${formatTimeOnly(start)} - ${formatTimeOnly(end)}` : start ? formatTimeOnly(start) : "---";

                    return (
                      <tr key={sch.scheduleId}>
                        <td>
                          <strong>{formatDate(sch.workDate)}</strong>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <i className="bi bi-person-circle text-primary"></i>
                            <strong>{empName}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="hc-badge hc-badge-primary">{roleDisplay}</span>
                        </td>
                        <td>
                          <span className="hc-badge hc-badge-warning">{shiftName}</span>
                        </td>
                        <td>
                          <span className="hc-badge hc-badge-info" style={{ fontWeight: 500 }}>
                            <i className="bi bi-clock" style={{ marginRight: "4px" }}></i>
                            {timeRange}
                          </span>
                        </td>
                        <td style={{ color: "var(--hc-text-secondary)", fontSize: "13px" }}>{sch.notes || "---"}</td>
                        <td style={{ textAlign: "right" }}>
                          <button type="button" className="hc-btn hc-btn-ghost hc-btn-sm" style={{ color: "var(--hc-error)" }} onClick={() => handleDeleteSchedule(sch.scheduleId)}>
                            <i className="bi bi-trash"></i> Hủy
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
      ) : (
        /* Shifts Definition Table Card */
        <div className="hc-card">
          <div className="hc-card-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--hc-border-light)" }}>
            <input
              type="search"
              className="hc-input"
              style={{ flex: "1 1 280px" }}
              placeholder="Tìm theo tên ca làm việc..."
              aria-label="Tìm ca làm việc"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : filteredShifts.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-clock"></i>
              <p>Không tìm thấy ca làm việc nào.</p>
            </div>
          ) : (
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Tên ca</th>
                    <th>Giờ bắt đầu</th>
                    <th>Giờ kết thúc</th>
                    <th>Mô tả ca trực</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShifts.map((s) => {
                    const sName = s.shiftName || `Ca #${s.shiftId}`;
                    const sStart = formatTimeOnly(s.startTime);
                    const sEnd = formatTimeOnly(s.endTime);
                    return (
                      <tr key={s.shiftId}>
                        <td>
                          <strong>{sName}</strong>
                        </td>
                        <td>
                          <span className="hc-badge hc-badge-info">{sStart}</span>
                        </td>
                        <td>
                          <span className="hc-badge hc-badge-info">{sEnd}</span>
                        </td>
                        <td style={{ color: "var(--hc-text-secondary)" }}>{s.description || "---"}</td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              onClick={() => {
                                setEditShiftId(s.shiftId);
                                setShiftForm({
                                  shiftName: s.shiftName || "",
                                  startTime: sStart,
                                  endTime: sEnd,
                                  description: s.description || "",
                                });
                                setShiftModalOpen(true);
                              }}
                            >
                              <i className="bi bi-pencil"></i> Sửa
                            </button>
                            <button type="button" className="hc-btn hc-btn-ghost hc-btn-sm" style={{ color: "var(--hc-error)" }} onClick={() => handleDeleteShift(s.shiftId)}>
                              <i className="bi bi-trash"></i>
                            </button>
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
      )}

      {/* Assign Schedule Modal */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Phân Ca Làm Việc"
        subtitle="Chọn nhân viên và gán lịch làm việc"
        icon="bi-person-check"
        maxWidth="540px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setScheduleModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleAssignSchedule} disabled={submittingSchedule}>
              {submittingSchedule ? "Đang phân ca..." : "Lưu lịch trực"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAssignSchedule}>
          <div className="hc-form-group">
            <label className="hc-label">
              Nhân viên <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <SelectMenu value={assignForm.accountId} onChange={(value) => setAssignForm({ ...assignForm, accountId: value })} options={staffFormOptions} ariaLabel="Chọn nhân viên" icon="bi-person" />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Ca trực <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <SelectMenu value={assignForm.shiftId} onChange={(value) => setAssignForm({ ...assignForm, shiftId: value })} options={shiftFormOptions} ariaLabel="Chọn ca trực" icon="bi-clock" />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Ngày làm việc <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input type="date" className="hc-input" value={assignForm.workDate} onChange={(e) => setAssignForm({ ...assignForm, workDate: e.target.value })} required />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Ghi chú phân công</label>
            <input type="text" className="hc-input" placeholder="Ví dụ: Trực quầy chính sảnh..." value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      {/* Shift Definition Modal */}
      <Modal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title={editShiftId ? "Chỉnh Sửa Ca Làm Việc" : "Thêm Ca Làm Việc Mới"}
        subtitle={editShiftId ? `Cập nhật thông tin ca ${shiftForm.shiftName}` : "Định nghĩa ca trực mới trong hệ thống"}
        icon={editShiftId ? "bi-pencil-square" : "bi-clock-history"}
        maxWidth="540px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setShiftModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSaveShift} disabled={submittingShift}>
              {submittingShift ? "Đang lưu..." : editShiftId ? "Lưu thông tin" : "Tạo ca"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveShift}>
          <div className="hc-form-group">
            <label className="hc-label">
              Tên ca làm việc <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input
              type="text"
              className="hc-input"
              placeholder="ví dụ: Ca Sáng, Ca Chiều, Ca Đêm..."
              value={shiftForm.shiftName}
              onChange={(e) => setShiftForm({ ...shiftForm, shiftName: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div className="hc-form-group">
              <label className="hc-label">Giờ bắt đầu</label>
              <input type="time" className="hc-input" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} required />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Giờ kết thúc</label>
              <input type="time" className="hc-input" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} required />
            </div>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Mô tả nhiệm vụ</label>
            <textarea
              className="hc-textarea"
              rows="2"
              placeholder="Mô tả công việc trong ca..."
              value={shiftForm.description}
              onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
            ></textarea>
          </div>
        </form>
      </Modal>
    </div>
  );
}
