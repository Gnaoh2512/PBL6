import React, { useCallback, useEffect, useState } from "react";
import { apiCall } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";

const STATUS_LABELS = {
  WORKING: "Đang hoạt động",
  BROKEN: "Hỏng",
  UNDER_REPAIR: "Đang sửa chữa",
  RETIRED: "Đã thanh lý",
};

const STATUS_COLORS = {
  WORKING: "hc-badge-success",
  BROKEN: "hc-badge-error",
  UNDER_REPAIR: "hc-badge-warning",
  RETIRED: "hc-badge-muted",
};

const EMPTY_FORM = {
  roomId: "",
  equipmentName: "",
  serialNumber: "",
  status: "WORKING",
  note: "",
};

export default function AdminEquipmentPage() {
  const { addToast } = useToast();
  const [equipment, setEquipment] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roomFilter, setRoomFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create, object = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [equipRes, roomRes] = await Promise.allSettled([apiCall("/api/staff/maintenance/equipment", { silentError: true }), apiCall("/api/admin/rooms", { silentError: true })]);
      setEquipment(equipRes.status === "fulfilled" && equipRes.value?.success ? equipRes.value.data || [] : []);
      setRooms(roomRes.status === "fulfilled" && roomRes.value?.success ? roomRes.value.data || [] : []);
    } catch (err) {
      addToast(err.message || "Không thể tải danh sách thiết bị.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      roomId: item.roomId ? String(item.roomId) : "",
      equipmentName: item.equipmentName || "",
      serialNumber: item.serialNumber || "",
      status: item.status || "WORKING",
      note: item.note || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.equipmentName.trim()) {
      addToast("Vui lòng nhập tên thiết bị.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        roomId: form.roomId ? Number(form.roomId) : null,
        equipmentName: form.equipmentName.trim(),
        serialNumber: form.serialNumber.trim() || null,
        status: form.status,
        note: form.note.trim() || null,
      };
      let res;
      if (editTarget) {
        res = await apiCall(`/api/admin/equipment/${editTarget.equipmentId}`, { method: "PUT", body });
      } else {
        res = await apiCall("/api/admin/equipment", { method: "POST", body });
      }
      if (res?.success) {
        addToast(editTarget ? "Đã cập nhật thiết bị." : "Đã thêm thiết bị mới.", "success");
        setModalOpen(false);
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Không thể lưu thiết bị.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      const res = await apiCall(`/api/admin/equipment/${item.equipmentId}/status?status=${encodeURIComponent(newStatus)}`, { method: "PATCH" });
      if (res?.success) {
        addToast(`Đã cập nhật trạng thái thiết bị sang ${STATUS_LABELS[newStatus] || newStatus}.`, "success");
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Không thể cập nhật trạng thái.", "error");
    }
  };

  const filtered = equipment.filter((item) => {
    const matchStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchRoom = roomFilter === "ALL" || String(item.roomId) === roomFilter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || (item.equipmentName || "").toLowerCase().includes(q) || (item.serialNumber || "").toLowerCase().includes(q);
    return matchStatus && matchRoom && matchSearch;
  });

  const getRoomLabel = (roomId) => {
    if (!roomId) return "Khu vực chung";
    const room = rooms.find((r) => r.roomId === roomId);
    return room ? `Phòng ${room.roomNumber}` : `Phòng #${roomId}`;
  };

  // SelectMenu Options
  const statusOptions = [{ value: "ALL", label: "Tất cả trạng thái" }, ...Object.entries(STATUS_LABELS).map(([v, label]) => ({ value: v, label }))];

  const roomOptions = [{ value: "ALL", label: "Tất cả vị trí" }, { value: "null", label: "Khu vực chung" }, ...rooms.map((r) => ({ value: String(r.roomId), label: `Phòng ${r.roomNumber}` }))];

  const roomFormOptions = [
    { value: "", label: "Khu vực chung (không thuộc phòng nào)" },
    ...rooms.map((r) => ({ value: String(r.roomId), label: `Phòng ${r.roomNumber}${r.floor ? ` · Tầng ${r.floor}` : ""}` })),
  ];

  const statusFormOptions = Object.entries(STATUS_LABELS).map(([v, label]) => ({ value: v, label }));

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", textAlign: "left" }}>
        <div>
          <h2>Thiết Bị &amp; Tài Sản</h2>
          <p>Theo dõi và quản lý tình trạng cơ sở vật chất, thiết bị trong khách sạn.</p>
        </div>
        <button type="button" className="hc-btn hc-btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-lg"></i> Thêm Thiết Bị
        </button>
      </div>

      <div className="hc-card">
        <div className="hc-card-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--hc-border-light)" }}>
          <input
            type="search"
            className="hc-input"
            style={{ flex: "1 1 240px" }}
            placeholder="Tìm theo tên, số serial..."
            aria-label="Tìm thiết bị"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ flex: "0 0 200px" }}>
            <SelectMenu value={statusFilter} onChange={setStatusFilter} options={statusOptions} ariaLabel="Lọc trạng thái" icon="bi-funnel" />
          </div>
          <div style={{ flex: "0 0 200px" }}>
            <SelectMenu value={roomFilter} onChange={setRoomFilter} options={roomOptions} ariaLabel="Lọc vị trí" icon="bi-geo-alt" />
          </div>
        </div>

        {loading ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="hc-empty-state">
            <i className="bi bi-cpu"></i>
            <p>Không tìm thấy thiết bị nào phù hợp.</p>
          </div>
        ) : (
          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Tên thiết bị</th>
                  <th>Số serial</th>
                  <th>Vị trí</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.equipmentId}>
                    <td>
                      <strong>{item.equipmentName}</strong>
                    </td>
                    <td>{item.serialNumber || "—"}</td>
                    <td>{getRoomLabel(item.roomId)}</td>
                    <td>
                      <span className={`hc-badge ${STATUS_COLORS[item.status] || "hc-badge-muted"}`}>{STATUS_LABELS[item.status] || item.status}</span>
                    </td>
                    <td style={{ maxWidth: 200, fontSize: "13px", color: "var(--hc-text-secondary)" }}>{item.note || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => openEdit(item)} title="Chỉnh sửa thông tin">
                          <i className="bi bi-pencil"></i> Sửa
                        </button>
                        {item.status !== "WORKING" && (
                          <button type="button" className="hc-btn hc-btn-success hc-btn-sm" onClick={() => handleStatusChange(item, "WORKING")} title="Đánh dấu hoạt động">
                            Hoạt động
                          </button>
                        )}
                        {item.status !== "UNDER_REPAIR" && item.status !== "RETIRED" && (
                          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => handleStatusChange(item, "UNDER_REPAIR")} title="Đưa vào sửa chữa">
                            Sửa chữa
                          </button>
                        )}
                        {item.status !== "BROKEN" && item.status !== "RETIRED" && (
                          <button type="button" className="hc-btn hc-btn-ghost hc-btn-sm" style={{ color: "var(--hc-error)" }} onClick={() => handleStatusChange(item, "BROKEN")} title="Đánh dấu hỏng">
                            Hỏng
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Chỉnh Sửa Thiết Bị" : "Thêm Thiết Bị Mới"}
        subtitle={editTarget ? `Cập nhật thông tin ${form.equipmentName}` : "Khai báo thiết bị, tài sản mới trong hệ thống"}
        icon={editTarget ? "bi-pencil-square" : "bi-cpu"}
        maxWidth="540px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang lưu..." : editTarget ? "Lưu thông tin" : "Thêm thiết bị"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="hc-form-group">
            <label className="hc-label">
              Tên thiết bị <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input
              type="text"
              className="hc-input"
              value={form.equipmentName}
              onChange={(e) => setForm({ ...form, equipmentName: e.target.value })}
              placeholder="Ví dụ: Điều hòa, TV, Tủ lạnh..."
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div className="hc-form-group">
              <label className="hc-label">Vị trí phòng</label>
              <SelectMenu value={form.roomId} onChange={(val) => setForm({ ...form, roomId: val })} options={roomFormOptions} ariaLabel="Chọn vị trí phòng" icon="bi-door-closed" />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Trạng thái</label>
              <SelectMenu value={form.status} onChange={(val) => setForm({ ...form, status: val })} options={statusFormOptions} ariaLabel="Trạng thái thiết bị" icon="bi-activity" />
            </div>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Số serial / Mã tài sản</label>
            <input type="text" className="hc-input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Nhập số serial (tùy chọn)" />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Ghi chú</label>
            <textarea
              className="hc-textarea"
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Ghi chú bổ sung về tình trạng thiết bị..."
            ></textarea>
          </div>
        </form>
      </Modal>
    </div>
  );
}
