import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import interactionPlugin from "@fullcalendar/react/interaction";
import viLocale from "@fullcalendar/react/locales/vi";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatDate } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import "./AdminSchedulesPage.css";

const pad = (v) => String(v).padStart(2, "0");
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const roleCodeOf = (role) => {
  if (!role) return "";
  if (typeof role === "string") return role.replace("ROLE_", "");
  const code = role?.roleCode || role?.code || role?.roleName || "";
  return code.replace("ROLE_", "");
};

const roleLabelOf = (roleCode) => {
  const code = (roleCode || "").replace("ROLE_", "").toUpperCase();
  const map = {
    ADMIN: "Quản trị viên",
    MANAGER: "Quản lý",
    RECEPTIONIST: "Lễ tân",
    HOUSEKEEPING: "Buồng phòng",
    SERVICE_STAFF: "Phục vụ / Nhà hàng",
    MAINTENANCE: "Kỹ thuật / Bảo trì",
    CUSTOMER: "Khách hàng",
  };
  return map[code] || code || "Nhân viên";
};

const formatTime = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return `${pad(value[0])}:${pad(value[1] || 0)}`;
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
};

const getStaffName = (item) => item.fullName || item.accountFullName || item.username || item.accountUsername || "Nhân viên";

const getShiftName = (item) => item.shiftName || item.shift?.shiftName || (item.shiftId ? `Ca #${item.shiftId}` : "Ca làm việc");

const getTimeRange = (item) => {
  const start = formatTime(item.startTime || item.shift?.startTime);
  const end = formatTime(item.endTime || item.shift?.endTime);
  if (!start && !end) return "Chưa xác định giờ";
  const overnight = Boolean(item.overnight) || (start && end && end < start);
  return `${start || "--:--"} – ${end || "--:--"}${overnight ? " (+1 ngày)" : ""}`;
};

const statusMeta = (status) => {
  const s = (status || "SCHEDULED").toUpperCase();
  switch (s) {
    case "COMPLETED":
      return { label: "Đã hoàn thành", cls: "completed", color: "#10b981", bg: "#dcfce7" };
    case "ABSENT":
      return { label: "Vắng mặt", cls: "absent", color: "#ef4444", bg: "#fee2e2" };
    case "OFF":
      return { label: "Nghỉ phép", cls: "off", color: "#64748b", bg: "#f1f5f9" };
    case "SCHEDULED":
    default:
      return { label: "Đã lên lịch", cls: "scheduled", color: "#2563eb", bg: "#dbeafe" };
  }
};

const unwrap = (response) => {
  const data = response?.data ?? (Array.isArray(response) ? response : []);
  return Array.isArray(data) ? data : [];
};

const DAYS_OF_WEEK = [
  { key: "MONDAY", label: "T2", fullName: "Thứ Hai" },
  { key: "TUESDAY", label: "T3", fullName: "Thứ Ba" },
  { key: "WEDNESDAY", label: "T4", fullName: "Thứ Tư" },
  { key: "THURSDAY", label: "T5", fullName: "Thứ Năm" },
  { key: "FRIDAY", label: "T6", fullName: "Thứ Sáu" },
  { key: "SATURDAY", label: "T7", fullName: "Thứ Bảy" },
  { key: "SUNDAY", label: "CN", fullName: "Chủ Nhật" },
];

