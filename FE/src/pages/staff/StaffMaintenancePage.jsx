import { useCallback, useEffect, useState } from "react";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatDateTime } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import "./StaffMaintenance.css";

const TECHNICIANS_ENDPOINT = "/api/admin/users?role=MAINTENANCE";

const STATUS_META = {
  OPEN: { label: "Chờ xử lý", badge: "hc-badge-warning" },
  IN_PROGRESS: { label: "Đang xử lý", badge: "hc-badge-info" },
  DONE: { label: "Đã sửa xong", badge: "hc-badge-primary" },
  CONFIRMED: { label: "Đã nghiệm thu", badge: "hc-badge-success" },
};

const PRIORITY_META = {
  LOW: { label: "Thấp", badge: "hc-badge-muted" },
  MEDIUM: { label: "Trung bình", badge: "hc-badge-info" },
  HIGH: { label: "Cao", badge: "hc-badge-warning" },
  URGENT: { label: "Khẩn cấp", badge: "hc-badge-error" },
};

const STATUS_OPTIONS = [{ value: "", label: "Tất cả trạng thái" }, ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))];
const PRIORITY_FILTER_OPTIONS = [{ value: "", label: "Mọi mức độ" }, ...Object.entries(PRIORITY_META).map(([value, meta]) => ({ value, label: meta.label }))];
const PRIORITY_FORM_OPTIONS = Object.entries(PRIORITY_META).map(([value, meta]) => ({ value, label: meta.label }));

const EMPTY_FORM = { roomId: "", equipmentId: "", title: "", description: "", priority: "MEDIUM" };

const toTechnician = (item) => {
  const roleValue = item.role?.roleName ?? item.role ?? item.roleName;
  const roles = (Array.isArray(item.roles) ? item.roles : roleValue ? [roleValue] : []).map((r) => String(r?.roleName ?? r).toUpperCase());
  if (roles.length && !roles.includes("MAINTENANCE")) return null;
  const id = item.staffId ?? item.userId ?? item.id;
  const name = item.fullName ?? item.name ?? item.username ?? item.email;
  return id == null ? null : { id: String(id), name: name || `Nhân viên #${id}` };
};

const PRIORITY_ACCENT = {
  LOW: "var(--hc-text-muted)",
  MEDIUM: "var(--hc-info)",
  HIGH: "var(--hc-warning)",
  URGENT: "var(--hc-error)",
};

const STEPS = [
  { label: "Đã báo cáo", icon: "bi-flag" },
  { label: "Phân công", icon: "bi-person-gear" },
  { label: "Sửa xong", icon: "bi-wrench" },
  { label: "Nghiệm thu", icon: "bi-patch-check" },
];

const stepIndexOf = (request) => {
  if (request.status === "CONFIRMED") return 3;
  if (request.status === "DONE") return 2;
  if (request.status === "IN_PROGRESS" || request.assignedToStaff) return 1;
  return 0;
};

