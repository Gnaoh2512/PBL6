import React, { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import viLocale from "@fullcalendar/react/locales/vi";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import DatePicker from "../../components/DatePicker";
import TimePicker from "../../components/TimePicker";
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

const STATUS_OPTIONS = ["SCHEDULED", "COMPLETED", "ABSENT", "OFF"].map((st) => ({ value: st, label: statusMeta(st).label }));

const BULK_ROLE_OPTIONS = [
  { value: "ALL", label: "Tất cả bộ phận" },
  { value: "RECEPTIONIST", label: "Lễ tân" },
  { value: "HOUSEKEEPING", label: "Buồng phòng" },
  { value: "SERVICE_STAFF", label: "Phục vụ" },
  { value: "MAINTENANCE", label: "Kỹ thuật" },
];

const unwrap = (response) => {
  const data = response?.data ?? (Array.isArray(response) ? response : []);
  return Array.isArray(data) ? data : [];
};

// ----- Day slots: M (morning) / A (afternoon) / N (night) -----
const SLOTS = [
  { key: "M", order: 1, label: "Ca sáng" },
  { key: "A", order: 2, label: "Ca chiều" },
  { key: "N", order: 3, label: "Ca đêm" },
];
const SLOT_BY_KEY = Object.fromEntries(SLOTS.map((s) => [s.key, s]));

// Decide M / A / N from the shift name first, then from the start hour.
const slotKeyOf = (shiftName, startTime) => {
  const name = (shiftName || "").toLowerCase();
  if (/đêm|tối|night/.test(name)) return "N";
  if (/chiều|afternoon/.test(name)) return "A";
  if (/sáng|morning/.test(name)) return "M";
  const hour = parseInt(formatTime(startTime).slice(0, 2), 10);
  if (Number.isNaN(hour)) return "M";
  if (hour >= 5 && hour < 12) return "M";
  if (hour >= 12 && hour < 18) return "A";
  return "N";
};

const dateOfSchedule = (item) => {
  const v = item.workDate;
  if (!v) return "";
  if (Array.isArray(v)) return `${v[0]}-${pad(v[1])}-${pad(v[2])}`;
  return String(v).slice(0, 10);
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const weekStartOf = (date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7)); // Monday
const fmtShort = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const toMinutes = (value) => {
  const f = formatTime(value);
  if (!f) return null;
  const [h, m] = f.split(":").map(Number);
  return h * 60 + (m || 0);
};

const STATUS_ICON = { completed: "bi-check-circle-fill", absent: "bi-x-circle-fill", off: "bi-pause-circle-fill" };

const compactHM = (min) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return m ? `${h}:${pad(m)}` : `${h}`;
};

/**
 * Staff x time timeline used by the "Tuần" and "Ngày" views.
 * Every staff row is ONE continuous track covering the whole visible range, so a shift
 * (including overnight ones) is a single bar positioned by its absolute start/end time.
 * Day view: 24 columns of 1h.  Week view: 7 days, each split into 4h cells.
 */
