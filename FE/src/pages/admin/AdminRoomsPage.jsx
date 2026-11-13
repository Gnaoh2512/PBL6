import React, { useState, useEffect } from "react";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatVND, getRoomTypeName, getRoomBasePrice, getRoomTypeId } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";

const STATUS_META = {
  AVAILABLE: { label: "Trống", badge: "hc-badge-success" },
  OCCUPIED: { label: "Đang ở", badge: "hc-badge-error" },
  CLEANING: { label: "Đang dọn", badge: "hc-badge-warning" },
  MAINTENANCE: { label: "Bảo trì", badge: "hc-badge-muted" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "AVAILABLE", label: "Trống" },
  { value: "OCCUPIED", label: "Đang ở" },
  { value: "CLEANING", label: "Đang dọn" },
  { value: "MAINTENANCE", label: "Bảo trì" },
];

const STATUS_FORM_OPTIONS = [
  { value: "AVAILABLE", label: "Trống" },
  { value: "CLEANING", label: "Đang dọn" },
  { value: "MAINTENANCE", label: "Bảo trì" },
  { value: "OCCUPIED", label: "Đang ở" },
];

export default function AdminRoomsPage() {
  const { addToast } = useToast();

  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal Create/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editRoomId, setEditRoomId] = useState(null);
  const [form, setForm] = useState({
    roomNumber: "",
    roomTypeId: "",
    floor: 1,
    status: "AVAILABLE",
  });
  const [submitting, setSubmitting] = useState(false);

  // Modal Phân công Dọn phòng Chặt chẽ
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [cleaningTarget, setCleaningTarget] = useState(null);
  const [housekeepers, setHousekeepers] = useState([]);
  const [selectedHousekeeperId, setSelectedHousekeeperId] = useState("");
  const [assignPriority, setAssignPriority] = useState("MEDIUM");
  const [assignNote, setAssignNote] = useState("");
  const [loadingHousekeepers, setLoadingHousekeepers] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [roomsRes, typesRes] = await Promise.all([apiCall("/api/admin/rooms", { silentError: true }), apiCall("/api/public/rooms/room-types", { silentError: true })]);

      if (roomsRes && roomsRes.success) setRooms(roomsRes.data || []);
      if (typesRes && typesRes.success) {
        setRoomTypes(typesRes.data || []);
        if (typesRes.data.length > 0 && !form.roomTypeId) {
          setForm((prev) => ({ ...prev, roomTypeId: typesRes.data[0].roomTypeId }));
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditRoomId(null);
    setForm({
      roomNumber: "",
      roomTypeId: roomTypes[0]?.roomTypeId || "",
      floor: 1,
      status: "AVAILABLE",
    });
    setModalOpen(true);
  };

  const openEditModal = (room) => {
    setEditRoomId(room.roomId);
    setForm({
      roomNumber: room.roomNumber,
      roomTypeId: getRoomTypeId(room) || roomTypes[0]?.roomTypeId || "",
      floor: room.floor || 1,
      status: room.status || "AVAILABLE",
    });
    setModalOpen(true);
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    if (!form.roomNumber.trim() || !form.roomTypeId) {
      addToast("Vui lòng điền số phòng và chọn hạng phòng!", "warning");
      return;
    }

    setSubmitting(true);
    const payload = {
      roomNumber: form.roomNumber.trim(),
      roomTypeId: parseInt(form.roomTypeId),
      floor: parseInt(form.floor) || 1,
      status: form.status,
    };

    try {
      let res;
      if (editRoomId) {
        res = await apiCall(`/api/admin/rooms/${editRoomId}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        res = await apiCall("/api/admin/rooms", {
          method: "POST",
          body: payload,
        });
      }

      if (res && res.success) {
        addToast(`${editRoomId ? "Cập nhật" : "Thêm"} phòng ${form.roomNumber} thành công!`, "success");
        setModalOpen(false);
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi lưu thông tin phòng", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatus = async (roomId, newStatus) => {
    try {
      const res = await apiCall(`/api/admin/rooms/${roomId}/status?status=${newStatus}`, {
        method: "PATCH",
      });
      if (res && res.success) {
        addToast("Cập nhật trạng thái phòng thành công!", "success");
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi đổi trạng thái", "error");
    }
  };

  const fetchHousekeepers = async () => {
    setLoadingHousekeepers(true);
    try {
      const res = await apiCall("/api/staff/available-in-shift?roleCode=ROLE_HOUSEKEEPING", { silentError: true });
      const list = res?.success && Array.isArray(res.data) ? res.data : [];
      const formatted = list.map((item) => {
        const id = item.accountId ?? item.id;
        const name = item.fullName || item.username || `Nhân viên #${id}`;
        const start = item.shiftStartTime ? String(item.shiftStartTime).slice(0, 5) : "";
        const end = item.shiftEndTime ? String(item.shiftEndTime).slice(0, 5) : "";
        const timeStr = start && end ? ` (${start} - ${end})` : "";
        const shiftStr = item.shiftName ? ` — ${item.shiftName}${timeStr}` : "";
        return {
          id: String(id),
          name: `${name}${shiftStr}`,
          raw: item,
        };
      });
      setHousekeepers(formatted);
      if (formatted.length > 0 && !selectedHousekeeperId) {
        setSelectedHousekeeperId(formatted[0].id);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách buồng phòng trong ca:", err);
      setHousekeepers([]);
    } finally {
      setLoadingHousekeepers(false);
    }
  };

  const openAssignCleaningModal = (targetRoom) => {
    setCleaningTarget(targetRoom);
    setSelectedHousekeeperId("");
    setAssignPriority("MEDIUM");
    setAssignNote("");
    setAssignModalOpen(true);
    fetchHousekeepers();
  };

  const closeAssignCleaningModal = () => {
    setAssignModalOpen(false);
    setCleaningTarget(null);
    setSelectedHousekeeperId("");
    setAssignPriority("MEDIUM");
    setAssignNote("");
  };

  const handleConfirmAssignCleaning = async () => {
    if (!cleaningTarget || !selectedHousekeeperId) {
      addToast("Vui lòng chọn nhân viên buồng phòng đang trong ca trực.", "warning");
      return;
    }
    setSubmittingAssign(true);
    try {
      const res = await apiCall("/api/staff/room-cleaning", {
        method: "POST",
        body: {
          roomId: Number(cleaningTarget.roomId),
          assignedToId: Number(selectedHousekeeperId),
          priority: assignPriority,
          note: assignNote.trim() || null,
        },
      });

      if (res && res.success) {
        addToast(`Đã phân công nhân viên dọn phòng ${cleaningTarget.roomNumber} thành công!`, "success");
        closeAssignCleaningModal();
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi phân công nhân viên buồng phòng.", "error");
    } finally {
      setSubmittingAssign(false);
    }
  };

  const housekeeperOptions = [
    {
      value: "",
      label: loadingHousekeepers
        ? "Đang tải nhân viên trong ca trực…"
        : housekeepers.length
        ? "Chọn nhân viên buồng phòng có ca trực"
        : "Không có nhân viên buồng phòng trong ca trực",
    },
    ...housekeepers.map((h) => ({ value: h.id, label: h.name })),
  ];

  const PRIORITY_OPTIONS = [
    { value: "LOW", label: "Thấp" },
    { value: "MEDIUM", label: "Trung bình" },
    { value: "HIGH", label: "Cao" },
    { value: "URGENT", label: "Khẩn cấp" },
  ];

  const filteredRooms = rooms.filter((r) => {
    const matchType = typeFilter === "ALL" || String(r.roomTypeId) === String(typeFilter);
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchType && matchStatus;
  });

  const typeFilterOptions = [{ value: "ALL", label: "Tất cả hạng phòng" }, ...roomTypes.map((t) => ({ value: String(t.roomTypeId), label: t.typeName }))];
  const typeFormOptions = roomTypes.map((t) => ({
    value: String(t.roomTypeId),
    label: `${t.typeName} - ${formatVND(t.basePrice)}/đêm (${t.capacity} khách)`,
  }));

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", textAlign: "left" }}>
        <div>
          <h2>Danh Mục Phòng & Hạng Phòng</h2>
          <p>Quản lý danh sách phòng và trạng thái phòng.</p>
        </div>

        <button type="button" className="hc-btn hc-btn-primary" onClick={openCreateModal}>
          <i className="bi bi-plus-lg"></i> Thêm Phòng Mới
        </button>
      </div>

      <div className="hc-card">
        <div className="hc-card-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--hc-border-light)" }}>
          <div style={{ flex: "1 1 200px" }}>
            <SelectMenu value={typeFilter} onChange={setTypeFilter} options={typeFilterOptions} ariaLabel="Lọc hạng phòng" icon="bi-layers" />
          </div>
          <div style={{ flex: "0 0 220px" }}>
            <SelectMenu value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} ariaLabel="Lọc trạng thái" icon="bi-funnel" />
          </div>
        </div>

        {loading ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="hc-empty-state">
            <i className="bi bi-door-closed"></i>
            <p>Không tìm thấy phòng nào.</p>
          </div>
        ) : (
          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Số phòng</th>
                  <th>Hạng phòng</th>
                  <th>Tầng</th>
                  <th>Đơn giá</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((r) => {
                  const meta = STATUS_META[r.status] || STATUS_META.MAINTENANCE;
                  return (
                    <tr key={r.roomId}>
                      <td>
                        <strong>Phòng {r.roomNumber}</strong>
                      </td>
                      <td>{getRoomTypeName(r)}</td>
                      <td>Tầng {r.floor || 1}</td>
                      <td>{formatVND(getRoomBasePrice(r))} / đêm</td>
                      <td>
                        <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          {r.status === "CLEANING" && (
                            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" title="Xác nhận đã dọn xong" onClick={() => handleQuickStatus(r.roomId, "AVAILABLE")}>
                              <i className="bi bi-check2"></i> Đã dọn xong
                            </button>
                          )}
                          {(r.status === "AVAILABLE" || r.status === "CLEANING") && (
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              title="Phân công nhân viên buồng phòng có ca trực"
                              onClick={() => openAssignCleaningModal(r)}
                            >
                              <i className="bi bi-person-gear"></i> Phân công dọn
                            </button>
                          )}
                          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => openEditModal(r)}>
                            <i className="bi bi-pencil"></i> Sửa
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRoomId ? "Chỉnh Sửa Phòng" : "Thêm Phòng Mới"}
        subtitle={editRoomId ? `Cập nhật thông tin phòng ${form.roomNumber}` : "Tạo phòng mới trong hệ thống"}
        icon={editRoomId ? "bi-pencil-square" : "bi-door-open"}
        maxWidth="540px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSaveRoom} disabled={submitting}>
              {submitting ? "Đang lưu..." : editRoomId ? "Lưu thông tin" : "Thêm phòng"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveRoom}>
          <div className="hc-form-group">
            <label className="hc-label">
              Số phòng <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input type="text" className="hc-input" placeholder="Ví dụ: 101, 202, 305..." value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} required />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Hạng phòng <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <SelectMenu value={form.roomTypeId} onChange={(value) => setForm({ ...form, roomTypeId: value })} options={typeFormOptions} ariaLabel="Hạng phòng" icon="bi-layers" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div className="hc-form-group">
              <label className="hc-label">Tầng</label>
              <input type="number" className="hc-input" min="1" max="50" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Trạng thái phòng</label>
              <SelectMenu value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={STATUS_FORM_OPTIONS} ariaLabel="Trạng thái phòng" icon="bi-toggles" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Phân công Dọn phòng Chặt chẽ (Strict Housekeeper Shift Modal) */}
      <Modal
        isOpen={assignModalOpen}
        onClose={closeAssignCleaningModal}
        title={`Phân công dọn phòng — Phòng ${cleaningTarget?.roomNumber || ""}`}
        subtitle={cleaningTarget ? `Tầng ${cleaningTarget.floor || 1} · Trạng thái: ${cleaningTarget.status || "Đang dọn"}` : undefined}
        icon="bi-brush"
        maxWidth="540px"
      >
        {cleaningTarget && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                background: "var(--hc-bg-subtle, #f8fafc)",
                border: "1px solid var(--hc-border-light, #e2e8f0)",
                borderRadius: "8px",
                padding: "12px 16px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <span style={{ color: "var(--hc-text-secondary)", fontSize: "0.75rem", display: "block" }}>Số phòng</span>
                <strong>Phòng {cleaningTarget.roomNumber}</strong>
              </div>
              <div>
                <span style={{ color: "var(--hc-text-secondary)", fontSize: "0.75rem", display: "block" }}>Vị trí</span>
                <span>Tầng {cleaningTarget.floor || 1}</span>
              </div>
              <div>
                <span style={{ color: "var(--hc-text-secondary)", fontSize: "0.75rem", display: "block" }}>Hạng phòng</span>
                <span>{getRoomTypeName(cleaningTarget)}</span>
              </div>
            </div>

            <div className="hc-form-group">
              <label className="hc-label" style={{ fontWeight: 600 }}>
                Nhân viên buồng phòng (Đang trong ca trực) <span style={{ color: "var(--hc-error)" }}>*</span>
              </label>

              {loadingHousekeepers ? (
                <div style={{ padding: "10px 0", color: "var(--hc-text-secondary)", fontSize: "0.875rem" }}>
                  <i className="bi bi-arrow-clockwise admin-schedule-spin" style={{ marginRight: "6px" }}></i>
                  Đang kiểm tra lịch ca trực của nhân viên buồng phòng...
                </div>
              ) : housekeepers.length === 0 ? (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fef3c7",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontSize: "0.85rem",
                    color: "#92400e",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: "1.1rem", color: "#f59e0b", flexShrink: 0 }}></i>
                  <div>
                    <strong>Không có nhân viên trong ca trực:</strong> Hiện tại không có nhân viên buồng phòng nào có lịch trực hoạt động theo ca. Vui lòng xếp ca trực tại mục <strong>Quản lý Lịch làm việc</strong> trước khi phân công.
                  </div>
                </div>
              ) : (
                <SelectMenu
                  value={selectedHousekeeperId}
                  onChange={setSelectedHousekeeperId}
                  options={housekeeperOptions}
                  ariaLabel="Chọn nhân viên buồng phòng có ca trực"
                  icon="bi-person-badge"
                />
              )}
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Mức độ ưu tiên</label>
              <SelectMenu
                value={assignPriority}
                onChange={setAssignPriority}
                options={PRIORITY_OPTIONS}
                ariaLabel="Mức độ ưu tiên"
                icon="bi-flag"
              />
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Ghi chú dọn phòng (tùy chọn)</label>
              <textarea
                className="hc-textarea"
                rows="2"
                placeholder="Ví dụ: Khách check-in sớm, thay chăn ga, bổ sung đồ dùng..."
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button type="button" className="hc-btn hc-btn-outline" onClick={closeAssignCleaningModal} disabled={submittingAssign}>
                Đóng
              </button>
              <button
                type="button"
                className="hc-btn hc-btn-primary"
                onClick={handleConfirmAssignCleaning}
                disabled={submittingAssign || !selectedHousekeeperId || housekeepers.length === 0}
              >
                <i className="bi bi-check2-circle"></i>
                {submittingAssign ? "Đang lưu…" : "Xác nhận phân công"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
