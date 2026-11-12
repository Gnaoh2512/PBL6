import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatDate } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import "./AdminSchedulesPage.css";

const pad = (v) => String(v).padStart(2, "0");
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthEnd = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const roleCodeOf = (role) => {
  if (!role) return "";
  if (typeof role === "string") return role;
  return role?.roleCode || role?.code || role?.roleName || "";
};

const formatTime = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return `${pad(value[0])}:${pad(value[1] || 0)}`;
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
};

const getStaffName = (item) => item.fullName || item.accountFullName || item.username || item.accountUsername || "Staff member";

const getShiftName = (item) => item.shiftName || item.shift?.shiftName || (item.shiftId ? `Shift #${item.shiftId}` : "Work shift");

const getTimeRange = (item) => {
  const start = formatTime(item.startTime || item.shift?.startTime);
  const end = formatTime(item.endTime || item.shift?.endTime);
  if (!start && !end) return "Time not specified";
  const overnight = Boolean(item.overnight) || (start && end && end < start);
  return `${start || "--:--"} – ${end || "--:--"}${overnight ? " (+1 day)" : ""}`;
};

const statusClass = (status) =>
  ({
    SCHEDULED: "scheduled",
    COMPLETED: "completed",
    ABSENT: "absent",
    OFF: "off",
  })[status] || "scheduled";

const unwrap = (response) => {
  const data = response?.data ?? (Array.isArray(response) ? response : []);
  return Array.isArray(data) ? data : [];
};

