import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import SelectMenu from "../../components/common/SelectMenu";
import { apiCall } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import "./StaffSchedulesPage.css";

const pad2 = (value) => String(value).padStart(2, "0");

const toISODate = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthEnd = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const formatTime = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return `${pad2(value[0])}:${pad2(value[1] || 0)}`;
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
};

const getShiftDisplayName = (schedule) => {
  const raw = (schedule.shiftName || schedule.shift?.shiftName || "").toUpperCase();
  if (raw.includes("MORNING") || raw.includes("SÁNG") || raw.includes("SANG")) return "Ca Sáng";
  if (raw.includes("AFTERNOON") || raw.includes("CHIỀU") || raw.includes("CHIEU")) return "Ca Chiều";
  if (raw.includes("NIGHT") || raw.includes("ĐÊM") || raw.includes("DEM")) return "Ca Đêm";
  return schedule.shiftName || schedule.shift?.shiftName || (schedule.shiftId ? `Ca #${schedule.shiftId}` : "Ca làm việc");
};

const getShiftIcon = (schedule) => {
  const raw = (schedule.shiftName || schedule.shift?.shiftName || "").toUpperCase();
  if (raw.includes("MORNING") || raw.includes("SÁNG") || raw.includes("SANG")) return "bi-sun-fill text-warning";
  if (raw.includes("AFTERNOON") || raw.includes("CHIỀU") || raw.includes("CHIEU")) return "bi-sunset-fill text-orange";
  if (raw.includes("NIGHT") || raw.includes("ĐÊM") || raw.includes("DEM")) return "bi-moon-stars-fill text-indigo";
  return "bi-clock-fill text-primary";
};

const getTimeRange = (schedule) => {
  const start = formatTime(schedule.startTime || schedule.shift?.startTime);
  const end = formatTime(schedule.endTime || schedule.shift?.endTime);
  if (!start && !end) return "Chưa xác định giờ";
  const overnight = Boolean(schedule.overnight) || (start && end && end < start);
  return `${start || "--:--"} – ${end || "--:--"}${overnight ? " (+1 ngày)" : ""}`;
};

const calculateShiftHours = (schedule) => {
  const startStr = formatTime(schedule.startTime || schedule.shift?.startTime);
  const endStr = formatTime(schedule.endTime || schedule.shift?.endTime);
  if (!startStr || !endStr) return 8;

  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const start = sh + sm / 60;
  const end = eh + em / 60;

  if (Boolean(schedule.overnight) || end < start) {
    return (24 - start) + end;
  }
  return Math.max(0, end - start);
};

const STATUS_META = {
  SCHEDULED: { label: "Đã phân công", badge: "hc-badge-info", dotClass: "scheduled" },
  COMPLETED: { label: "Đã hoàn thành", badge: "hc-badge-success", dotClass: "completed" },
  ABSENT: { label: "Vắng mặt", badge: "hc-badge-error", dotClass: "absent" },
  OFF: { label: "Nghỉ phép", badge: "hc-badge-muted", dotClass: "off" },
};

const statusLabel = (status) => STATUS_META[status]?.label || status || "Đã phân công";
const statusClass = (status) => STATUS_META[status]?.dotClass || "scheduled";
const statusBadge = (status) => STATUS_META[status]?.badge || "hc-badge-info";

const roleLabelOf = (roleCode) => {
  const code = (roleCode || "").replace("ROLE_", "").toUpperCase();
  const map = {
    ADMIN: "Quản trị viên",
    MANAGER: "Quản lý ca",
    RECEPTIONIST: "Lễ tân",
    HOUSEKEEPING: "Buồng phòng / Dọn phòng",
    SERVICE_STAFF: "Phục vụ / Nhà hàng",
    MAINTENANCE: "Kỹ thuật / Bảo trì",
  };
  return map[code] || code || "Nhân viên";
};

