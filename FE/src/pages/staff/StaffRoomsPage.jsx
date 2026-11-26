import React, { useState, useEffect, useCallback } from "react";
import Modal from "../../components/common/Modal";
import SelectMenu from "../../components/common/SelectMenu";
import { apiCall, formatDateTime, formatVND, getRoomTypeName, getRoomBasePrice, getRoomTypeId } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import SearchInput from "../../components/common/SearchInput";
import Paginated from "../../components/common/TablePagination";

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

const STATUS_FORM_OPTIONS = [
  { value: "AVAILABLE", label: "Trống" },
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
  AWAITING_INSPECTION: { label: "Chờ kiểm tra", badge: "hc-badge-primary" },
  COMPLETED: { label: "Đã hoàn tất", badge: "hc-badge-success" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-muted" },
};

const CLEANING_STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái dọn" },
  { value: "PENDING", label: "Chờ dọn" },
  { value: "IN_PROGRESS", label: "Đang dọn" },
  { value: "AWAITING_INSPECTION", label: "Chờ kiểm tra" },
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
  const { hasRole } = useAuth();
  const canEditRoom = hasRole(["ADMIN", "MANAGER"]);
  // Housekeeping only sees (and completes) the cleaning tasks assigned to them — no room map, no assigning, no deleting
  const isFieldStaff = !hasRole(["RECEPTIONIST", "MANAGER", "ADMIN"]);

  const [activeTab, setActiveTab] = useState(hasRole(["RECEPTIONIST", "MANAGER", "ADMIN"]) ? "ROOMS" : "CLEANING");
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [cleaningRequests, setCleaningRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false);
  const [roomBookings, setRoomBookings] = useState([]);
  const [loadingRoomBookings, setLoadingRoomBookings] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);

  // Edit room (admin / manager, vacant rooms only)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRoomId, setEditRoomId] = useState(null);
  const [editForm, setEditForm] = useState({ roomNumber: "", roomTypeId: "", floor: 1, status: "AVAILABLE", note: "" });
  const [savingRoom, setSavingRoom] = useState(false);

  const openEditModal = (room) => {
    setEditRoomId(room.roomId);
    setEditForm({
      roomNumber: room.roomNumber,
      roomTypeId: String(getRoomTypeId(room) || roomTypes[0]?.roomTypeId || ""),
      floor: room.floor || 1,
      status: room.status || "AVAILABLE",
      note: room.note || "",
    });
    setEditModalOpen(true);
  };

  const handleSaveRoom = async (e) => {
    e?.preventDefault?.();
    if (!editForm.roomNumber.trim() || !editForm.roomTypeId) {
      addToast("Vui lòng điền số phòng và chọn hạng phòng!", "warning");
      return;
    }
    setSavingRoom(true);
    try {
      const res = await apiCall(`/api/admin/rooms/${editRoomId}`, {
        method: "PUT",
        body: {
          roomNumber: editForm.roomNumber.trim(),
          roomTypeId: parseInt(editForm.roomTypeId, 10),
          floor: parseInt(editForm.floor, 10) || 1,
          status: editForm.status,
          note: editForm.note || null,
        },
      });
      if (res && res.success) {
        addToast(`Cập nhật phòng ${editForm.roomNumber} thành công!`, "success");
        setEditModalOpen(false);
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi lưu thông tin phòng", "error");
    } finally {
      setSavingRoom(false);
    }
  };

  const openRoomDetails = async (room) => {
    setSelectedRoom(room);
    setRoomBookings([]);
    setRoomDetailsOpen(true);
    setLoadingRoomBookings(true);
    try {
      const res = await apiCall(`/api/admin/rooms/${room.roomId}/bookings`, { silentError: true });
      if (res?.success) {
        const all = Array.isArray(res.data) ? res.data : [];
        setRoomBookings(all.filter((b) => b.status === "CHECKED_IN"));
      } else {
        addToast(res?.message || "Không tải được thông tin khách đang lưu trú.", "error");
      }
    } catch (err) {
      addToast(err.message || "Không tải được thông tin khách đang lưu trú.", "error");
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
        isFieldStaff ? Promise.resolve(null) : apiCall("/api/admin/rooms", { silentError: true }),
        isFieldStaff ? Promise.resolve(null) : apiCall("/api/public/rooms/room-types", { silentError: true }),
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
  }, [addToast, isFieldStaff]);

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
        addToast(
          isFieldStaff
            ? `Đã báo dọn xong phòng ${item.roomNumber}. Chờ lễ tân/quản lý kiểm tra.`
            : `Đã hoàn tất dọn dẹp phòng ${item.roomNumber}! Phòng chuyển sang trạng thái TRỐNG (AVAILABLE).`,
          "success",
        );
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi hoàn tất dọn phòng.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Supervisor inspection: approve (room -> AVAILABLE) or send back to housekeeping
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApproveCleaning = async (item) => {
    setUpdatingId(item.cleaningId);
    try {
      const res = await apiCall(`/api/staff/room-cleaning/${item.cleaningId}/approve`, { method: "POST" });
      if (res && res.success) {
        addToast(`Đã duyệt phòng ${item.roomNumber}. Phòng chuyển sang trạng thái TRỐNG (AVAILABLE).`, "success");
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi duyệt phòng.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectCleaning = async () => {
    if (!rejectTarget) return;
    setUpdatingId(rejectTarget.cleaningId);
    try {
      const res = await apiCall(`/api/staff/room-cleaning/${rejectTarget.cleaningId}/reject`, {
        method: "POST",
        body: { reason: rejectReason.trim() },
      });
      if (res && res.success) {
        addToast(`Đã trả phòng ${rejectTarget.roomNumber} cho nhân viên dọn lại.`, "success");
        setRejectTarget(null);
        setRejectReason("");
        await loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi trả lại yêu cầu.", "error");
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

  const typeFormOptions = roomTypes.map((t) => ({
    value: String(t.roomTypeId),
    label: `${t.typeName} - ${formatVND(t.basePrice)}/đêm (${t.capacity} khách)`,
  }));

  const housekeeperOptions = [
    {
      value: "",
      label: loadingHousekeepers ? "Đang tải nhân viên trong ca trực…" : housekeepers.length ? "Chọn nhân viên buồng phòng có ca trực" : "Không có nhân viên buồng phòng trong ca trực",
    },
    ...housekeepers.map((h) => ({ value: h.id, label: h.name })),
  ];


  return (
    <div className="ops-page">
      <div className="hc-page-title u-bar">
        <div>
          <h2>{isFieldStaff ? "Công Việc Dọn Phòng Của Tôi" : "Sơ Đồ & Buồng Phòng"}</h2>
          <p>{isFieldStaff ? "Danh sách phòng được phân công cho bạn. Bấm Hoàn tất khi đã dọn xong." : "Theo dõi tình trạng vệ sinh phòng, phân công ca trực dọn phòng chặt chẽ và nghiệm thu buồng phòng."}</p>
        </div>

        <button type="button" className="hc-btn hc-btn-outline" onClick={loadData} disabled={loading}>
          <i className="bi bi-arrow-clockwise"></i> Làm mới
        </button>
      </div>

      {/* Tabs */}
      <div className="hc-tab-group" style={{ marginBottom: "20px" }}>
        {!isFieldStaff && (
          <button type="button" className={`hc-tab-btn ${activeTab === "ROOMS" ? "active" : ""}`} onClick={() => setActiveTab("ROOMS")}>
            <i className="bi bi-door-open u-mr-6"></i>
            Sơ đồ phòng
          </button>
        )}
        <button type="button" className={`hc-tab-btn ${activeTab === "CLEANING" ? "active" : ""}`} onClick={() => setActiveTab("CLEANING")}>
          <i className="bi bi-brush u-mr-6"></i>
          Yêu cầu dọn phòng
        </button>
      </div>

      {!isFieldStaff && activeTab === "ROOMS" && (
        <div className="hc-card">
          <div className="hc-card-body u-row-ruled m-fields">
            <SearchInput
              type="search"
              wrapClassName="u-flex-240"
              placeholder="Tìm theo số phòng..."
              aria-label="Tìm phòng"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="u-flex-200">
              <SelectMenu value={typeFilter} onChange={setTypeFilter} options={typeFilterOptions} ariaLabel="Lọc hạng phòng" icon="bi-layers" />
            </div>
            <div className="u-flex-220">
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
            <Paginated items={filteredRooms}>
              {(pageRows, pager) => (
                <>
                  <div className="hc-card-body flush u-scroll-x">
                    <table className="hc-table">
                      <thead>
                        <tr>
                          <th>Số phòng</th>
                          <th>Hạng phòng</th>
                          <th>Tầng</th>
                          <th>Đơn giá</th>
                          <th>Trạng thái</th>
                          <th className="col-actions">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((r) => {
                          const meta = STATUS_META[r.status] || STATUS_META.MAINTENANCE;
                          const isUpdating = updatingId === r.roomId;
                          return (
                            <tr
                              key={r.roomId}
                              className="row-clickable"
                              tabIndex={0}
                              title="Xem khách đang lưu trú"
                              onClick={() => openRoomDetails(r)}
                              onKeyDown={(e) => {
                                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                  e.preventDefault();
                                  openRoomDetails(r);
                                }
                              }}
                            >
                              <td>
                                <span className="row-title">Phòng {r.roomNumber}</span>
                              </td>
                              <td>{getRoomTypeName(r)}</td>
                              <td>Tầng {r.floor || 1}</td>
                              <td>{formatVND(getRoomBasePrice(r))} / đêm</td>
                              <td>
                                <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                              </td>
                              <td className="col-actions">
                                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                                  {canEditRoom && r.status === "AVAILABLE" && (
                                    <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" title="Sửa thông tin phòng trống" disabled={isUpdating} onClick={() => openEditModal(r)}>
                                      <i className="bi bi-pencil-square"></i> Sửa
                                    </button>
                                  )}
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
                  {pager}
                </>
              )}
            </Paginated>
          )}
        </div>
      )}

      {activeTab === "CLEANING" && (
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-brush text-primary u-mr-8"></i>
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
            <Paginated items={filteredCleaning}>
              {(pageRows, pager) => (
                <>
                  <div className="hc-card-body flush u-scroll-x">
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
                          <th className="col-actions">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((c) => {
                          const stMeta = CLEANING_STATUS_META[c.status] || { label: c.status, badge: "hc-badge-muted" };
                          const priMeta = CLEANING_PRIORITY_META[c.priority] || CLEANING_PRIORITY_META.MEDIUM;
                          const isBusy = updatingId === c.cleaningId;
                          return (
                            <tr key={c.cleaningId}>
                              <td>
                                <strong>Phòng {c.roomNumber}</strong>
                                {c.bookingCode && <div className="u-hint-sm">#{c.bookingCode}</div>}
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
                                {c.completedAt && <div className="u-text-success">Xong: {formatDateTime(c.completedAt)}</div>}
                              </td>
                              <td style={{ maxWidth: "200px", fontSize: "12px", color: "var(--hc-text-secondary)" }}>{c.note || "—"}</td>
                              <td className="col-actions">
                                <div className="row-actions">
                                  {c.status === "AWAITING_INSPECTION" && (
                                    <>
                                      {isFieldStaff ? (
                                        <span className="u-hint-muted">Đang chờ kiểm tra</span>
                                      ) : (
                                        <>
                                          <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={isBusy} onClick={() => handleApproveCleaning(c)} title="Phòng đạt chuẩn — chuyển sang Trống">
                                            <i className="bi bi-patch-check"></i> Duyệt
                                          </button>
                                          <button type="button" className="hc-btn hc-btn-outline-danger hc-btn-sm" disabled={isBusy} onClick={() => { setRejectTarget(c); setRejectReason(""); }} title="Chưa đạt — trả lại để dọn lại">
                                            <i className="bi bi-arrow-counterclockwise"></i> Trả lại
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )}
                                  {(c.status === "PENDING" || c.status === "IN_PROGRESS") && (
                                    <>
                                      {!isFieldStaff && (
                                        <button
                                          type="button"
                                          className="hc-btn hc-btn-outline hc-btn-sm"
                                          disabled={isBusy}
                                          onClick={() => openAssignCleaningModal(c)}
                                          title="Phân công lại nhân viên buồng phòng"
                                        >
                                          <i className="bi bi-person-gear"></i> Phân công
                                        </button>
                                      )}
                                      {c.status === "IN_PROGRESS" && (
                                        <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={isBusy} onClick={() => handleCompleteCleaning(c)} title={isFieldStaff ? "Báo đã dọn xong, chờ kiểm tra" : "Xác nhận đã dọn xong phòng này"}>
                                          <i className="bi bi-check2-circle"></i> Hoàn tất
                                        </button>
                                      )}
                                      {!isFieldStaff && (
                                        <button
                                          type="button"
                                          className="hc-btn hc-btn-outline-danger hc-btn-sm"
                                          disabled={isBusy}
                                          onClick={() => handleDeleteCleaning(c.cleaningId)}
                                          title="Hủy yêu cầu dọn phòng"
                                        >
                                          <i className="bi bi-trash"></i>
                                        </button>
                                      )}
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
                  {pager}
                </>
              )}
            </Paginated>
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
        title={`Khách đang lưu trú — Phòng ${selectedRoom?.roomNumber || ""}`}
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
            <p>Hiện không có khách đang lưu trú tại phòng này.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "65vh", overflowY: "auto" }}>
            {roomBookings.map((booking) => {
              const bookingStatus = BOOKING_STATUS_META[booking.status] || { label: booking.status || "Không rõ", badge: "hc-badge-muted" };
              return (
                <section key={booking.bookingId} style={{ border: "1px solid var(--hc-border-light)", borderRadius: "var(--hc-radius-md)", padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
                    <div>
                      <strong>{booking.customerName || "Khách chưa cập nhật tên"}</strong>
                      <div className="u-hint">{booking.bookingCode}</div>
                    </div>
                    <span className={`hc-badge ${bookingStatus.badge}`}>{bookingStatus.label}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", fontSize: "13px" }}>
                    <div>
                      <small className="u-text-secondary u-block">Số điện thoại</small>
                      <strong>{booking.customerPhone || "—"}</strong>
                    </div>
                    <div>
                      <small className="u-text-secondary u-block">Email</small>
                      <strong>{booking.customerEmail || "—"}</strong>
                    </div>
                    <div>
                      <small className="u-text-secondary u-block">CCCD / CMND</small>
                      <strong>{booking.idNumber || "—"}</strong>
                    </div>
                    <div>
                      <small className="u-text-secondary u-block">Số khách</small>
                      <strong>{booking.guestCount ?? "—"}</strong>
                    </div>
                    <div>
                      <small className="u-text-secondary u-block">Ngày nhận phòng</small>
                      <strong>{booking.checkInDate || "—"}</strong>
                    </div>
                    <div>
                      <small className="u-text-secondary u-block">Ngày trả phòng</small>
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

      {/* Edit room modal (admin / manager, vacant rooms) */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Chỉnh Sửa Phòng"
        subtitle={`Cập nhật thông tin phòng ${editForm.roomNumber}`}
        icon="bi-pencil-square"
        maxWidth="540px"
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setEditModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSaveRoom} disabled={savingRoom}>
              {savingRoom ? "Đang lưu..." : "Lưu thông tin"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveRoom}>
          <div className="hc-form-group">
            <label className="hc-label">
              Số phòng <span className="u-text-error">*</span>
            </label>
            <input type="text" className="hc-input" value={editForm.roomNumber} onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })} required />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">
              Hạng phòng <span className="u-text-error">*</span>
            </label>
            <SelectMenu value={editForm.roomTypeId} onChange={(value) => setEditForm({ ...editForm, roomTypeId: value })} options={typeFormOptions} ariaLabel="Hạng phòng" icon="bi-layers" />
          </div>
          <div className="u-grid-auto">
            <div className="hc-form-group">
              <label className="hc-label">Tầng</label>
              <input type="number" className="hc-input" min="1" max="50" value={editForm.floor} onChange={(e) => setEditForm({ ...editForm, floor: e.target.value })} />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Trạng thái phòng</label>
              <SelectMenu value={editForm.status} onChange={(value) => setEditForm({ ...editForm, status: value })} options={STATUS_FORM_OPTIONS} ariaLabel="Trạng thái phòng" icon="bi-toggles" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Reject inspection modal */}
      <Modal
        isOpen={!!rejectTarget}
        onClose={() => updatingId === null && setRejectTarget(null)}
        title="Trả lại yêu cầu dọn phòng"
        subtitle={rejectTarget ? `Phòng ${rejectTarget.roomNumber} · nhân viên sẽ phải dọn lại` : undefined}
        icon="bi-arrow-counterclockwise"
        maxWidth="460px"
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setRejectTarget(null)} disabled={updatingId !== null}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleRejectCleaning} disabled={updatingId !== null}>
              {updatingId !== null ? "Đang xử lý..." : "Trả lại"}
            </button>
          </div>
        }
      >
        <div className="hc-form-group">
          <label className="hc-label">Lý do (tùy chọn)</label>
          <textarea className="hc-input" rows={3} placeholder="VD: Chưa thay ga giường, nhà tắm còn ướt..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </div>
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
          <div className="u-col-16">
            <div
              style={{
                background: "var(--hc-bg-subtle, #f8fafc)",
                border: "1px solid var(--hc-border-light, #e2e8f0)",
                borderRadius: "var(--hc-radius-sm)",
                padding: "12px 16px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <span className="u-hint u-block">Số phòng</span>
                <strong>Phòng {cleaningTarget.roomNumber}</strong>
              </div>
              <div>
                <span className="u-hint u-block">Vị trí</span>
                <span>Tầng {cleaningTarget.floor || 1}</span>
              </div>
              <div>
                <span className="u-hint u-block">Trạng thái hiện tại</span>
                <span>{cleaningTarget.status || cleaningTarget.roomStatus || "Đang dọn"}</span>
              </div>
            </div>

            <div className="hc-form-group">
              <label className="hc-label u-fw-600">
                Nhân viên buồng phòng (Đang trong ca trực) <span className="u-text-error">*</span>
              </label>

              {loadingHousekeepers ? (
                <div style={{ padding: "10px 0", color: "var(--hc-text-secondary)", fontSize: "0.875rem" }}>
                  <i className="bi bi-arrow-clockwise admin-schedule-spin u-mr-6"></i>
                  Đang kiểm tra lịch ca trực của nhân viên buồng phòng...
                </div>
              ) : housekeepers.length === 0 ? (
                <div
                  className="u-notice-warn"
                >
                  <i className="bi bi-exclamation-triangle-fill u-star"></i>
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

            <div className="u-modal-actions">
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
