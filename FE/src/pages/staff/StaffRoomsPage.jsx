import React, { useState, useEffect, useCallback } from "react";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatDateTime, formatVND, getRoomTypeName, getRoomBasePrice } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";

const STATUS_META = {
  AVAILABLE: { label: "Trống", badge: "hc-badge-success" },
  OCCUPIED: { label: "Đang ở", badge: "hc-badge-error" },
  CLEANING: { label: "Đang dọn", badge: "hc-badge-warning" },
  MAINTENANCE: { label: "Bảo trì", badge: "hc-badge-muted" },
};

const BOOKING_STATUS_META = {
  PENDING_DEPOSIT: { label: "Chờ đặt cọc", badge: "hc-badge-warning" },
  CONFIRMED: { label: "Đã xác nhận", badge: "hc-badge-info" },
  CHECKED_IN: { label: "Đang lưu trú", badge: "hc-badge-success" },
  CHECKED_OUT: { label: "Đã trả phòng", badge: "hc-badge-muted" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-error" },
  EXPIRED: { label: "Hết hạn", badge: "hc-badge-muted" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "AVAILABLE", label: "Trống" },
  { value: "OCCUPIED", label: "Đang ở" },
  { value: "CLEANING", label: "Đang dọn" },
  { value: "MAINTENANCE", label: "Bảo trì" },
];

const CLEANING_PRIORITY_META = {
  LOW: { label: "Thấp", badge: "hc-badge-muted" },
  MEDIUM: { label: "Trung bình", badge: "hc-badge-info" },
  HIGH: { label: "Cao", badge: "hc-badge-warning" },
  URGENT: { label: "Khẩn cấp", badge: "hc-badge-error" },
};

const CLEANING_STATUS_META = {
  PENDING: { label: "Chờ dọn", badge: "hc-badge-warning" },
  IN_PROGRESS: { label: "Đang dọn", badge: "hc-badge-info" },
  COMPLETED: { label: "Đã hoàn tất", badge: "hc-badge-success" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-muted" },
};

const CLEANING_STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái dọn" },
  { value: "PENDING", label: "Chờ dọn" },
  { value: "IN_PROGRESS", label: "Đang dọn" },
  { value: "COMPLETED", label: "Đã hoàn tất" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Thấp" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HIGH", label: "Cao" },
  { value: "URGENT", label: "Khẩn cấp" },
];

export default function StaffRoomsPage() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("ROOMS");
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [cleaningRequests, setCleaningRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false);
  const [roomBookings, setRoomBookings] = useState([]);
  const [loadingRoomBookings, setLoadingRoomBookings] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);

  const openRoomDetails = async (room) => {
    setSelectedRoom(room);
    setRoomBookings([]);
    setRoomDetailsOpen(true);
    setLoadingRoomBookings(true);
    try {
      const res = await apiCall(`/api/admin/rooms/${room.roomId}/bookings`, { silentError: true });
      if (res?.success) {
        setRoomBookings(Array.isArray(res.data) ? res.data : []);
      } else {
        addToast(res?.message || "Không tải được thông tin đặt phòng.", "error");
      }
    } catch (err) {
      addToast(err.message || "Không tải được thông tin đặt phòng.", "error");
    } finally {
      setLoadingRoomBookings(false);
    }
  };

  // Filters for rooms
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Filters for cleaning requests
  const [cleaningStatusFilter, setCleaningStatusFilter] = useState("ALL");

  // Strict Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [cleaningTarget, setCleaningTarget] = useState(null);
  const [housekeepers, setHousekeepers] = useState([]);
  const [selectedHousekeeperId, setSelectedHousekeeperId] = useState("");
  const [assignPriority, setAssignPriority] = useState("MEDIUM");
  const [assignNote, setAssignNote] = useState("");
  const [loadingHousekeepers, setLoadingHousekeepers] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, typesRes, cleanRes] = await Promise.all([
        apiCall("/api/admin/rooms", { silentError: true }),
        apiCall("/api/public/rooms/room-types", { silentError: true }),
        apiCall("/api/staff/room-cleaning", { silentError: true }),
      ]);

      if (roomsRes && roomsRes.success) setRooms(roomsRes.data || []);
      if (typesRes && typesRes.success) setRoomTypes(typesRes.data || []);
      if (cleanRes && cleanRes.success) setCleaningRequests(cleanRes.data || []);
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

  const openAssignCleaningModal = (target) => {
    setCleaningTarget(target);
    setSelectedHousekeeperId(target.assignedToId ? String(target.assignedToId) : "");
    setAssignPriority(target.priority || "MEDIUM");
    setAssignNote(target.note || "");
    setAssignModalOpen(true);
    fetchHousekeepers();
  };

  const closeAssignModal = () => {
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
      let res;
      if (cleaningTarget.cleaningId) {
        // Phân công yêu cầu dọn phòng đã có
        res = await apiCall(`/api/staff/room-cleaning/${cleaningTarget.cleaningId}/assign?staffId=${encodeURIComponent(selectedHousekeeperId)}`, {
          method: "POST",
        });
      } else {
        // Tạo mới yêu cầu dọn phòng và phân công trực tiếp
        res = await apiCall("/api/staff/room-cleaning", {
          method: "POST",
          body: {
            roomId: Number(cleaningTarget.roomId),
            assignedToId: Number(selectedHousekeeperId),
            priority: assignPriority,
            note: assignNote.trim() || null,
          },
        });
      }

      if (res && res.success) {
        addToast(`Đã phân công dọn dẹp phòng ${cleaningTarget.roomNumber} thành công!`, "success");
        closeAssignModal();
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi phân công nhân viên buồng phòng.", "error");
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleCompleteCleaning = async (item) => {
    setUpdatingId(item.cleaningId);
    try {
      const res = await apiCall(`/api/staff/room-cleaning/${item.cleaningId}/complete`, {
        method: "POST",
      });
      if (res && res.success) {
        addToast(`Đã hoàn tất dọn dẹp phòng ${item.roomNumber}! Phòng chuyển sang trạng thái TRỐNG (AVAILABLE).`, "success");
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi hoàn tất dọn phòng.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteCleaning = async (cleaningId) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy yêu cầu dọn phòng này?")) return;
    try {
      const res = await apiCall(`/api/staff/room-cleaning/${cleaningId}`, {
        method: "DELETE",
      });
      if (res && res.success) {
        addToast("Đã hủy yêu cầu dọn phòng.", "success");
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi xóa yêu cầu dọn phòng.", "error");
    }
  };

  // Filters
  const filteredRooms = rooms.filter((r) => {
    const matchType = typeFilter === "ALL" || String(r.roomTypeId) === String(typeFilter);
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || String(r.roomNumber).toLowerCase().includes(query);
    return matchType && matchStatus && matchSearch;
  });

  const filteredCleaning = cleaningRequests.filter((c) => {
    if (cleaningStatusFilter === "ALL") return true;
    return c.status === cleaningStatusFilter;
  });

  const typeFilterOptions = [{ value: "ALL", label: "Tất cả hạng phòng" }, ...roomTypes.map((t) => ({ value: String(t.roomTypeId), label: t.typeName }))];

  const housekeeperOptions = [
    {
      value: "",
      label: loadingHousekeepers ? "Đang tải nhân viên trong ca trực…" : housekeepers.length ? "Chọn nhân viên buồng phòng có ca trực" : "Không có nhân viên buồng phòng trong ca trực",
    },
    ...housekeepers.map((h) => ({ value: h.id, label: h.name })),
  ];

  const pendingCleaningCount = cleaningRequests.filter((c) => c.status !== "COMPLETED" && c.status !== "CANCELED").length;

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", textAlign: "left" }}>
        <div>
          <h2>Sơ Đồ &amp; Buồng Phòng</h2>
          <p>Theo dõi tình trạng vệ sinh phòng, phân công ca trực dọn phòng chặt chẽ và nghiệm thu buồng phòng.</p>
        </div>

        <button type="button" className="hc-btn hc-btn-outline" onClick={loadData} disabled={loading}>
          <i className="bi bi-arrow-clockwise"></i> Làm mới
        </button>
      </div>

      {/* Tabs */}
      <div className="hc-tab-group" style={{ marginBottom: "20px" }}>
        <button type="button" className={`hc-tab-btn ${activeTab === "ROOMS" ? "active" : ""}`} onClick={() => setActiveTab("ROOMS")}>
          <i className="bi bi-door-open" style={{ marginRight: "6px" }}></i>
          Sơ đồ phòng ({rooms.length})
        </button>
        <button type="button" className={`hc-tab-btn ${activeTab === "CLEANING" ? "active" : ""}`} onClick={() => setActiveTab("CLEANING")}>
          <i className="bi bi-brush" style={{ marginRight: "6px" }}></i>
          Yêu cầu dọn phòng{" "}
          {pendingCleaningCount > 0 && (
            <span className="hc-badge hc-badge-warning" style={{ marginLeft: "6px" }}>
              {pendingCleaningCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "ROOMS" && (
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
                          <button
                            type="button"
                            onClick={() => openRoomDetails(r)}
                            style={{
                              border: 0,
                              padding: 0,
                              background: "transparent",
                              color: "var(--hc-primary)",
                              fontWeight: 700,
                              cursor: "pointer",
                              textDecoration: "underline",
                              textUnderlineOffset: "3px",
                            }}
                            title="Xem khách đã đặt phòng này"
                          >
                            Phòng {r.roomNumber}
                          </button>
                        </td>
                        <td>{getRoomTypeName(r)}</td>
                        <td>Tầng {r.floor || 1}</td>
                        <td>{formatVND(getRoomBasePrice(r))} / đêm</td>
                        <td>
                          <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
                            {(r.status === "AVAILABLE" || r.status === "CLEANING") && (
                              <button
                                type="button"
                                className="hc-btn hc-btn-primary hc-btn-sm"
                                title="Phân công nhân viên buồng phòng có ca trực"
                                disabled={isUpdating}
                                onClick={() => openAssignCleaningModal(r)}
                              >
                                <i className="bi bi-person-gear"></i> Phân công dọn
                              </button>
                            )}
                            {r.status === "AVAILABLE" && (
                              <button
                                type="button"
                                className="hc-btn hc-btn-outline hc-btn-sm"
                                title="Bắt đầu dọn dẹp nhanh"
                                disabled={isUpdating}
                                onClick={() => handleQuickStatus(r.roomId, "CLEANING")}
                              >
                                <i className="bi bi-brush"></i> Dọn nhanh
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
      )}

      {activeTab === "CLEANING" && (
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-brush text-primary" style={{ marginRight: "8px" }}></i>
              Danh sách yêu cầu dọn phòng
            </div>
            <div style={{ minWidth: "220px" }}>
              <SelectMenu value={cleaningStatusFilter} onChange={setCleaningStatusFilter} options={CLEANING_STATUS_OPTIONS} ariaLabel="Lọc trạng thái dọn" icon="bi-funnel" />
            </div>
          </div>

          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : filteredCleaning.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-inbox"></i>
              <p>Chưa có yêu cầu dọn phòng nào.</p>
            </div>
          ) : (
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Tầng</th>
                    <th>Người dọn phòng</th>
                    <th>Ưu tiên</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                    <th>Ghi chú</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCleaning.map((c) => {
                    const stMeta = CLEANING_STATUS_META[c.status] || { label: c.status, badge: "hc-badge-muted" };
                    const priMeta = CLEANING_PRIORITY_META[c.priority] || CLEANING_PRIORITY_META.MEDIUM;
                    const isBusy = updatingId === c.cleaningId;
                    return (
                      <tr key={c.cleaningId}>
                        <td>
                          <strong>Phòng {c.roomNumber}</strong>
                          {c.bookingCode && <div style={{ fontSize: "11px", color: "var(--hc-text-secondary)" }}>#{c.bookingCode}</div>}
                        </td>
                        <td>Tầng {c.floor || 1}</td>
                        <td>
                          {c.assignedToName ? (
                            <span className="hc-badge hc-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <i className="bi bi-person-check-fill"></i> {c.assignedToName}
                            </span>
                          ) : (
                            <span style={{ color: "var(--hc-text-muted)", fontSize: "12px", fontStyle: "italic" }}>Chưa phân công</span>
                          )}
                        </td>
                        <td>
                          <span className={`hc-badge ${priMeta.badge}`}>{priMeta.label}</span>
                        </td>
                        <td>
                          <span className={`hc-badge ${stMeta.badge}`}>{stMeta.label}</span>
                        </td>
                        <td style={{ fontSize: "12px" }}>
                          <div>Tạo: {formatDateTime(c.requestedAt)}</div>
                          {c.completedAt && <div style={{ color: "var(--hc-success)" }}>Xong: {formatDateTime(c.completedAt)}</div>}
                        </td>
                        <td style={{ maxWidth: "200px", fontSize: "12px", color: "var(--hc-text-secondary)" }}>{c.note || "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                            {c.status !== "COMPLETED" && (
                              <>
                                <button
                                  type="button"
                                  className="hc-btn hc-btn-outline hc-btn-sm"
                                  disabled={isBusy}
                                  onClick={() => openAssignCleaningModal(c)}
                                  title="Phân công lại nhân viên buồng phòng"
                                >
                                  <i className="bi bi-person-gear"></i> Phân công
                                </button>
                                <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={isBusy} onClick={() => handleCompleteCleaning(c)} title="Xác nhận đã dọn xong phòng này">
                                  <i className="bi bi-check2-circle"></i> Hoàn tất
                                </button>
                                <button
                                  type="button"
                                  className="hc-btn hc-btn-outline hc-btn-sm"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteCleaning(c.cleaningId)}
                                  style={{ color: "#dc2626", borderColor: "#fca5a5" }}
                                  title="Hủy yêu cầu dọn phòng"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </>
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
      )}

      <Modal
        isOpen={roomDetailsOpen}
        onClose={() => {
          setRoomDetailsOpen(false);
          setSelectedRoom(null);
          setRoomBookings([]);
        }}
        title={`Thông tin đặt phòng — Phòng ${selectedRoom?.roomNumber || ""}`}
        subtitle={selectedRoom ? `${getRoomTypeName(selectedRoom)} · Tầng ${selectedRoom.floor || 1}` : ""}
        icon="bi-people"
        maxWidth="860px"
      >
        {loadingRoomBookings ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : roomBookings.length === 0 ? (
          <div className="hc-empty-state">
            <i className="bi bi-calendar-x"></i>
            <p>Chưa có thông tin đặt phòng cho phòng này.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "65vh", overflowY: "auto" }}>
            {roomBookings.map((booking) => {
              const bookingStatus = BOOKING_STATUS_META[booking.status] || { label: booking.status || "Không rõ", badge: "hc-badge-muted" };
              return (
                <section key={booking.bookingId} style={{ border: "1px solid var(--hc-border-light)", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
                    <div>
                      <strong>{booking.customerName || "Khách chưa cập nhật tên"}</strong>
                      <div style={{ color: "var(--hc-text-secondary)", fontSize: "12px" }}>{booking.bookingCode}</div>
                    </div>
                    <span className={`hc-badge ${bookingStatus.badge}`}>{bookingStatus.label}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", fontSize: "13px" }}>
                    <div>
                      <small style={{ display: "block", color: "var(--hc-text-secondary)" }}>Số điện thoại</small>
                      <strong>{booking.customerPhone || "—"}</strong>
                    </div>
                    <div>
                      <small style={{ display: "block", color: "var(--hc-text-secondary)" }}>Email</small>
                      <strong>{booking.customerEmail || "—"}</strong>
                    </div>
                    <div>
                      <small style={{ display: "block", color: "var(--hc-text-secondary)" }}>CCCD / CMND</small>
                      <strong>{booking.idNumber || "—"}</strong>
                    </div>
                    <div>
                      <small style={{ display: "block", color: "var(--hc-text-secondary)" }}>Số khách</small>
                      <strong>{booking.guestCount ?? "—"}</strong>
                    </div>
                    <div>
                      <small style={{ display: "block", color: "var(--hc-text-secondary)" }}>Ngày nhận phòng</small>
                      <strong>{booking.checkInDate || "—"}</strong>
                    </div>
                    <div>
                      <small style={{ display: "block", color: "var(--hc-text-secondary)" }}>Ngày trả phòng</small>
                      <strong>{booking.checkOutDate || "—"}</strong>
                    </div>
                  </div>
                  {booking.note && <p style={{ margin: "12px 0 0", color: "var(--hc-text-secondary)", fontSize: "12px" }}>Ghi chú: {booking.note}</p>}
                </section>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Modal Phân công Dọn phòng Chặt chẽ */}
      <Modal
        isOpen={assignModalOpen}
        onClose={closeAssignModal}
        title={`Phân công dọn phòng — Phòng ${cleaningTarget?.roomNumber || ""}`}
        subtitle={cleaningTarget ? `Tầng ${cleaningTarget.floor || 1} · Trạng thái: ${cleaningTarget.status || cleaningTarget.roomStatus || "Đang dọn"}` : undefined}
        icon="bi-brush"
        maxWidth="560px"
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
                <span style={{ color: "var(--hc-text-secondary)", fontSize: "0.75rem", display: "block" }}>Trạng thái hiện tại</span>
                <span>{cleaningTarget.status || cleaningTarget.roomStatus || "Đang dọn"}</span>
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
                    <strong>Không có nhân viên trong ca trực:</strong> Hiện tại không có nhân viên buồng phòng nào có lịch trực hoạt động theo ca. Vui lòng xếp ca trực tại mục{" "}
                    <strong>Quản lý Lịch làm việc</strong> trước khi phân công.
                  </div>
                </div>
              ) : (
                <SelectMenu value={selectedHousekeeperId} onChange={setSelectedHousekeeperId} options={housekeeperOptions} ariaLabel="Chọn nhân viên buồng phòng có ca trực" icon="bi-person-badge" />
              )}
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Mức độ ưu tiên</label>
              <SelectMenu value={assignPriority} onChange={setAssignPriority} options={PRIORITY_OPTIONS} ariaLabel="Mức độ ưu tiên" icon="bi-flag" />
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Ghi chú dọn phòng (tùy chọn)</label>
              <textarea
                className="hc-textarea"
                rows="2"
                placeholder="Ví dụ: Thay toàn bộ ga giường, bổ sung khăn tắm, khách check-in sớm..."
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button type="button" className="hc-btn hc-btn-outline" onClick={closeAssignModal} disabled={submittingAssign}>
                Đóng
              </button>
              <button type="button" className="hc-btn hc-btn-primary" onClick={handleConfirmAssignCleaning} disabled={submittingAssign || !selectedHousekeeperId || housekeepers.length === 0}>
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