export default function StaffSchedulesPage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Filters
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const from = toISODate(monthStart(visibleMonth));
  const to = toISODate(monthEnd(visibleMonth));

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCall(`/api/staff/schedules/me?from=${from}&to=${to}`, { silentError: true });
      const data = response?.data ?? (Array.isArray(response) ? response : []);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
      setSchedules([]);
      addToast(error?.message || "Không thể tải lịch làm việc cá nhân.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, from, to]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Filtered schedules for calendar display
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const shiftName = getShiftDisplayName(s);
      const matchShift = shiftFilter === "ALL" || shiftName.toUpperCase().includes(shiftFilter.toUpperCase());
      const matchStatus = statusFilter === "ALL" || (s.status || "SCHEDULED").toUpperCase() === statusFilter.toUpperCase();
      return matchShift && matchStatus;
    });
  }, [schedules, shiftFilter, statusFilter]);

  const schedulesByDate = useMemo(() => {
    const grouped = new Map();
    filteredSchedules.forEach((schedule) => {
      const date = schedule.workDate;
      if (!date) return;
      const current = grouped.get(date) || [];
      current.push(schedule);
      grouped.set(date, current);
    });
    grouped.forEach((items) =>
      items.sort((a, b) => formatTime(a.startTime || a.shift?.startTime).localeCompare(formatTime(b.startTime || b.shift?.startTime)))
    );
    return grouped;
  }, [filteredSchedules]);

  const calendarDays = useMemo(() => {
    const first = monthStart(visibleMonth);
    const last = monthEnd(visibleMonth);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);

    const count = Math.ceil((mondayOffset + last.getDate()) / 7) * 7;
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const today = toISODate(new Date());

  const monthLabel = useMemo(() => {
    const month = visibleMonth.getMonth() + 1;
    const year = visibleMonth.getFullYear();
    return `Tháng ${month} năm ${year}`;
  }, [visibleMonth]);

  const changeMonth = (amount) => {
    setSelectedSchedule(null);
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  // Monthly stats
  const totalShifts = schedules.length;
  const totalHours = useMemo(() => {
    return schedules
      .filter((s) => s.status !== "ABSENT" && s.status !== "OFF")
      .reduce((sum, s) => sum + calculateShiftHours(s), 0);
  }, [schedules]);

  const completedShifts = schedules.filter((s) => s.status === "COMPLETED").length;

  const nextUpcomingShift = useMemo(() => {
    const upcoming = schedules
      .filter((s) => s.workDate && s.workDate >= today && s.status !== "COMPLETED" && s.status !== "OFF")
      .sort((a, b) => a.workDate.localeCompare(b.workDate));
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [schedules, today]);

  return (
    <div className="ops-page staff-schedule-page">
      {/* Page Title */}
      <div className="hc-page-title staff-schedule-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2>Ca & Lịch Làm Việc Của Tôi</h2>
          <p>
            Theo dõi chi tiết các ca trực cá nhân, khung giờ làm việc và trạng thái phân công trong tháng.
            {user?.fullName && <span> (Nhân viên: <strong>{user.fullName}</strong>)</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="hc-btn hc-btn-outline"
            onClick={() => {
              setSelectedSchedule(null);
              setVisibleMonth(monthStart(new Date()));
            }}
          >
            <i className="bi bi-calendar-event"></i> Hôm nay
          </button>
          <button type="button" className="hc-btn hc-btn-outline" onClick={loadSchedules} disabled={loading}>
            <i className={`bi bi-arrow-clockwise${loading ? " staff-schedule-spin" : ""}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Monthly Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div style={{ background: "var(--hc-bg-card, #fff)", border: "1px solid var(--hc-border, #e2e8f0)", borderRadius: "var(--hc-radius-md)", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "var(--hc-radius-sm)", background: "rgba(2, 132, 199, 0.1)", color: "var(--hc-primary, #0284c7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            <i className="bi bi-calendar-check-fill"></i>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--hc-text-muted, #64748b)", textTransform: "uppercase", fontWeight: "600" }}>Tổng ca trong tháng</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--hc-text-dark, #0f172a)" }}>
              {totalShifts} <small style={{ fontSize: "13px", fontWeight: "400" }}>ca trực</small>
            </div>
          </div>
        </div>

        <div style={{ background: "var(--hc-bg-card, #fff)", border: "1px solid var(--hc-border, #e2e8f0)", borderRadius: "var(--hc-radius-md)", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "var(--hc-radius-sm)", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            <i className="bi bi-clock-history"></i>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--hc-text-muted, #64748b)", textTransform: "uppercase", fontWeight: "600" }}>Tổng giờ làm việc</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#10b981" }}>
              {Math.round(totalHours)} <small style={{ fontSize: "13px", fontWeight: "400" }}>tiếng</small>
            </div>
          </div>
        </div>

        <div style={{ background: "var(--hc-bg-card, #fff)", border: "1px solid var(--hc-border, #e2e8f0)", borderRadius: "var(--hc-radius-md)", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "var(--hc-radius-sm)", background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--hc-text-muted, #64748b)", textTransform: "uppercase", fontWeight: "600" }}>Đã hoàn tất</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#3b82f6" }}>
              {completedShifts} / {totalShifts} <small style={{ fontSize: "13px", fontWeight: "400" }}>ca</small>
            </div>
          </div>
        </div>

        <div style={{ background: "var(--hc-bg-card, #fff)", border: "1px solid var(--hc-border, #e2e8f0)", borderRadius: "var(--hc-radius-md)", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "var(--hc-radius-sm)", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            <i className="bi bi-bell-fill"></i>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "12px", color: "var(--hc-text-muted, #64748b)", textTransform: "uppercase", fontWeight: "600" }}>Ca trực tiếp theo</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--hc-text-dark, #0f172a)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {nextUpcomingShift ? (
                <span>
                  {nextUpcomingShift.workDate === today ? "Hôm nay: " : `${nextUpcomingShift.workDate}: `}
                  {getShiftDisplayName(nextUpcomingShift)} ({formatTime(nextUpcomingShift.startTime || nextUpcomingShift.shift?.startTime)})
                </span>
              ) : (
                <span style={{ color: "var(--hc-text-muted)", fontWeight: "400" }}>Không có ca sắp tới</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <section className="hc-card staff-calendar-card">
        {/* Calendar Toolbar */}
        <div className="hc-card-header staff-calendar-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", padding: "16px 20px" }}>
          <div className="staff-calendar-month" style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
            <h3 className="hc-card-title" style={{ fontSize: "18px", fontWeight: "700", margin: 0, color: "var(--hc-text-dark, #0f172a)" }}>
              {monthLabel}
            </h3>
            <span style={{ color: "var(--hc-text-muted)", fontSize: "13px" }}>
              ({filteredSchedules.length} ca trực được hiển thị)
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Filter by Shift */}
            <div style={{ width: "150px" }}>
              <SelectMenu
                ariaLabel="Lọc ca làm việc"
                icon="bi-clock"
                value={shiftFilter}
                onChange={setShiftFilter}
                options={[
                  { value: "ALL", label: "Tất cả ca" },
                  { value: "SÁNG", label: "Ca Sáng" },
                  { value: "CHIỀU", label: "Ca Chiều" },
                  { value: "ĐÊM", label: "Ca Đêm" },
                ]}
              />
            </div>

            {/* Filter by Status */}
            <div style={{ width: "165px" }}>
              <SelectMenu
                ariaLabel="Lọc trạng thái"
                icon="bi-funnel"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "ALL", label: "Tất cả trạng thái" },
                  { value: "SCHEDULED", label: "Đã phân công" },
                  { value: "COMPLETED", label: "Đã hoàn thành" },
                  { value: "ABSENT", label: "Vắng mặt" },
                  { value: "OFF", label: "Nghỉ phép" },
                ]}
              />
            </div>

            {/* Month Nav Buttons */}
            <div className="staff-calendar-nav" style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="hc-btn hc-btn-outline hc-btn-sm"
                aria-label="Tháng trước"
                onClick={() => changeMonth(-1)}
                title="Tháng trước"
              >
                <i className="bi bi-chevron-left" />
              </button>
              <button
                type="button"
                className="hc-btn hc-btn-outline hc-btn-sm"
                aria-label="Tháng sau"
                onClick={() => changeMonth(1)}
                title="Tháng sau"
              >
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="staff-calendar-legend" style={{ display: "flex", flexWrap: "wrap", gap: "16px", padding: "10px 20px", borderBottom: "1px solid var(--hc-border-light, #e2e8f0)", fontSize: "12px", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "var(--hc-text-muted)" }}>Chú thích trạng thái:</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <i className="staff-legend-dot scheduled" /> Đã phân công
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <i className="staff-legend-dot completed" /> Đã hoàn thành
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <i className="staff-legend-dot absent" /> Vắng mặt
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <i className="staff-legend-dot off" /> Nghỉ phép
          </span>
          <span style={{ marginLeft: "auto", color: "var(--hc-text-muted)", fontSize: "11px" }}>
            <i className="bi bi-info-circle"></i> Bấm vào ca làm việc để xem chi tiết
          </span>
        </div>

        {/* Calendar Body */}
        {loading ? (
          <div className="hc-loading-spinner" style={{ padding: "60px 0" }}>
            <div className="hc-spinner" />
            <p style={{ marginTop: "12px", color: "var(--hc-text-muted)", fontSize: "13px" }}>Đang tải lịch làm việc...</p>
          </div>
        ) : (
          <div className="staff-calendar-scroll">
            <div className="staff-calendar-grid">
              {["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"].map((day) => (
                <div className="staff-calendar-weekday" key={day}>
                  {day}
                </div>
              ))}
              {calendarDays.map((date) => {
                const dateKey = toISODate(date);
                const daySchedules = schedulesByDate.get(dateKey) || [];
                const inMonth = date.getMonth() === visibleMonth.getMonth();
                const isCurrentToday = dateKey === today;

                return (
                  <div
                    key={dateKey}
                    className={[
                      "staff-calendar-day",
                      !inMonth ? "outside-month" : "",
                      isCurrentToday ? "is-today" : "",
                      daySchedules.length ? "has-shifts" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="staff-calendar-day-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span className="staff-calendar-day-number" style={isCurrentToday ? { background: "var(--hc-primary, #0284c7)", color: "#fff" } : {}}>
                        {date.getDate()}
                      </span>
                      {daySchedules.length > 0 && (
                        <span style={{ fontSize: "10px", color: "var(--hc-text-muted)", fontWeight: 600 }}>
                          {daySchedules.length} ca
                        </span>
                      )}
                    </div>

                    <div className="staff-calendar-events">
                      {daySchedules.map((schedule) => {
                        const shiftName = getShiftDisplayName(schedule);
                        const timeRange = getTimeRange(schedule);
                        const stClass = statusClass(schedule.status);
                        const shiftIcon = getShiftIcon(schedule);

                        return (
                          <button
                            type="button"
                            key={schedule.scheduleId}
                            className={`staff-calendar-event ${stClass}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSchedule(schedule);
                            }}
                            title={`${shiftName} · ${timeRange} · Trạng thái: ${statusLabel(schedule.status)}`}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", width: "100%" }}>
                              <i className={`bi ${shiftIcon}`} style={{ fontSize: "11px" }}></i>
                              <strong>{shiftName}</strong>
                            </div>
                            <span style={{ fontSize: "10px", opacity: 0.9 }}>
                              <i className="bi bi-clock"></i> {timeRange}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && filteredSchedules.length === 0 && (
          <div className="staff-calendar-empty">
            <i className="bi bi-calendar2-check" />
            <strong>Không có ca làm việc nào</strong>
            <span>Không có ca trực nào được phân công cho bạn trong khoảng thời gian này.</span>
          </div>
        )}
      </section>

      {/* Shift Detail Modal */}
      <Modal
        isOpen={!!selectedSchedule}
        onClose={() => setSelectedSchedule(null)}
        title={selectedSchedule ? `Chi tiết: ${getShiftDisplayName(selectedSchedule)}` : "Chi tiết ca làm việc"}
        subtitle="Thông tin phân công ca trực và khung giờ làm việc"
        icon="bi-calendar-event-fill"
        maxWidth="500px"
        headerExtra={
          selectedSchedule ? (
            <span className={`hc-badge ${statusBadge(selectedSchedule.status)}`}>
              {statusLabel(selectedSchedule.status)}
            </span>
          ) : null
        }
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={() => setSelectedSchedule(null)}>
              Đóng
            </button>
          </div>
        }
      >
        {selectedSchedule && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "var(--hc-bg-card, #f8fafc)", padding: "14px", borderRadius: "var(--hc-radius-sm)", border: "1px solid var(--hc-border, #e2e8f0)" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--hc-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Ngày làm việc</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--hc-text-dark, #0f172a)", marginTop: "2px" }}>
                  {new Date(`${selectedSchedule.workDate}T00:00:00`).toLocaleDateString("vi-VN", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "11px", color: "var(--hc-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Tên ca làm việc</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--hc-primary, #0284c7)", marginTop: "2px" }}>
                  {getShiftDisplayName(selectedSchedule)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "11px", color: "var(--hc-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Khung giờ trực</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--hc-text-dark, #0f172a)", marginTop: "2px" }}>
                  <i className="bi bi-clock"></i> {getTimeRange(selectedSchedule)}
                </div>
                <small style={{ color: "var(--hc-text-muted)", fontSize: "11px" }}>
                  Thời lượng: {calculateShiftHours(selectedSchedule)} tiếng
                </small>
              </div>

              <div>
                <div style={{ fontSize: "11px", color: "var(--hc-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Vị trí / Vai trò</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--hc-text-dark, #0f172a)", marginTop: "2px" }}>
                  {roleLabelOf(selectedSchedule.roleCode || user?.role)}
                </div>
              </div>
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Ghi chú phân công ca trực</label>
              <div style={{ padding: "10px 14px", background: "var(--hc-bg, #f8fafc)", border: "1px solid var(--hc-border, #e2e8f0)", borderRadius: "var(--hc-radius-sm)", fontSize: "13px", color: "var(--hc-text-secondary, #475569)", minHeight: "60px" }}>
                {selectedSchedule.notes ? selectedSchedule.notes : <em style={{ color: "var(--hc-text-muted)" }}>Không có ghi chú thêm cho ca trực này.</em>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
