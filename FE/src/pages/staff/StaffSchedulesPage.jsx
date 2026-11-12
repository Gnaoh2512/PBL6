import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiCall } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
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

const getShiftName = (schedule) => schedule.shiftName || schedule.shift?.shiftName || (schedule.shiftId ? `Shift #${schedule.shiftId}` : "Work shift");

const getTimeRange = (schedule) => {
  const start = formatTime(schedule.startTime || schedule.shift?.startTime);
  const end = formatTime(schedule.endTime || schedule.shift?.endTime);
  if (!start && !end) return "Time not specified";
  const overnight = Boolean(schedule.overnight) || (start && end && end < start);
  return `${start || "--:--"} – ${end || "--:--"}${overnight ? " (+1 day)" : ""}`;
};

const statusLabel = (status) => {
  const labels = {
    SCHEDULED: "Scheduled",
    COMPLETED: "Completed",
    ABSENT: "Absent",
    OFF: "Day off",
  };
  return labels[status] || status || "Scheduled";
};

const statusClass = (status) => {
  const classes = {
    SCHEDULED: "scheduled",
    COMPLETED: "completed",
    ABSENT: "absent",
    OFF: "off",
  };
  return classes[status] || "scheduled";
};

export default function StaffSchedulesPage() {
  const { addToast } = useToast();
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

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
      addToast(error?.message || "Unable to load your work schedule.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, from, to]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const schedulesByDate = useMemo(() => {
    const grouped = new Map();
    schedules.forEach((schedule) => {
      const date = schedule.workDate;
      if (!date) return;
      const current = grouped.get(date) || [];
      current.push(schedule);
      grouped.set(date, current);
    });
    grouped.forEach((items) => items.sort((a, b) => formatTime(a.startTime || a.shift?.startTime).localeCompare(formatTime(b.startTime || b.shift?.startTime))));
    return grouped;
  }, [schedules]);

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
  const monthLabel = visibleMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const counts = useMemo(
    () => ({
      total: schedules.length,
      scheduled: schedules.filter((item) => (item.status || "SCHEDULED") === "SCHEDULED").length,
      completed: schedules.filter((item) => item.status === "COMPLETED").length,
      absent: schedules.filter((item) => item.status === "ABSENT").length,
    }),
    [schedules],
  );

  const changeMonth = (amount) => {
    setSelectedSchedule(null);
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <div className="ops-page staff-schedule-page">
      <div className="hc-page-title staff-schedule-heading">
        <div>
          <h2>My Work Schedule</h2>
          <p>View your assigned shifts, working hours, and schedule status.</p>
        </div>
        <button type="button" className="hc-btn hc-btn-outline" onClick={loadSchedules} disabled={loading}>
          <i className={`bi bi-arrow-clockwise${loading ? " staff-schedule-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="hc-stats-grid staff-schedule-stats">
        <div className="hc-stat-card">
          <div className="hc-stat-icon" style={{ background: "var(--hc-primary-subtle)", color: "var(--hc-primary)" }}>
            <i className="bi bi-calendar3" />
          </div>
          <div>
            <div className="hc-stat-value">{counts.total}</div>
            <div className="hc-stat-label">Shifts this month</div>
          </div>
        </div>
        <div className="hc-stat-card">
          <div className="hc-stat-icon" style={{ background: "var(--hc-warning-bg)", color: "var(--hc-warning)" }}>
            <i className="bi bi-clock-history" />
          </div>
          <div>
            <div className="hc-stat-value">{counts.scheduled}</div>
            <div className="hc-stat-label">Scheduled</div>
          </div>
        </div>
        <div className="hc-stat-card">
          <div className="hc-stat-icon" style={{ background: "var(--hc-success-bg)", color: "var(--hc-success)" }}>
            <i className="bi bi-check2-circle" />
          </div>
          <div>
            <div className="hc-stat-value">{counts.completed}</div>
            <div className="hc-stat-label">Completed</div>
          </div>
        </div>
        <div className="hc-stat-card">
          <div className="hc-stat-icon" style={{ background: "var(--hc-error-bg)", color: "var(--hc-error)" }}>
            <i className="bi bi-calendar-x" />
          </div>
          <div>
            <div className="hc-stat-value">{counts.absent}</div>
            <div className="hc-stat-label">Absent</div>
          </div>
        </div>
      </div>

      <section className="hc-card staff-calendar-card">
        <div className="hc-card-header staff-calendar-toolbar">
          <div className="staff-calendar-month">
            <h3 className="hc-card-title">{monthLabel}</h3>
            <span>
              {schedules.length} assigned shift{schedules.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="staff-calendar-actions">
            <button
              type="button"
              className="hc-btn hc-btn-outline hc-btn-sm"
              onClick={() => {
                setSelectedSchedule(null);
                setVisibleMonth(monthStart(new Date()));
              }}
            >
              Today
            </button>
            <div className="staff-calendar-nav">
              <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" aria-label="Previous month" onClick={() => changeMonth(-1)}>
                <i className="bi bi-chevron-left" />
              </button>
              <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" aria-label="Next month" onClick={() => changeMonth(1)}>
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        </div>

        <div className="staff-calendar-legend">
          <span>
            <i className="staff-legend-dot scheduled" /> Scheduled
          </span>
          <span>
            <i className="staff-legend-dot completed" /> Completed
          </span>
          <span>
            <i className="staff-legend-dot absent" /> Absent
          </span>
          <span>
            <i className="staff-legend-dot off" /> Day off
          </span>
        </div>

        {loading ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner" />
          </div>
        ) : (
          <div className="staff-calendar-scroll">
            <div className="staff-calendar-grid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div className="staff-calendar-weekday" key={day}>
                  {day}
                </div>
              ))}
              {calendarDays.map((date) => {
                const dateKey = toISODate(date);
                const daySchedules = schedulesByDate.get(dateKey) || [];
                const inMonth = date.getMonth() === visibleMonth.getMonth();
                return (
                  <div
                    key={dateKey}
                    className={["staff-calendar-day", !inMonth ? "outside-month" : "", dateKey === today ? "is-today" : "", daySchedules.length ? "has-shifts" : ""].filter(Boolean).join(" ")}
                  >
                    <div className="staff-calendar-day-number">{date.getDate()}</div>
                    <div className="staff-calendar-events">
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <button
                          type="button"
                          key={schedule.scheduleId}
                          className={`staff-calendar-event ${statusClass(schedule.status)}`}
                          onClick={() => setSelectedSchedule(schedule)}
                          title={`${getShiftName(schedule)} · ${getTimeRange(schedule)}`}
                        >
                          <strong>{getShiftName(schedule)}</strong>
                          <span>{getTimeRange(schedule)}</span>
                        </button>
                      ))}
                      {daySchedules.length > 3 && <span className="staff-calendar-more">+{daySchedules.length - 3} more</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && schedules.length === 0 && (
          <div className="staff-calendar-empty">
            <i className="bi bi-calendar2-check" />
            <strong>No shifts assigned</strong>
            <span>There are no work shifts assigned to you for this month.</span>
          </div>
        )}
      </section>

      {selectedSchedule && (
        <section className="hc-card staff-schedule-detail" aria-live="polite">
          <div className="hc-card-header">
            <div>
              <h3 className="hc-card-title">Shift details</h3>
              <span className="staff-schedule-detail-date">
                {new Date(`${selectedSchedule.workDate}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <button type="button" className="hc-btn hc-btn-ghost hc-btn-sm" onClick={() => setSelectedSchedule(null)} aria-label="Close shift details">
              <i className="bi bi-x-lg" />
            </button>
          </div>
          <div className="hc-card-body staff-schedule-detail-body">
            <div>
              <span className="staff-detail-label">Shift</span>
              <strong>{getShiftName(selectedSchedule)}</strong>
            </div>
            <div>
              <span className="staff-detail-label">Working hours</span>
              <strong>
                <i className="bi bi-clock" /> {getTimeRange(selectedSchedule)}
              </strong>
            </div>
            <div>
              <span className="staff-detail-label">Status</span>
              <span className={`staff-status-pill ${statusClass(selectedSchedule.status)}`}>{statusLabel(selectedSchedule.status)}</span>
            </div>
            <div className="staff-detail-notes">
              <span className="staff-detail-label">Notes</span>
              <p>{selectedSchedule.notes || "No notes for this shift."}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
