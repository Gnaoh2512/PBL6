import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiCall, formatDate } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "./PortalOverview.css";

const ROOM_STATUS = {
  AVAILABLE: { label: "Sẵn sàng", color: "var(--hc-success)" },
  VACANT: { label: "Sẵn sàng", color: "var(--hc-success)" },
  OCCUPIED: { label: "Có khách", color: "var(--hc-error)" },
  CLEANING: { label: "Đang dọn", color: "var(--hc-warning)" },
  MAINTENANCE: { label: "Bảo trì", color: "var(--hc-text-muted)" },
  RESERVED: { label: "Đã đặt", color: "var(--hc-info)" },
  OUT_OF_SERVICE: { label: "Ngừng sử dụng", color: "var(--hc-text-secondary)" },
};

const BOOKING_STATUS = {
  PENDING_DEPOSIT: { label: "Chờ đặt cọc", badge: "hc-badge-warning" },
  CONFIRMED: { label: "Đã xác nhận", badge: "hc-badge-success" },
  CHECKED_IN: { label: "Đang lưu trú", badge: "hc-badge-info" },
  CHECKED_OUT: { label: "Đã trả phòng", badge: "hc-badge-muted" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-error" },
  EXPIRED: { label: "Hết hạn", badge: "hc-badge-muted" },
};

const TASK_STATUS = {
  PENDING: { label: "Chờ xử lý", badge: "hc-badge-warning" },
  OPEN: { label: "Chờ xử lý", badge: "hc-badge-warning" },
  IN_PROGRESS: { label: "Đang xử lý", badge: "hc-badge-info" },
  DONE: { label: "Đã sửa xong", badge: "hc-badge-primary" },
  COMPLETED: { label: "Hoàn tất", badge: "hc-badge-success" },
  CONFIRMED: { label: "Đã nghiệm thu", badge: "hc-badge-success" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-muted" },
  CANCELLED: { label: "Đã hủy", badge: "hc-badge-muted" },
};

const localISODate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function PortalOverviewPage({ type }) {
  const { hasRole } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shift, setShift] = useState(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => localISODate());
  const [date] = useState(() => new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()));

  useEffect(() => {
    let active = true;
    const requests = [
      apiCall("/api/admin/rooms", { silentError: true }),
      hasRole(["RECEPTIONIST", "MANAGER", "ADMIN"]) ? apiCall("/api/staff/bookings", { silentError: true }) : Promise.resolve(null),
      hasRole(["SERVICE_STAFF", "RECEPTIONIST", "MANAGER", "ADMIN"]) ? apiCall("/api/staff/service-requests", { silentError: true }) : Promise.resolve(null),
      hasRole(["MAINTENANCE", "HOUSEKEEPING", "RECEPTIONIST", "MANAGER", "ADMIN"]) ? apiCall("/api/staff/maintenance/requests", { silentError: true }) : Promise.resolve(null),
      type === "staff" && hasRole(["RECEPTIONIST", "MANAGER", "ADMIN"]) ? apiCall("/api/staff/cashier-shifts/me", { silentError: true }) : Promise.resolve(null),
    ];
    Promise.allSettled(requests).then((results) => {
      if (!active) return;
      const value = (index) => (results[index].status === "fulfilled" && results[index].value?.success ? results[index].value.data : []);
      const list = (index) => {
        const data = value(index);
        return Array.isArray(data) ? data : [];
      };
      setRooms(list(0));
      setBookings(list(1));
      setTasks([...list(2).map((task) => ({ ...task, taskType: "service" })), ...list(3).map((task) => ({ ...task, taskType: "maintenance" }))]);
      setShift(value(4));
      setShiftChecked(type === "staff" && hasRole(["RECEPTIONIST", "MANAGER", "ADMIN"]));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [hasRole, type]);

  const arrivals = bookings.filter((b) => String(b.checkInDate).slice(0, 10) === today && b.status !== "CANCELED");
  const departures = bookings.filter((b) => String(b.checkOutDate).slice(0, 10) === today && b.status !== "CANCELED");
  const activeTasks = tasks.filter((t) => !["COMPLETED", "CANCELED", "CANCELLED"].includes(t.status));
  const statusCounts = rooms.reduce((counts, room) => {
    const status = room.status || "UNKNOWN";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const isAdmin = type === "admin";
  const tableRows = isAdmin ? bookings.slice(0, 6) : arrivals.slice(0, 6);
  const shiftOpen = shift?.status === "OPEN";

  const metrics = [
    { label: "Khách đến hôm nay", value: arrivals.length, sub: "Có ngày nhận phòng hôm nay" },
    { label: "Khách đi hôm nay", value: departures.length, sub: "Có ngày trả phòng hôm nay" },
    { label: "Tổng số phòng", value: rooms.length, sub: "Theo sơ đồ phòng" },
    { label: "Việc cần xử lý", value: activeTasks.length, sub: "Dịch vụ và bảo trì đang mở" },
  ];

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", textAlign: "left" }}>
        <div>
          <h2>{isAdmin ? "Tổng quan" : "Hoạt động hôm nay"}</h2>
          <p>{isAdmin ? "Số liệu được tổng hợp từ tình trạng phòng và đặt phòng hiện tại." : <span style={{ textTransform: "capitalize" }}>{date}</span>}</p>
        </div>
        {type === "staff" && (
          <Link className="hc-btn hc-btn-primary" to="/staff/bookings">
            <i className="bi bi-calendar-check"></i> Xem đặt phòng
          </Link>
        )}
      </div>

      {type === "staff" && shiftChecked && (
        <div className={`hc-alert ov-notice ${shiftOpen ? "hc-alert-success" : "hc-alert-warning"}`}>
          <i className={`bi ${shiftOpen ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`}></i>
          <div>
            {shiftOpen ? (
              <>
                Ca thu ngân đang hoạt động, bắt đầu lúc <strong>{String(shift.startTime).slice(11, 16)}</strong>.
              </>
            ) : (
              <>Ca thu ngân chưa mở. Hãy mở ca trước khi nhận thanh toán.</>
            )}
          </div>
          <Link className="ov-link" to="/staff/shifts">
            {shiftOpen ? "Chi tiết ca →" : "Mở ca →"}
          </Link>
        </div>
      )}

      <section className="ov-strip">
        {metrics.map((m) => (
          <div key={m.label} className="ov-stat">
            <div className="ov-stat-label">{m.label}</div>
            <div className="ov-stat-value">{loading ? "—" : m.value}</div>
            <div className="ov-stat-sub">{m.sub}</div>
          </div>
        ))}
      </section>

      <div className="ov-grid">
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-journal-text text-primary" style={{ marginRight: "8px" }}></i>
              {isAdmin ? "Đặt phòng gần đây" : "Khách đến hôm nay"}
            </div>
            <Link className="ov-link" to="/staff/bookings">
              Xem tất cả →
            </Link>
          </div>
          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : tableRows.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-calendar-x"></i>
              <p>{bookings.length === 0 ? "Chưa có dữ liệu đặt phòng cho vai trò hiện tại." : "Hôm nay chưa có khách đến."}</p>
            </div>
          ) : (
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Mã đặt phòng</th>
                    <th>Khách</th>
                    <th>Phòng</th>
                    <th>Lưu trú</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((b) => {
                    const meta = BOOKING_STATUS[b.status] || { label: b.status, badge: "hc-badge-muted" };
                    return (
                      <tr key={b.bookingCode}>
                        <td>
                          <strong>{b.bookingCode}</strong>
                        </td>
                        <td>{b.customerName}</td>
                        <td>{b.roomType?.typeName || b.roomNumber || "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatDate(b.checkInDate)} – {formatDate(b.checkOutDate)}
                        </td>
                        <td>
                          <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-grid-3x3-gap text-primary" style={{ marginRight: "8px" }}></i>
              Tình trạng phòng
            </div>
          </div>
          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : rooms.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-door-closed"></i>
              <p>Chưa có dữ liệu phòng.</p>
            </div>
          ) : (
            <div>
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="ov-room-row">
                  <span className="ov-room-dot" style={{ background: ROOM_STATUS[status]?.color || "var(--hc-border)" }}></span>
                  <span className="ov-room-label">{ROOM_STATUS[status]?.label || status}</span>
                  <b>{count}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTasks.length > 0 && (
        <div className="hc-card ov-full">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-flag text-primary" style={{ marginRight: "8px" }}></i>
              Công việc ưu tiên
            </div>
          </div>
          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Yêu cầu</th>
                  <th>Phòng</th>
                  <th>Loại</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {activeTasks.slice(0, 5).map((task) => {
                  const meta = TASK_STATUS[task.status] || { label: task.status, badge: "hc-badge-muted" };
                  return (
                    <tr key={`${task.taskType}-${task.serviceRequestId || task.requestId}`}>
                      <td>{task.title || task.serviceName || task.description || "Yêu cầu cần xử lý"}</td>
                      <td>{task.roomNumber || "—"}</td>
                      <td>{task.taskType === "service" ? "Dịch vụ" : "Bảo trì"}</td>
                      <td>
                        <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
