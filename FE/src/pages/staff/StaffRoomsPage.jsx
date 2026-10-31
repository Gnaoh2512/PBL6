import React, { useState, useEffect, useCallback } from "react";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatVND, getRoomTypeName, getRoomBasePrice } from "../../services/api";
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

export default function StaffRoomsPage() {
  const { addToast } = useToast();

  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, typesRes] = await Promise.all([apiCall("/api/admin/rooms", { silentError: true }), apiCall("/api/public/rooms/room-types", { silentError: true })]);

      if (roomsRes && roomsRes.success) setRooms(roomsRes.data || []);
      if (typesRes && typesRes.success) setRoomTypes(typesRes.data || []);
    } catch (err) {
      addToast(err.message || "Lỗi khi tải danh sách phòng", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleQuickStatus = async (roomId, newStatus) => {
    setUpdatingId(roomId);
    try {
      // Gọi đúng endpoint PATCH /api/admin/rooms/{id}/status
      const res = await apiCall(`/api/admin/rooms/${roomId}/status?status=${newStatus}`, {
        method: "PATCH",
      });
      if (res && res.success) {
        addToast("Cập nhật trạng thái phòng thành công!", "success");
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi đổi trạng thái phòng", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    const matchType = typeFilter === "ALL" || String(r.roomTypeId) === String(typeFilter);
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || String(r.roomNumber).toLowerCase().includes(query);
    return matchType && matchStatus && matchSearch;
  });

  const typeFilterOptions = [{ value: "ALL", label: "Tất cả hạng phòng" }, ...roomTypes.map((t) => ({ value: String(t.roomTypeId), label: t.typeName }))];

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", textAlign: "left" }}>
        <div>
          <h2>Sơ Đồ &amp; Trạng Thái Phòng</h2>
          <p>Theo dõi tình trạng vệ sinh, bảo trì và cập nhật trạng thái phòng trực tiếp.</p>
        </div>

        <button type="button" className="hc-btn hc-btn-outline" onClick={loadData} disabled={loading}>
          <i className="bi bi-arrow-clockwise"></i> Làm mới
        </button>
      </div>

      <div className="hc-card">
        <div className="hc-card-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--hc-border-light)" }}>
          <input
            type="search"
            className="hc-input"
            style={{ flex: "1 1 240px" }}
            placeholder="Tìm theo số phòng..."
            aria-label="Tìm phòng"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
            <p>Không tìm thấy phòng nào phù hợp.</p>
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
                  const isUpdating = updatingId === r.roomId;
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
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              title="Xác nhận đã dọn xong"
                              disabled={isUpdating}
                              onClick={() => handleQuickStatus(r.roomId, "AVAILABLE")}
                            >
                              <i className="bi bi-check2"></i> Đã dọn xong
                            </button>
                          )}
                          {r.status === "AVAILABLE" && (
                            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" title="Bắt đầu dọn dẹp" disabled={isUpdating} onClick={() => handleQuickStatus(r.roomId, "CLEANING")}>
                              <i className="bi bi-brush"></i> Dọn
                            </button>
                          )}
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
    </div>
  );
}