function ScheduleTimeline({ view, timeline, now, onOpenDay }) {
  const { days, rows, total } = timeline;
  const isDay = view === "day";
  const todayISO = toISO(now);
  const todayIdx = days.findIndex((x) => x.date === todayISO);
  const nowPct = todayIdx >= 0 ? ((todayIdx * 1440 + now.getHours() * 60 + now.getMinutes()) / total) * 100 : null;
  const columns = isDay ? "var(--tl-name-w) minmax(1344px, 1fr)" : "var(--tl-name-w) repeat(7, minmax(240px, 1fr))";

  // Empty area of a track -> open the day that was clicked
  const handleTrackClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * days.length)));
    onOpenDay(days[idx].date);
  };

  return (
    <div className="tl-scroll">
      <div className={`tl-grid ${isDay ? "is-day" : "is-week"}`} style={{ gridTemplateColumns: columns }}>
        <div className="tl-corner">Nhân viên ({rows.length})</div>
        {isDay ? (
          <div className="tl-hours">
            {HOURS.map((h) => (
              <span key={h}>{pad(h)}:00</span>
            ))}
          </div>
        ) : (
          days.map(({ date, d }) => (
            <div key={date} className={`tl-dayhead${date === todayISO ? " is-today" : ""}`}>
              <div>
                <strong>{WEEKDAY_SHORT[d.getDay()]}</strong> <span>{fmtShort(d)}</span>
              </div>
              <div className="tl-ticks">
                {[0, 4, 8, 12, 16, 20].map((h) => (
                  <i key={h}>{h}h</i>
                ))}
              </div>
            </div>
          ))
        )}

        {rows.length === 0 && (
          <div className="tl-empty">
            <i className="bi bi-calendar-x" /> Không có ca làm việc nào trong khoảng thời gian này.
          </div>
        )}

        {rows.map((row) => (
          <React.Fragment key={row.key}>
            <div className="tl-name">
              <strong title={row.name}>{row.name}</strong>
              <small>{row.role}</small>
            </div>
            <div className="tl-track" style={{ gridColumn: "2 / -1" }} onClick={handleTrackClick}>
              {todayIdx >= 0 && <i className="tl-today-col" style={{ left: `${(todayIdx / days.length) * 100}%`, width: `${100 / days.length}%` }} />}
              {nowPct != null && <i className="tl-now" style={{ left: `${nowPct}%` }} />}
              {row.segs.map((sg, i) => {
                const meta = statusMeta(sg.item.status);
                const range = getTimeRange(sg.item);
                const label = isDay ? (sg.clipStart ? "tiếp ca đêm" : range) : `${compactHM(sg.rawFrom)}–${compactHM(sg.rawTo)}h`;
                return (
                  <button
                    key={`${sg.item.scheduleId}-${i}`}
                    type="button"
                    className={`tl-bar slot-${sg.slot} st-${meta.cls}${sg.clipStart ? " is-cont" : ""}${sg.clipEnd ? " is-spill" : ""}`}
                    style={{ left: `${(sg.from / total) * 100}%`, width: `${((sg.to - sg.from) / total) * 100}%` }}
                    title={`${row.name} · ${getShiftName(sg.item)} · ${range} · ${meta.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDay(dateOfSchedule(sg.item));
                    }}
                  >
                    <b>{sg.slot}</b>
                    <span>{label}</span>
                    {STATUS_ICON[meta.cls] && <i className={`bi ${STATUS_ICON[meta.cls]} tl-bar-status`} />}
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

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

  const [activeTab, setActiveTab] = useState("SCHEDULES");
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Calendar navigation (custom toolbar): month | week | day
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());

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

  // Day detail modal (opened by clicking a calendar day)
  const [selectedDay, setSelectedDay] = useState(null); // "YYYY-MM-DD"
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ shiftId: "", status: "SCHEDULED", notes: "" });
  const [savingEdit, setSavingEdit] = useState(false);

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
        const [shiftRes, accountRes] = await Promise.all([apiCall("/api/admin/shifts", { silentError: true }), apiCall("/api/admin/schedules/staff", { silentError: true })]);
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

  // Month view reports its own range via datesSet; week/day compute it here.
  // One extra day before the range so overnight shifts from the previous day show up.
  useEffect(() => {
    if (view === "month") return;
    const start = view === "week" ? weekStartOf(cursor) : startOfDay(cursor);
    const end = view === "week" ? addDays(start, 6) : start;
    setDateRange({ from: toISO(addDays(start, -1)), to: toISO(end) });
  }, [view, cursor]);

  // Keep the "now" line fresh in week/day views
  useEffect(() => {
    if (view === "month") return undefined;
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, [view]);

  const shiftCursor = (dir) => setCursor((c) => (view === "month" ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * (view === "week" ? 7 : 1))));

  const toolbarTitle = useMemo(() => {
    if (view === "month") return `Tháng ${cursor.getMonth() + 1} năm ${cursor.getFullYear()}`;
    if (view === "week") {
      const ws = weekStartOf(cursor);
      const we = addDays(ws, 6);
      return `Tuần ${fmtShort(ws)} – ${fmtShort(we)}/${we.getFullYear()}`;
    }
    return cursor.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  }, [view, cursor]);

  // FullCalendar datesSet callback
  const handleDatesSet = (dateInfo) => {
    const fromStr = toISO(dateInfo.start);
    const endInclusive = new Date(dateInfo.end.getTime() - 1);
    const toStr = toISO(endInclusive);
    if (fromStr !== dateRange.from || toStr !== dateRange.to) {
      setDateRange({ from: fromStr, to: toStr });
    }
  };

  // Clicking a day (or its M/A/N rows) opens the day detail modal
  const openDay = (dateStr) => {
    setEditingId(null);
    setSelectedDay(String(dateStr).slice(0, 10));
  };
  const handleDateClick = (arg) => openDay(arg.dateStr);
  const handleEventClick = (info) => openDay(info.event.extendedProps.date);

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

  // Lookups
  const shiftsById = useMemo(() => Object.fromEntries(shifts.map((sh) => [String(sh.shiftId), sh])), [shifts]);
  const accountsById = useMemo(() => Object.fromEntries(accounts.map((a) => [String(a.accountId || a.id), a])), [accounts]);

  const slotOfSchedule = useCallback(
    (item) => {
      const sh = shiftsById[String(item.shiftId)];
      return slotKeyOf(item.shiftName || item.shift?.shiftName || sh?.shiftName, item.startTime || item.shift?.startTime || sh?.startTime);
    },
    [shiftsById],
  );

  const getPhone = (item) => {
    const acc = accountsById[String(item.accountId)];
    return item.phone || item.phoneNumber || item.accountPhone || item.staffPhone || acc?.phone || acc?.phoneNumber || "—";
  };

  // Schedules grouped by day (respects the search / shift / role filters)
  const schedulesByDate = useMemo(() => {
    const map = {};
    filteredSchedules.forEach((item) => {
      const d = dateOfSchedule(item);
      if (!d) return;
      (map[d] = map[d] || []).push(item);
    });
    return map;
  }, [filteredSchedules]);

  // One all-day calendar event per day per slot: "M: Name, Name +n more"
  const calendarEvents = useMemo(() => {
    const groups = new Map();
    filteredSchedules.forEach((item) => {
      const date = dateOfSchedule(item);
      if (!date) return;
      const slot = slotOfSchedule(item);
      const key = `${date}|${slot}`;
      if (!groups.has(key)) groups.set(key, { date, slot, names: [] });
      groups.get(key).names.push(getStaffName(item));
    });
    return [...groups.values()].map((g) => {
      const meta = SLOT_BY_KEY[g.slot];
      const names = g.names.sort((a, b) => a.localeCompare(b, "vi"));
      return {
        id: `${g.date}-${g.slot}`,
        // "1." / "2." / "3." prefix keeps M, A, N in order inside each day
        title: `${meta.order}. ${meta.label}: ${names.join(", ")}`,
        start: g.date,
        allDay: true,
        backgroundColor: "transparent",
        borderColor: "transparent",
        extendedProps: { date: g.date, slot: g.slot, names },
      };
    });
  }, [filteredSchedules, slotOfSchedule]);

  // Staff rows + shift bars for the week / day timeline.
  // Bars use absolute minutes from the first visible day, so overnight shifts stay one piece.
  const timeline = useMemo(() => {
    if (view === "month") return null;
    const start = view === "week" ? weekStartOf(cursor) : startOfDay(cursor);
    const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => {
      const d = addDays(start, i);
      return { date: toISO(d), d };
    });
    const total = days.length * 1440;
    const firstUTC = Date.parse(days[0].date);
    const rowsMap = new Map();

    filteredSchedules.forEach((item) => {
      const date = dateOfSchedule(item);
      if (!date) return;
      const sh = shiftsById[String(item.shiftId)];
      const from = toMinutes(item.startTime || item.shift?.startTime || sh?.startTime);
      const to = toMinutes(item.endTime || item.shift?.endTime || sh?.endTime);
      if (from == null || to == null) return;

      const dayIdx = Math.round((Date.parse(date) - firstUTC) / 86400000);
      const absStart = dayIdx * 1440 + from;
      const absEnd = absStart + (to > from ? to - from : to + 1440 - from); // overnight => runs into next day
      const clippedStart = Math.max(absStart, 0);
      const clippedEnd = Math.min(absEnd, total);
      if (clippedEnd <= clippedStart) return;

      const key = String(item.accountId ?? item.username ?? getStaffName(item));
      if (!rowsMap.has(key)) rowsMap.set(key, { key, name: getStaffName(item), role: roleLabelOf(item.role || item.roleCode), segs: [] });
      rowsMap.get(key).segs.push({
        item,
        slot: slotOfSchedule(item),
        from: clippedStart,
        to: clippedEnd,
        rawFrom: from,
        rawTo: to,
        clipStart: absStart < 0,
        clipEnd: absEnd > total,
      });
    });

    const rows = [...rowsMap.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return { days, rows, total };
  }, [view, cursor, filteredSchedules, shiftsById, slotOfSchedule]);

  // Custom event renderer: [M] Name, Name +n more
  const renderEventContent = (eventInfo) => {
    const { slot, names } = eventInfo.event.extendedProps;
    const meta = SLOT_BY_KEY[slot];
    const shown = names.slice(0, 2);
    const rest = names.length - shown.length;
    return (
      <div className={`fc-slot-row slot-${slot}`} title={`${meta.label}: ${names.join(", ")}`}>
        <span className="fc-slot-badge">{slot}</span>
        <span className="fc-slot-names">{shown.join(", ")}</span>
        {rest > 0 && <span className="fc-slot-more">+{rest} more</span>}
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

  const shiftFilterOptions = useMemo(() => [{ value: "ALL", label: "Tất cả các ca trực" }, ...shifts.map((s) => ({ value: String(s.shiftId), label: s.shiftName || `Ca #${s.shiftId}` }))], [shifts]);

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
  const startEdit = (item) => {
    setEditingId(item.scheduleId);
    setEditForm({
      shiftId: String(item.shiftId ?? ""),
      status: (item.status || "SCHEDULED").toUpperCase(),
      notes: item.notes || "",
    });
  };

  // Changes only this schedule row, i.e. this person on this day.
  const handleSaveEdit = async (item) => {
    if (!editForm.shiftId) {
      addToast("Vui lòng chọn ca làm việc.", "warning");
      return;
    }
    setSavingEdit(true);
    try {
      await apiCall(`/api/admin/schedules/${item.scheduleId}`, {
        method: "PUT",
        body: {
          shiftId: Number(editForm.shiftId),
          status: editForm.status,
          notes: editForm.notes.trim() || null,
        },
      });
      addToast("Đã cập nhật ca làm việc trong ngày.", "success");
      setEditingId(null);
      await loadSchedules(dateRange.from, dateRange.to);
    } catch (error) {
      addToast(error?.message || "Không thể cập nhật ca làm việc.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy phân công ca làm việc này?")) return;
    try {
      await apiCall(`/api/admin/schedules/${scheduleId}`, { method: "DELETE" });
      addToast("Đã hủy phân công ca làm việc.", "success");
      setEditingId(null);
      await loadSchedules(dateRange.from, dateRange.to);
    } catch (error) {
      addToast(error?.message || "Không thể hủy phân công ca trực này.", "error");
    }
  };

  // Rows shown in the day modal, ordered M -> A -> N then by name
  const dayRows = useMemo(() => {
    if (!selectedDay) return [];
    return [...(schedulesByDate[selectedDay] || [])].sort((x, y) => {
      const sx = SLOT_BY_KEY[slotOfSchedule(x)].order;
      const sy = SLOT_BY_KEY[slotOfSchedule(y)].order;
      return sx - sy || getStaffName(x).localeCompare(getStaffName(y), "vi");
    });
  }, [selectedDay, schedulesByDate, slotOfSchedule]);

  const selectedDayLabel = selectedDay ? new Date(`${selectedDay}T00:00:00`).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : "";

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

      {/* Tabs + filters on one row */}
      <div className="admin-schedule-toolbar">
        <div className="hc-tab-group admin-schedule-tabs">
          <button type="button" className={`hc-tab-btn ${activeTab === "SCHEDULES" ? "active" : ""}`} onClick={() => setActiveTab("SCHEDULES")}>
            <i className="bi bi-calendar-week" /> Lịch làm việc
          </button>
          <button type="button" className={`hc-tab-btn ${activeTab === "SHIFTS" ? "active" : ""}`} onClick={() => setActiveTab("SHIFTS")}>
            <i className="bi bi-clock-history" /> Định nghĩa ca trực
          </button>
        </div>

        {/* Filters (same row as the tab switcher) */}
        {activeTab === "SCHEDULES" && (
          <div className="admin-schedule-filters">
            <div className="admin-filter-search">
              <i className="bi bi-search" />
              <input className="hc-input" type="search" placeholder="Tìm nhân viên, ca trực hoặc ghi chú…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <div className="admin-schedule-filter-select">
              <SelectMenu value={shiftFilter} onChange={setShiftFilter} options={shiftFilterOptions} ariaLabel="Lọc theo ca" icon="bi-clock" />
            </div>

            <div className="admin-schedule-filter-select">
              <SelectMenu value={roleFilter} onChange={setRoleFilter} options={roleFilterOptions} ariaLabel="Lọc theo vai trò" icon="bi-people" />
            </div>

            <button type="button" className="hc-btn hc-btn-outline" onClick={() => loadSchedules(dateRange.from, dateRange.to)} disabled={loading} title="Làm mới dữ liệu lịch">
              <i className={`bi bi-arrow-clockwise${loading ? " admin-schedule-spin" : ""}`} /> Làm mới
            </button>
          </div>
        )}
      </div>

      {activeTab === "SCHEDULES" ? (
        <>
          {/* FullCalendar Card */}
          <section className="hc-card admin-calendar-card">
            {/* Slot Legend */}
            <div className="admin-calendar-legend">
              {SLOTS.map((slot) => (
                <span key={slot.key} className="legend-item">
                  <i className={`legend-slot-badge slot-${slot.key}`}>{slot.key}</i> {slot.label}
                </span>
              ))}
              <span className="legend-tip">
                <i className="bi bi-info-circle" /> Nhấp vào một ngày để xem danh sách nhân viên và chỉnh ca trong ngày đó.
              </span>
            </div>

            <div className="admin-calendar-wrapper">
              {/* Toolbar (shared by month / week / day) */}
              <div className="admin-cal-toolbar">
                <div className="admin-cal-btn-group is-nav">
                  <button type="button" className="admin-cal-btn" aria-label="Trước" onClick={() => shiftCursor(-1)}>
                    <i className="bi bi-chevron-left" />
                  </button>
                  <button type="button" className="admin-cal-btn" aria-label="Sau" onClick={() => shiftCursor(1)}>
                    <i className="bi bi-chevron-right" />
                  </button>
                  <button type="button" className="admin-cal-btn" onClick={() => setCursor(new Date())}>
                    Hôm nay
                  </button>
                </div>

                <h3 className="admin-cal-title">{toolbarTitle}</h3>

                <div className="admin-cal-btn-group is-views">
                  {[
                    ["month", "Tháng"],
                    ["week", "Tuần"],
                    ["day", "Ngày"],
                  ].map(([key, label]) => (
                    <button key={key} type="button" className={`admin-cal-btn is-view${view === key ? " is-selected" : ""}`} onClick={() => setView(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {view === "month" ? (
                <FullCalendar
                  key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
                  plugins={[dayGridPlugin, interactionPlugin, classicThemePlugin]}
                  initialView="dayGridMonth"
                  initialDate={cursor}
                  locales={[viLocale]}
                  locale="vi"
                  headerToolbar={false}
                  dayMaxEvents={false}
                  eventOrder="title"
                  height="auto"
                  aspectRatio={6}
                  dayRowClass="admin-cal-dayrow"
                  dayCellClass="admin-cal-daycell"
                  dayHeaderRowClass="admin-cal-dayheader-row"
                  dayHeaderClass="admin-cal-dayheader-cell"
                  dayHeaderInnerClass="admin-cal-dayheader"
                  dayCellTopInnerClass={(info) => `admin-cal-daynum${info.isToday ? " is-today" : ""}`}
                  eventClass="admin-cal-event"
                  datesSet={handleDatesSet}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  eventContent={renderEventContent}
                  events={calendarEvents}
                />
              ) : (
                <ScheduleTimeline view={view} timeline={timeline} now={now} onOpenDay={openDay} />
              )}
            </div>
          </section>

          {/* Day detail modal */}
          {selectedDay && (
            <Modal
              isOpen={Boolean(selectedDay)}
              onClose={() => {
                setSelectedDay(null);
                setEditingId(null);
              }}
              title={`Lịch làm việc ngày ${formatDate(selectedDay)}`}
              subtitle={`${selectedDayLabel} · ${dayRows.length} ca làm việc`}
              icon="bi-calendar-check"
              maxWidth="1100px"
              footer={
                <div className="admin-modal-actions" style={{ justifyContent: "space-between", width: "100%" }}>
                  <button
                    type="button"
                    className="hc-btn hc-btn-outline hc-btn-sm"
                    onClick={() => {
                      const day = selectedDay;
                      setSelectedDay(null);
                      openAssignModal(day);
                    }}
                  >
                    <i className="bi bi-person-plus" /> Thêm nhân viên vào ngày này
                  </button>
                  <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={() => setSelectedDay(null)}>
                    Đóng
                  </button>
                </div>
              }
            >
              {dayRows.length === 0 ? (
                <div className="hc-empty-state">
                  <i className="bi bi-calendar-x" />
                  <p>Chưa có nhân viên nào được xếp ca trong ngày này.</p>
                </div>
              ) : (
                <div className="admin-day-table-wrap">
                  <table className="hc-table admin-day-table">
                    <thead>
                      <tr>
                        <th style={{ width: 44 }}>#</th>
                        <th>Nhân viên</th>
                        <th>Số điện thoại</th>
                        <th>Vai trò</th>
                        <th>Ca</th>
                        <th>Giờ làm việc</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: "right", width: 110 }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((item, index) => {
                        const slot = slotOfSchedule(item);
                        const meta = statusMeta(item.status);
                        const isEditing = editingId === item.scheduleId;
                        return (
                          <React.Fragment key={item.scheduleId}>
                            <tr className={isEditing ? "is-editing" : ""}>
                              <td>{index + 1}</td>
                              <td>
                                <strong>{getStaffName(item)}</strong>
                                <div className="admin-subtext">@{item.accountUsername || item.username || "—"}</div>
                              </td>
                              <td>{getPhone(item)}</td>
                              <td>{roleLabelOf(item.role || item.roleCode)}</td>
                              <td>
                                <span className={`day-slot-chip slot-${slot}`}>
                                  <b>{slot}</b> {getShiftName(item)}
                                </span>
                              </td>
                              <td className="u-nowrap">{getTimeRange(item)}</td>
                              <td>
                                <span className={`admin-calendar-status ${meta.cls}`}>{meta.label}</span>
                              </td>
                              <td className="u-text-right">
                                <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => (isEditing ? setEditingId(null) : startEdit(item))}>
                                  <i className={`bi ${isEditing ? "bi-x-lg" : "bi-pencil"}`} /> {isEditing ? "Đóng" : "Sửa"}
                                </button>
                              </td>
                            </tr>

                            {isEditing && (
                              <tr className="admin-day-edit-row">
                                <td colSpan={8}>
                                  <div className="admin-day-edit">
                                    <div className="hc-form-group">
                                      <label className="hc-label">Chuyển sang ca (chỉ áp dụng cho ngày này)</label>
                                      <div className="admin-slot-picker">
                                        {shifts.map((sh) => {
                                          const k = slotKeyOf(sh.shiftName, sh.startTime);
                                          const active = String(sh.shiftId) === editForm.shiftId;
                                          return (
                                            <button
                                              key={sh.shiftId}
                                              type="button"
                                              className={`admin-slot-option slot-${k}${active ? " active" : ""}`}
                                              onClick={() => setEditForm((f) => ({ ...f, shiftId: String(sh.shiftId) }))}
                                            >
                                              <b>{k}</b>
                                              <span>{sh.shiftName || `Ca #${sh.shiftId}`}</span>
                                              <small>
                                                {formatTime(sh.startTime)} – {formatTime(sh.endTime)}
                                              </small>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="admin-day-edit-fields">
                                      <div className="hc-form-group mb-0">
                                        <label className="hc-label">Trạng thái</label>
                                        <SelectMenu
                                          value={editForm.status}
                                          onChange={(value) => setEditForm((f) => ({ ...f, status: value }))}
                                          options={STATUS_OPTIONS}
                                          ariaLabel="Chọn trạng thái"
                                          icon="bi-flag"
                                        />
                                      </div>
                                      <div className="hc-form-group mb-0">
                                        <label className="hc-label">Ghi chú</label>
                                        <input
                                          className="hc-input"
                                          value={editForm.notes}
                                          onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                                          placeholder="Ghi chú cho ca này (tùy chọn)"
                                        />
                                      </div>
                                    </div>

                                    <div className="admin-day-edit-actions">
                                      <button type="button" className="hc-btn hc-btn-ghost hc-btn-sm text-danger" onClick={() => handleDeleteSchedule(item.scheduleId)}>
                                        <i className="bi bi-trash" /> Hủy ca này
                                      </button>
                                      <div style={{ display: "flex", gap: 8 }}>
                                        <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setEditingId(null)}>
                                          Hủy bỏ
                                        </button>
                                        <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={savingEdit} onClick={() => handleSaveEdit(item)}>
                                          {savingEdit ? "Đang lưu…" : "Lưu thay đổi"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Modal>
          )}
        </>
      ) : (
        /* SHIFTS DEFINITION TAB */
        <section className="hc-card">
          <div className="hc-card-header">
            <div className="admin-card-head-row">
              <h3 className="hc-card-title">Danh sách ca làm việc</h3>
              <span className="legend-tip">
                <i className="bi bi-info-circle" /> Cấu hình các khung giờ làm việc chuẩn để xếp lịch nhân sự.
              </span>
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
            <div className="hc-card-body flush u-scroll-x">
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Ca làm việc</th>
                    <th>Giờ bắt đầu</th>
                    <th>Giờ kết thúc</th>
                    <th>Mô tả</th>
                    <th className="u-text-right">Thao tác</th>
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
                      <td className="u-text-right">
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
                          <button type="button" className="hc-btn hc-btn-ghost hc-btn-sm text-danger" onClick={() => handleDeleteShift(shift.shiftId)} title="Xóa ca này">
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
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={submittingBulk || bulkForm.accountIds.length === 0} onClick={handleBulkSubmit}>
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
            <SelectMenu value={bulkForm.shiftId} onChange={(value) => setBulkForm((prev) => ({ ...prev, shiftId: value }))} options={shiftOptions} ariaLabel="Chọn ca làm việc" icon="bi-clock" />
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
              <input className="hc-input hc-input-sm" type="search" placeholder="Tìm nhanh theo tên nhân viên…" value={bulkStaffSearch} onChange={(e) => setBulkStaffSearch(e.target.value)} />
              <div className="bulk-staff-role-filter">
                <SelectMenu value={bulkStaffRole} onChange={setBulkStaffRole} options={BULK_ROLE_OPTIONS} ariaLabel="Lọc theo bộ phận" icon="bi-people" />
              </div>
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
              <DatePicker
                value={bulkForm.startDate}
                onChange={(value) => setBulkForm((prev) => ({ ...prev, startDate: value, endDate: prev.endDate && prev.endDate < value ? value : prev.endDate }))}
                ariaLabel="Từ ngày"
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">
                Đến ngày <span className="text-danger">*</span>
              </label>
              <DatePicker value={bulkForm.endDate} min={bulkForm.startDate} onChange={(value) => setBulkForm((prev) => ({ ...prev, endDate: value }))} ariaLabel="Đến ngày" />
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
                  <button key={day.key} type="button" className={`bulk-weekday-pill ${isActive ? "active" : ""}`} onClick={() => toggleDayOfWeek(day.key)} title={day.fullName}>
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
              <input type="checkbox" checked={bulkForm.overwrite} onChange={(e) => setBulkForm((prev) => ({ ...prev, overwrite: e.target.checked }))} />
              <span>
                <strong>Ghi đè ca nếu nhân viên đã có lịch trong ngày</strong>
                <small>Nếu tắt, các ngày nhân viên đã có lịch sẽ được tự động bỏ qua.</small>
              </span>
            </label>
          </div>

          <div className="hc-form-group mb-0">
            <label className="hc-label">Ghi chú phân công (tùy chọn)</label>
            <input className="hc-input" value={bulkForm.notes} onChange={(e) => setBulkForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="VD: Phân ca tăng cường tuần lễ du lịch..." />
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
            <SelectMenu value={assignForm.shiftId} onChange={(value) => setAssignForm((current) => ({ ...current, shiftId: value }))} options={shiftOptions} ariaLabel="Chọn ca" icon="bi-clock" />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">
              Ngày làm việc <span className="text-danger">*</span>
            </label>
            <DatePicker value={assignForm.workDate} onChange={(value) => setAssignForm((current) => ({ ...current, workDate: value }))} ariaLabel="Ngày làm việc" />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Ghi chú</label>
            <input className="hc-input" value={assignForm.notes} onChange={(e) => setAssignForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Ghi chú phân công tùy chọn" />
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
              <TimePicker value={shiftForm.startTime} onChange={(value) => setShiftForm((current) => ({ ...current, startTime: value }))} ariaLabel="Giờ bắt đầu" />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Giờ kết thúc</label>
              <TimePicker value={shiftForm.endTime} onChange={(value) => setShiftForm((current) => ({ ...current, endTime: value }))} ariaLabel="Giờ kết thúc" />
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