export default function AdminSchedulesPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("SCHEDULES");
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    accountId: "",
    shiftId: "",
    workDate: toISO(new Date()),
    notes: "",
  });
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editShiftId, setEditShiftId] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    shiftName: "",
    startTime: "06:00",
    endTime: "14:00",
    description: "",
  });
  const [submittingShift, setSubmittingShift] = useState(false);

  const from = toISO(monthStart(visibleMonth));
  const to = toISO(monthEnd(visibleMonth));

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleRes, shiftRes, accountRes] = await Promise.all([
        apiCall(`/api/admin/schedules?from=${from}&to=${to}`, { silentError: true }),
        apiCall("/api/admin/shifts", { silentError: true }),
        apiCall("/api/admin/schedules/staff", { silentError: true }),
      ]);
      setSchedules(unwrap(scheduleRes));
      setShifts(unwrap(shiftRes));
      setAccounts(unwrap(accountRes));
    } catch (error) {
      addToast(error?.message || "Unable to load schedule data.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, from, to]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const calendarDays = useMemo(() => {
    const first = monthStart(visibleMonth);
    const last = monthEnd(visibleMonth);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const count = Math.ceil((offset + last.getDate()) / 7) * 7;
    return Array.from({ length: count }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((item) => {
        const query = searchQuery.trim().toLowerCase();
        const staffMatch = !query || getStaffName(item).toLowerCase().includes(query) || (item.notes || "").toLowerCase().includes(query);
        const shiftMatch = shiftFilter === "ALL" || String(item.shiftId) === String(shiftFilter);
        return staffMatch && shiftMatch;
      }),
    [schedules, searchQuery, shiftFilter],
  );

  const schedulesByDate = useMemo(() => {
    const grouped = new Map();
    filteredSchedules.forEach((item) => {
      if (!item.workDate) return;
      const list = grouped.get(item.workDate) || [];
      list.push(item);
      grouped.set(item.workDate, list);
    });
    grouped.forEach((items) => items.sort((a, b) => formatTime(a.startTime || a.shift?.startTime).localeCompare(formatTime(b.startTime || b.shift?.startTime))));
    return grouped;
  }, [filteredSchedules]);

  const staffOptions = accounts.map((account) => ({
    value: String(account.accountId || account.id),
    label: `${account.fullName || account.username} (${roleCodeOf(account.role).replace("ROLE_", "") || "STAFF"})`,
  }));
  const shiftOptions = shifts.map((shift) => ({
    value: String(shift.shiftId),
    label: `${shift.shiftName || `Shift #${shift.shiftId}`} (${formatTime(shift.startTime)}–${formatTime(shift.endTime)})`,
  }));
  const shiftFilterOptions = [{ value: "ALL", label: "All shifts" }, ...shifts.map((shift) => ({ value: String(shift.shiftId), label: shift.shiftName || `Shift #${shift.shiftId}` }))];

  const openAssignModal = (date = toISO(new Date())) => {
    setAssignForm({
      accountId: String(accounts[0]?.accountId || accounts[0]?.id || ""),
      shiftId: String(shifts[0]?.shiftId || ""),
      workDate: date,
      notes: "",
    });
    setScheduleModalOpen(true);
  };

  const handleAssignSchedule = async (event) => {
    event.preventDefault();
    if (!assignForm.accountId || !assignForm.shiftId || !assignForm.workDate) {
      addToast("Select a staff member, shift, and work date.", "warning");
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
      addToast("Work shift assigned.", "success");
      setScheduleModalOpen(false);
      await loadAll();
    } catch (error) {
      addToast(error?.message || "Unable to assign this shift.", "error");
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("Cancel this staff assignment?")) return;
    try {
      await apiCall(`/api/admin/schedules/${scheduleId}`, { method: "DELETE" });
      addToast("Schedule assignment removed.", "success");
      setSelectedSchedule(null);
      await loadAll();
    } catch (error) {
      addToast(error?.message || "Unable to remove this assignment.", "error");
    }
  };

  const handleSaveShift = async (event) => {
    event.preventDefault();
    if (!shiftForm.shiftName.trim()) {
      addToast("Enter a shift name.", "warning");
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
      addToast(editShiftId ? "Shift updated." : "Shift created.", "success");
      setShiftModalOpen(false);
      await loadAll();
    } catch (error) {
      addToast(error?.message || "Unable to save shift.", "error");
    } finally {
      setSubmittingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm("Delete this shift definition?")) return;
    try {
      await apiCall(`/api/admin/shifts/${shiftId}`, { method: "DELETE" });
      addToast("Shift deleted.", "success");
      await loadAll();
    } catch (error) {
      addToast(error?.message || "Unable to delete shift.", "error");
    }
  };

  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = toISO(new Date());

  return (
    <div className="ops-page admin-schedules-page">
      <div className="hc-page-title admin-schedule-heading">
        <div>
          <h2>Staff Schedules</h2>
          <p>Manage staff assignments and shift definitions.</p>
        </div>
        {activeTab === "SCHEDULES" ? (
          <button className="hc-btn hc-btn-primary" type="button" onClick={() => openAssignModal()}>
            <i className="bi bi-person-plus" /> Assign shift
          </button>
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
            <i className="bi bi-plus-lg" /> Add shift
          </button>
        )}
      </div>

      <div className="hc-tab-group admin-schedule-tabs">
        <button type="button" className={`hc-tab-btn ${activeTab === "SCHEDULES" ? "active" : ""}`} onClick={() => setActiveTab("SCHEDULES")}>
          <i className="bi bi-calendar3" /> Staff calendar ({schedules.length})
        </button>
        <button type="button" className={`hc-tab-btn ${activeTab === "SHIFTS" ? "active" : ""}`} onClick={() => setActiveTab("SHIFTS")}>
          <i className="bi bi-clock" /> Shift definitions ({shifts.length})
        </button>
      </div>

      {activeTab === "SCHEDULES" ? (
        <>
          <div className="admin-schedule-filters">
            <input className="hc-input" type="search" placeholder="Search staff or notes…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div className="admin-schedule-filter-select">
              <SelectMenu value={shiftFilter} onChange={setShiftFilter} options={shiftFilterOptions} ariaLabel="Filter by shift" icon="bi-funnel" />
            </div>
            <button type="button" className="hc-btn hc-btn-outline" onClick={loadAll} disabled={loading}>
              <i className={`bi bi-arrow-clockwise${loading ? " admin-schedule-spin" : ""}`} /> Refresh
            </button>
          </div>

          <section className="hc-card admin-calendar-card">
            <div className="hc-card-header admin-calendar-toolbar">
              <div>
                <h3 className="hc-card-title">{monthLabel}</h3>
                <span>{filteredSchedules.length} assignments in this month</span>
              </div>
              <div className="admin-calendar-actions">
                <button className="hc-btn hc-btn-outline hc-btn-sm" type="button" onClick={() => setVisibleMonth(monthStart(new Date()))}>
                  Today
                </button>
                <button className="hc-btn hc-btn-outline hc-btn-sm" type="button" aria-label="Previous month" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                  <i className="bi bi-chevron-left" />
                </button>
                <button className="hc-btn hc-btn-outline hc-btn-sm" type="button" aria-label="Next month" onClick={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
            <div className="admin-calendar-legend">
              <span>
                <i className="admin-calendar-dot scheduled" /> Scheduled
              </span>
              <span>
                <i className="admin-calendar-dot completed" /> Completed
              </span>
              <span>
                <i className="admin-calendar-dot absent" /> Absent
              </span>
              <span>
                <i className="admin-calendar-dot off" /> Day off
              </span>
            </div>
            {loading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner" />
              </div>
            ) : (
              <div className="admin-calendar-scroll">
                <div className="admin-calendar-grid">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div className="admin-calendar-weekday" key={day}>
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((date) => {
                    const key = toISO(date);
                    const dayItems = schedulesByDate.get(key) || [];
                    const inMonth = date.getMonth() === visibleMonth.getMonth();
                    return (
                      <div key={key} className={`admin-calendar-day ${!inMonth ? "outside-month" : ""} ${key === today ? "is-today" : ""}`}>
                        <div className="admin-calendar-day-head">
                          <span>{date.getDate()}</span>
                          <button type="button" title={`Assign shift on ${key}`} onClick={() => openAssignModal(key)}>
                            <i className="bi bi-plus" />
                          </button>
                        </div>
                        <div className="admin-calendar-events">
                          {dayItems.slice(0, 3).map((item) => (
                            <button type="button" key={item.scheduleId} className={`admin-calendar-event ${statusClass(item.status)}`} onClick={() => setSelectedSchedule(item)}>
                              <strong>{getStaffName(item)}</strong>
                              <span>
                                {getShiftName(item)} · {getTimeRange(item)}
                              </span>
                            </button>
                          ))}
                          {dayItems.length > 3 && <span className="admin-calendar-more">+{dayItems.length - 3} more</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!loading && filteredSchedules.length === 0 && (
              <div className="admin-calendar-empty">
                <i className="bi bi-calendar2-x" />
                <strong>No assignments found</strong>
                <span>Try another month or adjust the filters.</span>
              </div>
            )}
          </section>
          {selectedSchedule && (
            <section className="hc-card admin-schedule-detail">
              <div className="hc-card-header">
                <div>
                  <h3 className="hc-card-title">Assignment details</h3>
                  <span>{formatDate(selectedSchedule.workDate)}</span>
                </div>
                <button type="button" className="hc-btn hc-btn-ghost hc-btn-sm" onClick={() => setSelectedSchedule(null)} aria-label="Close details">
                  <i className="bi bi-x-lg" />
                </button>
              </div>
              <div className="admin-schedule-detail-grid">
                <div>
                  <small>Staff member</small>
                  <strong>{getStaffName(selectedSchedule)}</strong>
                </div>
                <div>
                  <small>Role</small>
                  <strong>{roleCodeOf(selectedSchedule.role || selectedSchedule.roleCode).replace("ROLE_", "") || "—"}</strong>
                </div>
                <div>
                  <small>Shift</small>
                  <strong>{getShiftName(selectedSchedule)}</strong>
                </div>
                <div>
                  <small>Working hours</small>
                  <strong>{getTimeRange(selectedSchedule)}</strong>
                </div>
                <div>
                  <small>Status</small>
                  <span className={`admin-calendar-status ${statusClass(selectedSchedule.status)}`}>{selectedSchedule.status || "SCHEDULED"}</span>
                </div>
                <div className="admin-schedule-notes">
                  <small>Notes</small>
                  <span>{selectedSchedule.notes || "No notes."}</span>
                </div>
              </div>
              <div className="admin-schedule-detail-actions">
                <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => handleDeleteSchedule(selectedSchedule.scheduleId)}>
                  <i className="bi bi-trash" /> Cancel assignment
                </button>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="hc-card">
          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner" />
            </div>
          ) : shifts.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-clock" />
              <p>No shift definitions found.</p>
            </div>
          ) : (
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Shift</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.shiftId}>
                      <td>
                        <strong>{shift.shiftName || `Shift #${shift.shiftId}`}</strong>
                      </td>
                      <td>{formatTime(shift.startTime)}</td>
                      <td>{formatTime(shift.endTime)}</td>
                      <td>{shift.description || "—"}</td>
                      <td>
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
                            <i className="bi bi-pencil" /> Edit
                          </button>
                          <button type="button" className="hc-btn hc-btn-ghost hc-btn-sm" onClick={() => handleDeleteShift(shift.shiftId)}>
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

      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Assign work shift"
        subtitle="Choose a staff member, shift, and date."
        icon="bi-person-check"
        maxWidth="540px"
        footer={
          <div className="admin-modal-actions">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={submittingSchedule} onClick={handleAssignSchedule}>
              {submittingSchedule ? "Saving…" : "Save assignment"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAssignSchedule}>
          <div className="hc-form-group">
            <label className="hc-label">Staff member *</label>
            <SelectMenu
              value={assignForm.accountId}
              onChange={(value) => setAssignForm((current) => ({ ...current, accountId: value }))}
              options={staffOptions}
              ariaLabel="Choose staff member"
              icon="bi-person"
            />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Shift *</label>
            <SelectMenu value={assignForm.shiftId} onChange={(value) => setAssignForm((current) => ({ ...current, shiftId: value }))} options={shiftOptions} ariaLabel="Choose shift" icon="bi-clock" />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Work date *</label>
            <input className="hc-input" type="date" value={assignForm.workDate} onChange={(e) => setAssignForm((current) => ({ ...current, workDate: e.target.value }))} required />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Notes</label>
            <input className="hc-input" value={assignForm.notes} onChange={(e) => setAssignForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Optional assignment notes" />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title={editShiftId ? "Edit shift" : "Create shift"}
        subtitle="Define the shift's working hours."
        icon="bi-clock-history"
        maxWidth="540px"
        footer={
          <div className="admin-modal-actions">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setShiftModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={submittingShift} onClick={handleSaveShift}>
              {submittingShift ? "Saving…" : "Save shift"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveShift}>
          <div className="hc-form-group">
            <label className="hc-label">Shift name *</label>
            <input className="hc-input" value={shiftForm.shiftName} onChange={(e) => setShiftForm((current) => ({ ...current, shiftName: e.target.value }))} required />
          </div>
          <div className="admin-shift-time-fields">
            <div className="hc-form-group">
              <label className="hc-label">Start time</label>
              <input className="hc-input" type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm((current) => ({ ...current, startTime: e.target.value }))} required />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">End time</label>
              <input className="hc-input" type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm((current) => ({ ...current, endTime: e.target.value }))} required />
            </div>
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Description</label>
            <textarea className="hc-textarea" rows="3" value={shiftForm.description} onChange={(e) => setShiftForm((current) => ({ ...current, description: e.target.value }))} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