export default function StaffMaintenancePage() {
  const { hasRole } = useAuth();
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Detail modal state
  const [selectedId, setSelectedId] = useState(null);
  const [technicianId, setTechnicianId] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  // Preserved functional roles from original working file
  const canComplete = hasRole(["MAINTENANCE", "MANAGER", "ADMIN"]);
  const canAssign = hasRole(["MAINTENANCE", "MANAGER", "ADMIN"]);
  const canConfirm = hasRole(["MANAGER", "RECEPTIONIST", "ADMIN"]);
  const canReport = hasRole(["HOUSEKEEPING", "RECEPTIONIST", "MANAGER", "ADMIN"]);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (roomFilter) params.set("roomId", roomFilter);
      const query = params.size ? `?${params}` : "";
      const [requestResult, roomResult, equipmentResult] = await Promise.allSettled([
        apiCall(`/api/staff/maintenance/requests${query}`, { silentError: true }),
        canReport ? apiCall("/api/admin/rooms", { silentError: true }) : Promise.resolve(null),
        canReport ? apiCall("/api/staff/maintenance/equipment", { silentError: true }) : Promise.resolve(null),
      ]);
      setRequests(requestResult.status === "fulfilled" && requestResult.value?.success ? requestResult.value.data || [] : []);
      setRooms(roomResult.status === "fulfilled" && roomResult.value?.success ? roomResult.value.data || [] : []);
      setEquipment(equipmentResult.status === "fulfilled" && equipmentResult.value?.success ? equipmentResult.value.data || [] : []);
    } catch (error) {
      addToast(error.message || "Không thể tải yêu cầu bảo trì.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, canReport, priority, roomFilter, status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canAssign) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiCall(TECHNICIANS_ENDPOINT, { silentError: true });
        if (cancelled) return;
        const list = res?.success ? res.data || [] : [];
        setTechnicians(list.map(toTechnician).filter(Boolean));
      } catch {
        if (!cancelled) setTechnicians([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssign]);

  const reportIssue = async (event) => {
    event.preventDefault();
    if (!form.roomId) {
      addToast("Vui lòng chọn phòng gặp sự cố.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiCall("/api/staff/maintenance/report", {
        method: "POST",
        body: { ...form, roomId: Number(form.roomId), equipmentId: form.equipmentId ? Number(form.equipmentId) : null },
      });
      if (result?.success) {
        addToast("Đã gửi báo cáo bảo trì.", "success");
        setForm(EMPTY_FORM);
        await loadData();
      }
    } catch (error) {
      addToast(error.message || "Không thể gửi báo cáo.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openRequest = (request) => {
    setSelectedId(request.requestId);
    setTechnicianId("");
    setResolutionNote("");
  };
  const closeModal = () => setSelectedId(null);

  const updateRequest = async (request, action) => {
    setWorkingId(request.requestId);
    try {
      const note = resolutionNote.trim();
      if (action === "assign" && !technicianId) throw new Error("Vui lòng chọn kỹ thuật viên.");
      if (action === "complete" && !note) throw new Error("Vui lòng nhập ghi chú xử lý.");
      const endpoint =
        action === "assign"
          ? `/api/staff/maintenance/requests/${request.requestId}/assign?technicianId=${encodeURIComponent(technicianId)}`
          : `/api/staff/maintenance/requests/${request.requestId}/${action}`;
      const response = await apiCall(endpoint, { method: "POST", body: action === "complete" ? { resolutionNote: note } : undefined });
      if (response?.success) {
        addToast(action === "complete" ? "Đã cập nhật hoàn tất bảo trì." : action === "assign" ? "Đã phân công kỹ thuật viên." : "Đã xác nhận nghiệm thu.", "success");
        await loadData();
        if (action !== "assign") closeModal();
      }
    } catch (error) {
      addToast(error.message || "Không thể cập nhật yêu cầu.", "error");
    } finally {
      setWorkingId(null);
    }
  };

  const roomEquipment = equipment.filter((item) => item.status !== "RETIRED" && String(item.roomId) === String(form.roomId));

  const roomFormOptions = [
    { value: "", label: "Chọn phòng" },
    ...rooms.map((room) => ({
      value: String(room.roomId),
      label: `Phòng ${room.roomNumber}${room.floor ? ` · Tầng ${room.floor}` : ""}`,
    })),
  ];
  const equipmentOptions = form.roomId
    ? [
        { value: "", label: "Sự cố chung trong phòng" },
        ...roomEquipment.map((item) => ({
          value: String(item.equipmentId),
          label: `${item.equipmentName}${item.serialNumber ? ` · ${item.serialNumber}` : ""}`,
        })),
      ]
    : [{ value: "", label: "Chọn phòng trước" }];
  const roomFilterOptions = [{ value: "", label: "Tất cả phòng" }, ...rooms.map((room) => ({ value: String(room.roomId), label: `Phòng ${room.roomNumber}` }))];
  const technicianOptions = [{ value: "", label: technicians.length ? "Chọn kỹ thuật viên" : "Chưa có kỹ thuật viên" }, ...technicians.map((t) => ({ value: t.id, label: t.name }))];

  const selected = requests.find((r) => r.requestId === selectedId) || null;
  const selectedClosed = selected ? ["DONE", "CONFIRMED"].includes(selected.status) : false;
  const selStatus = selected ? STATUS_META[selected.status] || { label: selected.status, badge: "hc-badge-muted" } : null;
  const selPriority = selected ? PRIORITY_META[selected.priority] || { label: selected.priority, badge: "hc-badge-muted" } : null;
  const showAssign = !!selected && canAssign && !selectedClosed;
  const showComplete = !!selected && canComplete && !selectedClosed;
  const showConfirm = !!selected && canConfirm && selected.status === "DONE";
  const busy = workingId !== null;

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ textAlign: "left" }}>
        <h2>Bảo trì & sự cố</h2>
        <p>Báo cáo, theo dõi và nghiệm thu các yêu cầu sửa chữa.</p>
      </div>

      {canReport && (
        <div className="hc-card" style={{ marginBottom: "24px" }}>
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-exclamation-triangle text-primary" style={{ marginRight: "8px" }}></i>
              Tạo yêu cầu bảo trì
            </div>
          </div>
          <div className="hc-card-body">
            <form onSubmit={reportIssue}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                <div className="hc-form-group">
                  <label className="hc-label">
                    Phòng <span style={{ color: "var(--hc-error)" }}>*</span>
                  </label>
                  <SelectMenu value={form.roomId} onChange={(value) => setForm({ ...form, roomId: value, equipmentId: "" })} options={roomFormOptions} ariaLabel="Chọn phòng" icon="bi-door-open" />
                </div>
                <div className="hc-form-group">
                  <label className="hc-label">Thiết bị cụ thể</label>
                  <div style={form.roomId ? undefined : { opacity: 0.6, pointerEvents: "none" }}>
                    <SelectMenu value={form.equipmentId} onChange={(value) => setForm({ ...form, equipmentId: value })} options={equipmentOptions} ariaLabel="Chọn thiết bị" icon="bi-tools" />
                  </div>
                  {form.roomId && roomEquipment.length === 0 && <div className="hc-help-text">Phòng này chưa có thiết bị khả dụng để chọn.</div>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                <div className="hc-form-group">
                  <label className="hc-label">
                    Tiêu đề <span style={{ color: "var(--hc-error)" }}>*</span>
                  </label>
                  <input className="hc-input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Mô tả ngắn sự cố" />
                </div>
                <div className="hc-form-group">
                  <label className="hc-label">Mức độ ưu tiên</label>
                  <SelectMenu value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} options={PRIORITY_FORM_OPTIONS} ariaLabel="Mức độ ưu tiên" icon="bi-flag" />
                </div>
              </div>

              <div className="hc-form-group">
                <label className="hc-label">Mô tả</label>
                <textarea
                  className="hc-textarea"
                  rows="3"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Thông tin bổ sung"
                ></textarea>
              </div>

              <button type="submit" className="hc-btn hc-btn-primary" disabled={submitting || !rooms.length}>
                {submitting ? "Đang gửi…" : "Gửi báo cáo"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="hc-card">
        <div className="hc-card-header">
          <div className="hc-card-title">
            <i className="bi bi-wrench-adjustable text-primary" style={{ marginRight: "8px" }}></i>
            Danh sách yêu cầu
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: "180px" }}>
              <SelectMenu value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Lọc trạng thái" icon="bi-funnel" />
            </div>
            <div style={{ minWidth: "160px" }}>
              <SelectMenu value={priority} onChange={setPriority} options={PRIORITY_FILTER_OPTIONS} ariaLabel="Lọc ưu tiên" icon="bi-flag" />
            </div>
            {canReport && (
              <div style={{ minWidth: "160px" }}>
                <SelectMenu value={roomFilter} onChange={setRoomFilter} options={roomFilterOptions} ariaLabel="Lọc phòng" icon="bi-door-open" />
              </div>
            )}
            <button type="button" className="hc-btn hc-btn-outline" onClick={loadData} disabled={loading}>
              <i className="bi bi-arrow-clockwise"></i> Làm mới
            </button>
          </div>
        </div>

        {loading ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="hc-empty-state">
            <i className="bi bi-tools"></i>
            <p>Không có yêu cầu bảo trì phù hợp.</p>
          </div>
        ) : (
          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Sự cố</th>
                  <th>Phòng</th>
                  <th>Ưu tiên</th>
                  <th>Người xử lý</th>
                  <th>Báo lúc</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const statusMeta = STATUS_META[request.status] || { label: request.status, badge: "hc-badge-muted" };
                  const priorityMeta = PRIORITY_META[request.priority] || { label: request.priority, badge: "hc-badge-muted" };
                  return (
                    <tr
                      key={request.requestId}
                      className="mt-row"
                      tabIndex={0}
                      onClick={() => openRequest(request)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openRequest(request);
                        }
                      }}
                    >
                      <td>
                        <strong>{request.title}</strong>
                        {request.description && <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)", marginTop: "2px" }}>{request.description}</div>}
                        {request.equipmentName && <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)" }}>Thiết bị: {request.equipmentName}</div>}
                      </td>
                      <td>{request.roomNumber || "—"}</td>
                      <td>
                        <span className={`hc-badge ${priorityMeta.badge}`}>{priorityMeta.label}</span>
                      </td>
                      <td>{request.assignedToStaff || "Chưa phân công"}</td>
                      <td>{formatDateTime(request.reportedAt)}</td>
                      <td>
                        <span className={`hc-badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request detail modal */}
      <Modal
        isOpen={!!selected}
        onClose={closeModal}
        title={selected ? selected.title : "Chi tiết yêu cầu"}
        subtitle={selected ? `Yêu cầu #${selected.requestId}${selected.roomNumber ? ` · Phòng ${selected.roomNumber}` : ""}` : undefined}
        icon="bi-tools"
        accent={selected ? PRIORITY_ACCENT[selected.priority] : undefined}
        headerExtra={selected ? <span className={`hc-badge ${selStatus.badge}`}>{selStatus.label}</span> : undefined}
        maxWidth="600px"
        footer={
          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={closeModal}>
            Đóng
          </button>
        }
      >
        {selected && (
          <div className="mt-modal">
            <ol className="mt-steps" aria-label="Tiến độ xử lý">
              {STEPS.map((step, i) => {
                const idx = stepIndexOf(selected);
                return (
                  <li key={step.label} className={`mt-step ${i <= idx ? "is-done" : ""} ${i === idx ? "is-current" : ""}`} aria-current={i === idx ? "step" : undefined}>
                    <span className="mt-step-dot">
                      <i className={`bi ${i < idx ? "bi-check-lg" : step.icon}`}></i>
                    </span>
                    {step.label}
                  </li>
                );
              })}
            </ol>

            <div className="mt-tiles">
              <div className="mt-tile">
                <div className="mt-tile-icon">
                  <i className="bi bi-door-open"></i>
                </div>
                <div className="mt-tile-body">
                  <div className="mt-label">Phòng</div>
                  <div className="mt-value">{selected.roomNumber || "—"}</div>
                </div>
              </div>
              <div className="mt-tile">
                <div className="mt-tile-icon">
                  <i className="bi bi-hdd-stack"></i>
                </div>
                <div className="mt-tile-body">
                  <div className="mt-label">Thiết bị</div>
                  <div className="mt-value" title={selected.equipmentName || undefined}>
                    {selected.equipmentName || "Sự cố chung"}
                  </div>
                </div>
              </div>
              <div className="mt-tile">
                <div className="mt-tile-icon">
                  <i className="bi bi-flag"></i>
                </div>
                <div className="mt-tile-body">
                  <div className="mt-label">Ưu tiên</div>
                  <span className={`hc-badge ${selPriority.badge}`}>{selPriority.label}</span>
                </div>
              </div>
              <div className="mt-tile">
                <div className="mt-tile-icon">
                  <i className="bi bi-clock-history"></i>
                </div>
                <div className="mt-tile-body">
                  <div className="mt-label">Báo lúc</div>
                  <div className="mt-value">{formatDateTime(selected.reportedAt)}</div>
                </div>
              </div>
              <div className="mt-tile" style={{ gridColumn: "1 / -1" }}>
                <div className={`mt-avatar ${selected.assignedToStaff ? "" : "is-empty"}`}>
                  {selected.assignedToStaff ? String(selected.assignedToStaff).trim().charAt(0).toUpperCase() : <i className="bi bi-person-dash"></i>}
                </div>
                <div className="mt-tile-body">
                  <div className="mt-label">Người xử lý</div>
                  <div className="mt-value">{selected.assignedToStaff || "Chưa phân công"}</div>
                </div>
              </div>
            </div>

            {selected.description && (
              <div className="mt-block">
                <div className="mt-label">Mô tả sự cố</div>
                <p>{selected.description}</p>
              </div>
            )}

            {selected.resolutionNote && (
              <div className="mt-block is-success">
                <div className="mt-label">
                  <i className="bi bi-check-circle-fill"></i> Ghi chú xử lý
                </div>
                <p>{selected.resolutionNote}</p>
              </div>
            )}

            {showAssign && (
              <div className="mt-panel">
                <h4 className="mt-panel-title">
                  <i className="bi bi-person-gear"></i> Phân công kỹ thuật viên
                </h4>
                <div className="mt-inline">
                  <SelectMenu value={technicianId} onChange={setTechnicianId} options={technicianOptions} ariaLabel="Chọn kỹ thuật viên" icon="bi-person-badge" />
                  <button type="button" className="hc-btn hc-btn-outline" disabled={busy || !technicianId} onClick={() => updateRequest(selected, "assign")}>
                    {workingId === selected.requestId ? "Đang xử lý…" : "Phân công"}
                  </button>
                </div>
              </div>
            )}

            {showComplete && (
              <div className="mt-panel">
                <h4 className="mt-panel-title">
                  <i className="bi bi-clipboard-check"></i> Hoàn tất sửa chữa
                </h4>
                <div className="hc-form-group">
                  <textarea
                    className="hc-textarea"
                    rows="3"
                    aria-label="Ghi chú sửa chữa"
                    placeholder="Mô tả công việc đã thực hiện, linh kiện thay thế..."
                    value={resolutionNote}
                    onChange={(event) => setResolutionNote(event.target.value)}
                  ></textarea>
                </div>
                <button type="button" className="hc-btn hc-btn-primary" style={{ width: "100%" }} disabled={busy} onClick={() => updateRequest(selected, "complete")}>
                  <i className="bi bi-check2-circle"></i> {workingId === selected.requestId ? "Đang xử lý…" : "Hoàn tất yêu cầu"}
                </button>
              </div>
            )}

            {showConfirm && (
              <div className="mt-panel">
                <h4 className="mt-panel-title">
                  <i className="bi bi-patch-check"></i> Nghiệm thu
                </h4>
                <button type="button" className="hc-btn hc-btn-primary" style={{ width: "100%" }} disabled={busy} onClick={() => updateRequest(selected, "confirm")}>
                  <i className="bi bi-patch-check"></i> Xác nhận nghiệm thu
                </button>
              </div>
            )}

            {!showAssign && !showComplete && !showConfirm && !selectedClosed && (
              <div className="mt-readonly">
                <i className="bi bi-eye"></i> Bạn chỉ có quyền xem yêu cầu này.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