export default function AdminSchedulesPage() {
  const { addToast } = useToast();
  const calendarRef = useRef(null);

  const [activeTab, setActiveTab] = useState("SCHEDULES");
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Range tracked from FullCalendar
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  });

  // Schedule detail drawer/modal
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Single Assign Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState(() => ({
    accountId: "",
    shiftId: "",
    workDate: toISO(new Date()),
    notes: "",
  }));
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // Bulk Assign Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(() => ({
    accountIds: [],
    shiftId: "",
    startDate: toISO(new Date()),
    endDate: toISO(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)),
    daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    notes: "",
    overwrite: false,
  }));
  const [bulkStaffSearch, setBulkStaffSearch] = useState("");
  const [bulkStaffRole, setBulkStaffRole] = useState("ALL");
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // Shift Definition Modal State
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editShiftId, setEditShiftId] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    shiftName: "",
    startTime: "06:00",
    endTime: "14:00",
    description: "",
  });
  const [submittingShift, setSubmittingShift] = useState(false);

  // Load shifts and staff accounts on mount
  useEffect(() => {
    let active = true;
    const loadPrerequisites = async () => {
      try {
        const [shiftRes, accountRes] = await Promise.all([
          apiCall("/api/admin/shifts", { silentError: true }),
          apiCall("/api/admin/schedules/staff", { silentError: true }),
        ]);
        if (!active) return;
        const shiftsData = unwrap(shiftRes);
        const accountsData = unwrap(accountRes);
        setShifts(shiftsData);
        setAccounts(accountsData);

        if (shiftsData.length > 0) {
          setAssignForm((prev) => ({ ...prev, shiftId: String(shiftsData[0].shiftId) }));
          setBulkForm((prev) => ({ ...prev, shiftId: String(shiftsData[0].shiftId) }));
        }
        if (accountsData.length > 0) {
          setAssignForm((prev) => ({ ...prev, accountId: String(accountsData[0].accountId || accountsData[0].id) }));
        }
      } catch (err) {
        addToast(err?.message || "Không thể tải danh sách ca và nhân viên.", "error");
      }
    };
    loadPrerequisites();
    return () => {
      active = false;
    };
  }, [addToast]);

  // Load schedules whenever dateRange changes
  const loadSchedules = useCallback(
    async (fromStr, toStr) => {
      if (!fromStr || !toStr) return;
      setLoading(true);
      try {
        const res = await apiCall(`/api/admin/schedules?from=${fromStr}&to=${toStr}`, { silentError: true });
        setSchedules(unwrap(res));
      } catch (error) {
        addToast(error?.message || "Không thể tải lịch làm việc.", "error");
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    loadSchedules(dateRange.from, dateRange.to);
  }, [dateRange.from, dateRange.to, loadSchedules]);

  // FullCalendar datesSet callback
  const handleDatesSet = (dateInfo) => {
    const fromStr = toISO(dateInfo.start);
    const endInclusive = new Date(dateInfo.end.getTime() - 1);
    const toStr = toISO(endInclusive);
    if (fromStr !== dateRange.from || toStr !== dateRange.to) {
      setDateRange({ from: fromStr, to: toStr });
    }
  };

  // Calendar date click handler -> Quick single assign
  const handleDateClick = (arg) => {
    openAssignModal(arg.dateStr);
  };

  // Calendar event click handler -> Show detail
  const handleEventClick = (info) => {
    const sched = info.event.extendedProps;
    if (sched) {
      setSelectedSchedule(sched);
    }
  };

  // Filtered schedules for calendar rendering
  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const staffName = getStaffName(item).toLowerCase();
      const notes = (item.notes || "").toLowerCase();
      const staffMatch = !q || staffName.includes(q) || notes.includes(q);

      const shiftMatch = shiftFilter === "ALL" || String(item.shiftId) === String(shiftFilter);

      const rCode = roleCodeOf(item.role || item.roleCode);
      const roleMatch = roleFilter === "ALL" || rCode.toUpperCase() === roleFilter.toUpperCase();

      return staffMatch && shiftMatch && roleMatch;
    });
  }, [schedules, searchQuery, shiftFilter, roleFilter]);

  // Convert to FullCalendar events
  const calendarEvents = useMemo(() => {
    return filteredSchedules.map((item) => {
      const staff = getStaffName(item);
      const shift = getShiftName(item);
      const meta = statusMeta(item.status);

      let startIso = item.workDate;
      let endIso = undefined;

      if (item.startDateTime) {
        startIso = item.startDateTime;
      } else if (item.workDate && item.startTime) {
        startIso = `${item.workDate}T${formatTime(item.startTime)}:00`;
      }

      if (item.endDateTime) {
        endIso = item.endDateTime;
      } else if (item.workDate && item.endTime) {
        endIso = `${item.workDate}T${formatTime(item.endTime)}:00`;
      }

      return {
        id: String(item.scheduleId),
        title: `${staff} · ${shift}`,
        start: startIso,
        end: endIso,
        allDay: false,
        backgroundColor: meta.bg,
        borderColor: meta.color,
        textColor: "#1e293b",
        classNames: [`fc-shift-event`, `fc-status-${meta.cls}`],
        extendedProps: item,
      };
    });
  }, [filteredSchedules]);

  // Custom event renderer in FullCalendar
  const renderEventContent = (eventInfo) => {
    const item = eventInfo.event.extendedProps;
    const meta = statusMeta(item.status);
    const timeDisplay = getTimeRange(item);
    const staff = getStaffName(item);
    const shift = getShiftName(item);

    return (
      <div className={`fc-event-custom-pill ${meta.cls}`} title={`${staff} (${shift}) - ${timeDisplay}`}>
        <span className="fc-event-dot" style={{ backgroundColor: meta.color }} />
        <div className="fc-event-details">
          <strong className="fc-event-staff">{staff}</strong>
          <span className="fc-event-meta">
            {shift} · {timeDisplay}
          </span>
        </div>
      </div>
    );
  };

  // Staff options for select
  const staffOptions = useMemo(
    () =>
      accounts.map((acc) => ({
        value: String(acc.accountId || acc.id),
        label: `${acc.fullName || acc.username} (${roleLabelOf(acc.roleCode || acc.role)})`,
      })),
    [accounts],
  );

  // Shift options for select
  const shiftOptions = useMemo(
    () =>
      shifts.map((s) => ({
        value: String(s.shiftId),
        label: `${s.shiftName || `Ca #${s.shiftId}`} (${formatTime(s.startTime)} – ${formatTime(s.endTime)})`,
      })),
    [shifts],
  );

  const shiftFilterOptions = useMemo(
    () => [{ value: "ALL", label: "Tất cả các ca trực" }, ...shifts.map((s) => ({ value: String(s.shiftId), label: s.shiftName || `Ca #${s.shiftId}` }))],
    [shifts],
  );

  const roleFilterOptions = [
    { value: "ALL", label: "Tất cả bộ phận / vai trò" },
    { value: "RECEPTIONIST", label: "Lễ tân" },
    { value: "HOUSEKEEPING", label: "Buồng phòng" },
    { value: "SERVICE_STAFF", label: "Phục vụ / Nhà hàng" },
    { value: "MAINTENANCE", label: "Kỹ thuật / Bảo trì" },
    { value: "MANAGER", label: "Quản lý" },
  ];

  // ==========================================
  // SINGLE ASSIGNMENT HANDLERS
  // ==========================================
  const openAssignModal = (date = toISO(new Date())) => {
    setAssignForm({
      accountId: String(accounts[0]?.accountId || accounts[0]?.id || ""),
      shiftId: String(shifts[0]?.shiftId || ""),
      workDate: date,
      notes: "",
    });
    setScheduleModalOpen(true);
  };

  const handleAssignSchedule = async (e) => {
    e.preventDefault();
    if (!assignForm.accountId || !assignForm.shiftId || !assignForm.workDate) {
      addToast("Vui lòng chọn nhân viên, ca làm việc và ngày làm việc.", "warning");
      return;
    }
    setSubmittingSchedule(true);
    try {
      await apiCall("/api/admin/schedules", {
        method: "POST",
        body: {
          accountId: Number(assignForm.accountId),
          shiftId: Number(assignForm.shiftId),
          workDate: assignForm.workDate,
          notes: assignForm.notes.trim() || null,
        },
      });
      addToast("Đã phân công ca làm việc thành công.", "success");
      setScheduleModalOpen(false);
      await loadSchedules(dateRange.from, dateRange.to);
    } catch (error) {
      addToast(error?.message || "Không thể phân công ca trực này.", "error");
    } finally {
      setSubmittingSchedule(false);
    }
  };

  // ==========================================
  // BULK ASSIGNMENT MODAL & HANDLERS
  // ==========================================
  const openBulkModal = () => {
    setBulkForm({
      accountIds: accounts.map((a) => a.accountId || a.id).slice(0, 3), // default preselect first few
      shiftId: String(shifts[0]?.shiftId || ""),
      startDate: toISO(new Date()),
      endDate: toISO(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)),
      daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      notes: "",
      overwrite: false,
    });
    setBulkStaffSearch("");
    setBulkStaffRole("ALL");
    setBulkModalOpen(true);
  };

  const filteredStaffForBulk = useMemo(() => {
    return accounts.filter((acc) => {
      const q = bulkStaffSearch.trim().toLowerCase();
      const name = (acc.fullName || acc.username || "").toLowerCase();
      const code = roleCodeOf(acc.roleCode || acc.role).toLowerCase();
      const matchText = !q || name.includes(q) || code.includes(q);

      const rCode = roleCodeOf(acc.roleCode || acc.role).toUpperCase();
      const matchRole = bulkStaffRole === "ALL" || rCode === bulkStaffRole;

      return matchText && matchRole;
    });
  }, [accounts, bulkStaffSearch, bulkStaffRole]);

  const toggleBulkStaff = (accId) => {
    setBulkForm((prev) => {
      const current = prev.accountIds || [];
      if (current.includes(accId)) {
        return { ...prev, accountIds: current.filter((id) => id !== accId) };
      } else {
        return { ...prev, accountIds: [...current, accId] };
      }
    });
  };

  const handleSelectAllStaff = () => {
    const allFilteredIds = filteredStaffForBulk.map((a) => a.accountId || a.id);
    setBulkForm((prev) => ({
      ...prev,
      accountIds: Array.from(new Set([...prev.accountIds, ...allFilteredIds])),
    }));
  };

  const handleDeselectAllStaff = () => {
    const filteredIdsSet = new Set(filteredStaffForBulk.map((a) => a.accountId || a.id));
    setBulkForm((prev) => ({
      ...prev,
      accountIds: prev.accountIds.filter((id) => !filteredIdsSet.has(id)),
    }));
  };

  const toggleDayOfWeek = (dayKey) => {
    setBulkForm((prev) => {
      const current = prev.daysOfWeek || [];
      if (current.includes(dayKey)) {
        return { ...prev, daysOfWeek: current.filter((d) => d !== dayKey) };
      } else {
        return { ...prev, daysOfWeek: [...current, dayKey] };
      }
    });
  };

  const setWeekdayPreset = (preset) => {
    if (preset === "ALL") {
      setBulkForm((prev) => ({ ...prev, daysOfWeek: DAYS_OF_WEEK.map((d) => d.key) }));
    } else if (preset === "WEEKDAYS") {
      setBulkForm((prev) => ({ ...prev, daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] }));
    } else if (preset === "WEEKENDS") {
      setBulkForm((prev) => ({ ...prev, daysOfWeek: ["SATURDAY", "SUNDAY"] }));
    } else if (preset === "CLEAR") {
      setBulkForm((prev) => ({ ...prev, daysOfWeek: [] }));
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkForm.accountIds || bulkForm.accountIds.length === 0) {
      addToast("Vui lòng chọn ít nhất 1 nhân viên để phân công.", "warning");
      return;
    }
    if (!bulkForm.shiftId) {
      addToast("Vui lòng chọn ca làm việc.", "warning");
      return;
    }
    if (!bulkForm.startDate || !bulkForm.endDate) {
      addToast("Vui lòng chọn khoảng ngày bắt đầu và kết thúc.", "warning");
      return;
    }
    if (bulkForm.startDate > bulkForm.endDate) {
      addToast("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.", "warning");
      return;
    }

    setSubmittingBulk(true);
    try {
      const payload = {
        accountIds: bulkForm.accountIds.map(Number),
        shiftId: Number(bulkForm.shiftId),
        startDate: bulkForm.startDate,
        endDate: bulkForm.endDate,
        daysOfWeek: bulkForm.daysOfWeek.length > 0 ? bulkForm.daysOfWeek : null,
        notes: bulkForm.notes.trim() || null,
        overwrite: Boolean(bulkForm.overwrite),
      };

      const res = await apiCall("/api/admin/schedules/bulk", {
        method: "POST",
        body: payload,
      });

      const summary = res?.data;
      const created = summary?.createdCount ?? 0;
      const updated = summary?.updatedCount ?? 0;
      const skipped = summary?.skippedCount ?? 0;

      addToast(`Phân công theo lô thành công: Tạo mới ${created}, cập nhật ${updated}, bỏ qua ${skipped} ca.`, "success");
      setBulkModalOpen(false);
      await loadSchedules(dateRange.from, dateRange.to);
    } catch (error) {
      addToast(error?.message || "Lỗi khi phân công lịch theo lô.", "error");
    } finally {
      setSubmittingBulk(false);
    }
  };

  // ==========================================
  // SCHEDULE STATUS UPDATE & DELETE
  // ==========================================
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedSchedule) return;
    setUpdatingStatus(true);
    try {
      await apiCall(`/api/admin/schedules/${selectedSchedule.scheduleId}`, {
        method: "PUT",
        body: { status: newStatus },
      });
      addToast(`Đã cập nhật trạng thái: ${statusMeta(newStatus).label}`, "success");
      setSelectedSchedule((prev) => ({ ...prev, status: newStatus }));
      await loadSchedules(dateRange.from, dateRange.to);
    } catch (error) {
      addToast(error?.message || "Không thể cập nhật trạng thái.", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy phân công ca làm việc này?")) return;
    try {
      await apiCall(`/api/admin/schedules/${scheduleId}`, { method: "DELETE" });
      addToast("Đã hủy phân công ca làm việc.", "success");
      setSelectedSchedule(null);
      await loadSchedules(dateRange.from, dateRange.to);
    } catch (error) {
      addToast(error?.message || "Không thể hủy phân công ca trực này.", "error");
    }
  };

  // ==========================================
  // SHIFT MANAGEMENT HANDLERS
  // ==========================================
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.shiftName.trim()) {
      addToast("Vui lòng nhập tên ca làm việc.", "warning");
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
      await apiCall(editShiftId ? `/api/admin/shifts/${editShiftId}` : "/api/admin/shifts", {
        method: editShiftId ? "PUT" : "POST",
        body: payload,
      });
      addToast(editShiftId ? "Cập nhật ca thành công." : "Tạo ca làm việc mới thành công.", "success");
      setShiftModalOpen(false);
      const shiftRes = await apiCall("/api/admin/shifts", { silentError: true });
      setShifts(unwrap(shiftRes));
    } catch (error) {
      addToast(error?.message || "Không thể lưu ca làm việc.", "error");
    } finally {
      setSubmittingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm("Bạn có chắc muốn xóa ca làm việc này? Các lịch đã xếp với ca này có thể bị ảnh hưởng.")) return;
    try {
      await apiCall(`/api/admin/shifts/${shiftId}`, { method: "DELETE" });
      addToast("Đã xóa ca làm việc.", "success");
      const shiftRes = await apiCall("/api/admin/shifts", { silentError: true });
      setShifts(unwrap(shiftRes));
    } catch (error) {
      addToast(error?.message || "Không thể xóa ca làm việc này.", "error");
    }
  };

  return (
    <div className="ops-page admin-schedules-page">
      {/* Top Page Heading & Global Actions */}
      <div className="hc-page-title admin-schedule-heading">
        <div>
          <h2>Ca & Lịch làm việc</h2>
          <p>Lập lịch phân ca làm việc cho nhân viên và quản lý các ca trực khách sạn.</p>
        </div>
        <div className="admin-heading-buttons">
          {activeTab === "SCHEDULES" ? (
            <>
              <button className="hc-btn hc-btn-primary" type="button" onClick={openBulkModal}>
                <i className="bi bi-calendar-range" /> Phân công theo lô
              </button>
              <button className="hc-btn hc-btn-outline" type="button" onClick={() => openAssignModal()}>
                <i className="bi bi-person-plus" /> Gán ca lẻ
              </button>
            </>
          ) : (
            <button
              className="hc-btn hc-btn-primary"
              type="button"
              onClick={() => {
                setEditShiftId(null);
                setShiftForm({ shiftName: "", startTime: "06:00", endTime: "14:00", description: "" });
                setShiftModalOpen(true);
              }}
            >
              <i className="bi bi-plus-lg" /> Thêm ca trực
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="hc-tab-group admin-schedule-tabs">
        <button type="button" className={`hc-tab-btn ${activeTab === "SCHEDULES" ? "active" : ""}`} onClick={() => setActiveTab("SCHEDULES")}>
          <i className="bi bi-calendar-week" /> Lịch làm việc ({schedules.length} ca trong khoảng xem)
        </button>
        <button type="button" className={`hc-tab-btn ${activeTab === "SHIFTS" ? "active" : ""}`} onClick={() => setActiveTab("SHIFTS")}>
          <i className="bi bi-clock-history" /> Định nghĩa ca trực ({shifts.length})
        </button>
      </div>

      {activeTab === "SCHEDULES" ? (
        <>
          {/* Filters Bar */}
          <div className="admin-schedule-filters">
            <div className="admin-filter-search">
              <i className="bi bi-search" />
              <input
                className="hc-input"
                type="search"
                placeholder="Tìm nhân viên, ca trực hoặc ghi chú…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="admin-schedule-filter-select">
              <SelectMenu value={shiftFilter} onChange={setShiftFilter} options={shiftFilterOptions} ariaLabel="Lọc theo ca" icon="bi-clock" />
            </div>

            <div className="admin-schedule-filter-select">
              <SelectMenu value={roleFilter} onChange={setRoleFilter} options={roleFilterOptions} ariaLabel="Lọc theo vai trò" icon="bi-people" />
            </div>

            <button
              type="button"
              className="hc-btn hc-btn-outline"
              onClick={() => loadSchedules(dateRange.from, dateRange.to)}
              disabled={loading}
              title="Làm mới dữ liệu lịch"
            >
              <i className={`bi bi-arrow-clockwise${loading ? " admin-schedule-spin" : ""}`} /> Làm mới
            </button>
          </div>

          {/* FullCalendar Card */}
          <section className="hc-card admin-calendar-card">
            {/* Status Legend */}
            <div className="admin-calendar-legend">
              <span className="legend-item">
                <i className="admin-calendar-dot scheduled" /> Đã lên lịch
              </span>
              <span className="legend-item">
                <i className="admin-calendar-dot completed" /> Đã hoàn thành
              </span>
              <span className="legend-item">
                <i className="admin-calendar-dot absent" /> Vắng mặt
              </span>
              <span className="legend-item">
                <i className="admin-calendar-dot off" /> Nghỉ phép
              </span>
              <span className="legend-tip">
                <i className="bi bi-info-circle" /> Nhấp vào ngày bất kỳ để gán ca lẻ, nhấp vào ca trực để xem chi tiết.
              </span>
            </div>

            <div className="admin-calendar-wrapper">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, classicThemePlugin]}
                initialView="dayGridMonth"
                locales={[viLocale]}
                locale="vi"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
                }}
                buttonText={{
                  today: "Hôm nay",
                  month: "Tháng",
                  week: "Tuần",
                  day: "Ngày",
                  list: "Danh sách",
                }}
                dayMaxEvents={3}
                moreLinkClick="popover"
                nowIndicator={true}
                height="auto"
                aspectRatio={1.65}
                datesSet={handleDatesSet}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                eventContent={renderEventContent}
                events={calendarEvents}
              />
            </div>
          </section>

          {/* Schedule Detail Drawer / Modal */}
          {selectedSchedule && (
            <Modal
              isOpen={Boolean(selectedSchedule)}
              onClose={() => setSelectedSchedule(null)}
              title="Chi tiết ca làm việc"
              subtitle={`Ngày trực: ${formatDate(selectedSchedule.workDate)}`}
              icon="bi-calendar-check"
              maxWidth="520px"
              footer={
                <div className="admin-modal-actions" style={{ justifyContent: "space-between", width: "100%" }}>
                  <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => handleDeleteSchedule(selectedSchedule.scheduleId)}>
                    <i className="bi bi-trash" /> Hủy ca này
                  </button>
                  <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={() => setSelectedSchedule(null)}>
                    Đóng
                  </button>
                </div>
              }
            >
              <div className="admin-schedule-detail-grid">
                <div>
                  <small>Nhân viên</small>
                  <strong>{getStaffName(selectedSchedule)}</strong>
                  <span className="admin-subtext">@{selectedSchedule.accountUsername || selectedSchedule.username || "—"}</span>
                </div>
                <div>
                  <small>Bộ phận / Vai trò</small>
                  <strong>{roleLabelOf(selectedSchedule.role || selectedSchedule.roleCode)}</strong>
                </div>
                <div>
                  <small>Ca làm việc</small>
                  <strong>{getShiftName(selectedSchedule)}</strong>
                </div>
                <div>
                  <small>Khung giờ làm</small>
                  <strong>{getTimeRange(selectedSchedule)}</strong>
                </div>
                <div className="admin-schedule-status-box">
                  <small>Trạng thái hiện tại</small>
                  <div className="admin-status-picker">
                    <span className={`admin-calendar-status ${statusMeta(selectedSchedule.status).cls}`}>
                      {statusMeta(selectedSchedule.status).label}
                    </span>
                    <div className="admin-status-quick-btns">
                      {["SCHEDULED", "COMPLETED", "ABSENT", "OFF"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={`hc-btn hc-btn-sm ${selectedSchedule.status === st ? "hc-btn-primary" : "hc-btn-outline"}`}
                          disabled={updatingStatus || selectedSchedule.status === st}
                          onClick={() => handleUpdateStatus(st)}
                          title={`Chuyển sang ${statusMeta(st).label}`}
                        >
                          {statusMeta(st).label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="admin-schedule-notes">
                  <small>Ghi chú</small>
                  <span>{selectedSchedule.notes || "Không có ghi chú."}</span>
                </div>
              </div>
            </Modal>
          )}
        </>
      ) : (
        /* SHIFTS DEFINITION TAB */
        <section className="hc-card">
          <div className="hc-card-header">
            <div>
              <h3 className="hc-card-title">Danh sách ca làm việc</h3>
              <span>Cấu hình các khung giờ làm việc chuẩn để xếp lịch nhân sự.</span>
            </div>
          </div>
          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner" />
            </div>
          ) : shifts.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-clock" />
              <p>Chưa có ca làm việc nào được định nghĩa.</p>
              <button
                type="button"
                className="hc-btn hc-btn-primary hc-btn-sm"
                onClick={() => {
                  setEditShiftId(null);
                  setShiftForm({ shiftName: "", startTime: "06:00", endTime: "14:00", description: "" });
                  setShiftModalOpen(true);
                }}
              >
                Tạo ca đầu tiên
              </button>
            </div>
          ) : (
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Ca làm việc</th>
                    <th>Giờ bắt đầu</th>
                    <th>Giờ kết thúc</th>
                    <th>Mô tả</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.shiftId}>
                      <td>
                        <strong>{shift.shiftName || `Ca #${shift.shiftId}`}</strong>
                      </td>
                      <td>
                        <span className="badge-time start">
                          <i className="bi bi-box-arrow-in-right" /> {formatTime(shift.startTime)}
                        </span>
                      </td>
                      <td>
                        <span className="badge-time end">
                          <i className="bi bi-box-arrow-right" /> {formatTime(shift.endTime)}
                        </span>
                      </td>
                      <td>{shift.description || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="admin-shift-actions">
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            onClick={() => {
                              setEditShiftId(shift.shiftId);
                              setShiftForm({
                                shiftName: shift.shiftName || "",
                                startTime: formatTime(shift.startTime) || "06:00",
                                endTime: formatTime(shift.endTime) || "14:00",
                                description: shift.description || "",
                              });
                              setShiftModalOpen(true);
                            }}
                          >
                            <i className="bi bi-pencil" /> Sửa
                          </button>
                          <button
                            type="button"
                            className="hc-btn hc-btn-ghost hc-btn-sm text-danger"
                            onClick={() => handleDeleteShift(shift.shiftId)}
                            title="Xóa ca này"
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: PHÂN CÔNG THEO LÔ (BULK ASSIGNMENT MODAL)           */}
      {/* ============================================================ */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Phân công lịch làm việc theo lô"
        subtitle="Xếp ca cho nhiều nhân viên trong một khoảng ngày và các thứ trong tuần."
        icon="bi-calendar-range"
        maxWidth="680px"
        footer={
          <div className="admin-modal-actions">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setBulkModalOpen(false)}>
              Hủy bỏ
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              disabled={submittingBulk || bulkForm.accountIds.length === 0}
              onClick={handleBulkSubmit}
            >
              {submittingBulk ? (
                <>
                  <i className="bi bi-arrow-clockwise admin-schedule-spin" /> Đang phân công…
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle" /> Xác nhận phân ca ({bulkForm.accountIds.length} NV)
                </>
              )}
            </button>
          </div>
        }
      >
        <form onSubmit={handleBulkSubmit} className="bulk-schedule-form">
          {/* 1. Chọn Ca làm việc */}
          <div className="hc-form-group">
            <label className="hc-label">
              Ca làm việc áp dụng <span className="text-danger">*</span>
            </label>
            <SelectMenu
              value={bulkForm.shiftId}
              onChange={(value) => setBulkForm((prev) => ({ ...prev, shiftId: value }))}
              options={shiftOptions}
              ariaLabel="Chọn ca làm việc"
              icon="bi-clock"
            />
          </div>

          {/* 2. Chọn Nhân viên (Multi-Select Checklist) */}
          <div className="hc-form-group">
            <div className="bulk-staff-header">
              <label className="hc-label mb-0">
                Chọn nhân viên <span className="text-danger">*</span>
                <span className="bulk-selected-badge">{bulkForm.accountIds.length} đã chọn</span>
              </label>
              <div className="bulk-staff-actions">
                <button type="button" className="hc-btn hc-btn-ghost hc-btn-xs" onClick={handleSelectAllStaff}>
                  Chọn tất cả
                </button>
                <button type="button" className="hc-btn hc-btn-ghost hc-btn-xs" onClick={handleDeselectAllStaff}>
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            {/* Bộ lọc nhân viên nhanh */}
            <div className="bulk-staff-search-row">
              <input
                className="hc-input hc-input-sm"
                type="search"
                placeholder="Tìm nhanh theo tên nhân viên…"
                value={bulkStaffSearch}
                onChange={(e) => setBulkStaffSearch(e.target.value)}
              />
              <select
                className="hc-input hc-input-sm bulk-staff-role-filter"
                value={bulkStaffRole}
                onChange={(e) => setBulkStaffRole(e.target.value)}
              >
                <option value="ALL">Tất cả bộ phận</option>
                <option value="RECEPTIONIST">Lễ tân</option>
                <option value="HOUSEKEEPING">Buồng phòng</option>
                <option value="SERVICE_STAFF">Phục vụ</option>
                <option value="MAINTENANCE">Kỹ thuật</option>
              </select>
            </div>

            {/* Danh sách checkbox nhân viên */}
            <div className="bulk-staff-list">
              {filteredStaffForBulk.length === 0 ? (
                <div className="bulk-staff-empty">Không tìm thấy nhân viên phù hợp</div>
              ) : (
                filteredStaffForBulk.map((acc) => {
                  const accId = acc.accountId || acc.id;
                  const isChecked = bulkForm.accountIds.includes(accId);
                  const roleName = roleLabelOf(acc.roleCode || acc.role);

                  return (
                    <label key={accId} className={`bulk-staff-item ${isChecked ? "checked" : ""}`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleBulkStaff(accId)} />
                      <div className="bulk-staff-info">
                        <span className="bulk-staff-name">{acc.fullName || acc.username}</span>
                        <span className="bulk-staff-role">{roleName}</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Chọn Khoảng ngày (Date Range) */}
          <div className="admin-shift-time-fields">
            <div className="hc-form-group">
              <label className="hc-label">
                Từ ngày <span className="text-danger">*</span>
              </label>
              <input
                className="hc-input"
                type="date"
                value={bulkForm.startDate}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">
                Đến ngày <span className="text-danger">*</span>
              </label>
              <input
                className="hc-input"
                type="date"
                value={bulkForm.endDate}
                min={bulkForm.startDate}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* 4. Chọn các thứ trong tuần (Days of Week) */}
          <div className="hc-form-group">
            <div className="bulk-weekdays-header">
              <label className="hc-label mb-0">Các ngày trong tuần muốn xếp lịch</label>
              <div className="bulk-weekday-presets">
                <button type="button" className="hc-btn hc-btn-ghost hc-btn-xs" onClick={() => setWeekdayPreset("ALL")}>
                  Cả tuần
                </button>
                <button type="button" className="hc-btn hc-btn-ghost hc-btn-xs" onClick={() => setWeekdayPreset("WEEKDAYS")}>
                  T2 – T6
                </button>
                <button type="button" className="hc-btn hc-btn-ghost hc-btn-xs" onClick={() => setWeekdayPreset("WEEKENDS")}>
                  T7, CN
                </button>
                <button type="button" className="hc-btn hc-btn-ghost hc-btn-xs" onClick={() => setWeekdayPreset("CLEAR")}>
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="bulk-weekdays-grid">
              {DAYS_OF_WEEK.map((day) => {
                const isActive = bulkForm.daysOfWeek.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    className={`bulk-weekday-pill ${isActive ? "active" : ""}`}
                    onClick={() => toggleDayOfWeek(day.key)}
                    title={day.fullName}
                  >
                    <span>{day.label}</span>
                    <small>{day.fullName.replace("Thứ ", "T.")}</small>
                  </button>
                );
              })}
            </div>
            <small className="form-text-hint">
              * Nếu không chọn thứ nào, hệ thống sẽ xếp ca cho <strong>tất cả các ngày</strong> trong dải ngày trên.
            </small>
          </div>

          {/* 5. Tùy chọn Ghi đè & Ghi chú */}
          <div className="bulk-options-row">
            <label className="bulk-checkbox-label">
              <input
                type="checkbox"
                checked={bulkForm.overwrite}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, overwrite: e.target.checked }))}
              />
              <span>
                <strong>Ghi đè ca nếu nhân viên đã có lịch trong ngày</strong>
                <small>Nếu tắt, các ngày nhân viên đã có lịch sẽ được tự động bỏ qua.</small>
              </span>
            </label>
          </div>

          <div className="hc-form-group mb-0">
            <label className="hc-label">Ghi chú phân công (tùy chọn)</label>
            <input
              className="hc-input"
              value={bulkForm.notes}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="VD: Phân ca tăng cường tuần lễ du lịch..."
            />
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: GÁN CA LẺ (SINGLE ASSIGN MODAL)                     */}
      {/* ============================================================ */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Gán ca làm việc lẻ"
        subtitle="Chọn nhân viên, ca làm việc và ngày cụ thể."
        icon="bi-person-check"
        maxWidth="540px"
        footer={
          <div className="admin-modal-actions">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setScheduleModalOpen(false)}>
              Hủy bỏ
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={submittingSchedule} onClick={handleAssignSchedule}>
              {submittingSchedule ? "Đang lưu…" : "Lưu phân công"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAssignSchedule}>
          <div className="hc-form-group">
            <label className="hc-label">
              Nhân viên <span className="text-danger">*</span>
            </label>
            <SelectMenu
              value={assignForm.accountId}
              onChange={(value) => setAssignForm((current) => ({ ...current, accountId: value }))}
              options={staffOptions}
              ariaLabel="Chọn nhân viên"
              icon="bi-person"
            />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">
              Ca làm việc <span className="text-danger">*</span>
            </label>
            <SelectMenu
              value={assignForm.shiftId}
              onChange={(value) => setAssignForm((current) => ({ ...current, shiftId: value }))}
              options={shiftOptions}
              ariaLabel="Chọn ca"
              icon="bi-clock"
            />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">
              Ngày làm việc <span className="text-danger">*</span>
            </label>
            <input
              className="hc-input"
              type="date"
              value={assignForm.workDate}
              onChange={(e) => setAssignForm((current) => ({ ...current, workDate: e.target.value }))}
              required
            />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Ghi chú</label>
            <input
              className="hc-input"
              value={assignForm.notes}
              onChange={(e) => setAssignForm((current) => ({ ...current, notes: e.target.value }))}
              placeholder="Ghi chú phân công tùy chọn"
            />
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: TẠO / SỬA CA LÀM VIỆC (SHIFT DEFINITION MODAL)      */}
      {/* ============================================================ */}
      <Modal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title={editShiftId ? "Chỉnh sửa ca làm việc" : "Tạo ca làm việc mới"}
        subtitle="Xác định khung giờ và mô tả cho ca làm việc."
        icon="bi-clock-history"
        maxWidth="540px"
        footer={
          <div className="admin-modal-actions">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setShiftModalOpen(false)}>
              Hủy bỏ
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={submittingShift} onClick={handleSaveShift}>
              {submittingShift ? "Đang lưu…" : "Lưu ca trực"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveShift}>
          <div className="hc-form-group">
            <label className="hc-label">
              Tên ca làm việc <span className="text-danger">*</span>
            </label>
            <input
              className="hc-input"
              placeholder="VD: Ca sáng, Ca chiều, Ca đêm..."
              value={shiftForm.shiftName}
              onChange={(e) => setShiftForm((current) => ({ ...current, shiftName: e.target.value }))}
              required
            />
          </div>
          <div className="admin-shift-time-fields">
            <div className="hc-form-group">
              <label className="hc-label">Giờ bắt đầu</label>
              <input
                className="hc-input"
                type="time"
                value={shiftForm.startTime}
                onChange={(e) => setShiftForm((current) => ({ ...current, startTime: e.target.value }))}
                required
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Giờ kết thúc</label>
              <input
                className="hc-input"
                type="time"
                value={shiftForm.endTime}
                onChange={(e) => setShiftForm((current) => ({ ...current, endTime: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Mô tả nhiệm vụ ca</label>
            <textarea
              className="hc-textarea"
              rows="3"
              placeholder="Chi tiết công việc cần bàn giao trong ca..."
              value={shiftForm.description}
              onChange={(e) => setShiftForm((current) => ({ ...current, description: e.target.value }))}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
