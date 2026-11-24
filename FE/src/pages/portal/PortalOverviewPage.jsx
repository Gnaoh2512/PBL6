import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiCall, formatDate } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import "./PortalOverview.css";
import Paginated from "../../components/common/TablePagination";

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
  DELIVERING: { label: "Đang giao", badge: "hc-badge-info" },
  DONE: { label: "Đã sửa xong", badge: "hc-badge-primary" },
  COMPLETED: { label: "Hoàn tất", badge: "hc-badge-success" },
  CONFIRMED: { label: "Đã nghiệm thu", badge: "hc-badge-success" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-muted" },
  CANCELLED: { label: "Đã hủy", badge: "hc-badge-muted" },
};

const PRIORITY_META = {
  URGENT: { label: "Khẩn cấp", badge: "hc-badge-error" },
  HIGH: { label: "Cao", badge: "hc-badge-error" },
  MEDIUM: { label: "Trung bình", badge: "hc-badge-warning" },
  NORMAL: { label: "Bình thường", badge: "hc-badge-info" },
  LOW: { label: "Thấp", badge: "hc-badge-muted" },
};

const TASK_TYPE_META = {
  cleaning: { label: "Dọn phòng", badge: "hc-badge-info", icon: "bi-stars", link: "/staff/rooms" },
  maintenance: { label: "Bảo trì", badge: "hc-badge-warning", icon: "bi-tools", link: "/staff/maintenance" },
  service: { label: "Dịch vụ", badge: "hc-badge-primary", icon: "bi-bell", link: "/staff/requests" },
};

const localISODate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function PortalOverviewPage({ type }) {
  const { user, hasRole } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskFilter, setTaskFilter] = useState("MY_TASKS"); // "MY_TASKS" | "ALL"
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
      hasRole(["HOUSEKEEPING", "RECEPTIONIST", "MANAGER", "ADMIN"]) ? apiCall("/api/staff/room-cleaning", { silentError: true }) : Promise.resolve(null),
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

      const serviceTasks = list(2).map((t) => ({
        ...t,
        taskType: "service",
        uniqueKey: `service-${t.serviceRequestId}`,
        title: t.serviceName || t.note || "Yêu cầu dịch vụ phòng",
        assignedStaff: t.assignedToStaff,
        assignedStaffId: t.assignedToId,
        priority: "NORMAL",
      }));

      const maintenanceTasks = list(3).map((t) => ({
        ...t,
        taskType: "maintenance",
        uniqueKey: `maint-${t.requestId}`,
        title: t.title || (t.equipmentName ? `Bảo trì thiết bị: ${t.equipmentName}` : `Bảo trì phòng ${t.roomNumber}`),
        assignedStaff: t.assignedToStaff,
        assignedStaffId: null,
        priority: t.priority || "MEDIUM",
      }));

      const cleaningTasks = list(4).map((t) => ({
        ...t,
        taskType: "cleaning",
        uniqueKey: `clean-${t.cleaningId}`,
        title: t.note ? `Dọn phòng: ${t.note}` : `Dọn phòng ${t.roomNumber}`,
        assignedStaff: t.assignedToName,
        assignedStaffId: t.assignedToId,
        priority: t.priority || "MEDIUM",
      }));

      setTasks([...cleaningTasks, ...maintenanceTasks, ...serviceTasks]);
      setShift(value(5));
      setShiftChecked(type === "staff" && hasRole(["RECEPTIONIST", "MANAGER", "ADMIN"]));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [hasRole, type]);

  const isAssignedToMe = (task) => {
    if (!user) return false;
    const myName = (user.fullName || "").trim().toLowerCase();
    const myUsername = (user.username || "").trim().toLowerCase();
    const myId = user.accountId || user.id;

    if (task.assignedStaffId && myId && task.assignedStaffId === myId) return true;
    if (task.assignedStaff) {
      const s = String(task.assignedStaff).trim().toLowerCase();
      if (s === myName || s === myUsername) return true;
    }
    return false;
  };

  const arrivals = bookings.filter((b) => String(b.checkInDate).slice(0, 10) === today && b.status !== "CANCELED");
  const departures = bookings.filter((b) => String(b.checkOutDate).slice(0, 10) === today && b.status !== "CANCELED");
  const activeTasks = tasks.filter((t) => {
    const st = (t.status || "").toUpperCase();
    return !["COMPLETED", "CONFIRMED", "CANCELED", "CANCELLED", "DONE"].includes(st);
  });

  const myActiveTasks = activeTasks.filter(isAssignedToMe);
  const isFieldStaff = hasRole(["HOUSEKEEPING", "MAINTENANCE", "SERVICE_STAFF"]) && !hasRole(["ADMIN", "MANAGER"]);

  const displayedTasks = (taskFilter === "MY_TASKS" && (myActiveTasks.length > 0 || isFieldStaff))
    ? [...myActiveTasks]
    : [...activeTasks];

  const PRIORITY_ORDER = { URGENT: 1, HIGH: 2, MEDIUM: 3, NORMAL: 3, LOW: 4 };
  displayedTasks.sort((a, b) => {
    const aMe = isAssignedToMe(a) ? 0 : 1;
    const bMe = isAssignedToMe(b) ? 0 : 1;
    if (aMe !== bMe) return aMe - bMe;

    const aPri = PRIORITY_ORDER[a.priority?.toUpperCase()] || 3;
    const bPri = PRIORITY_ORDER[b.priority?.toUpperCase()] || 3;
    if (aPri !== bPri) return aPri - bPri;

    return (b.id || 0) - (a.id || 0);
  });

  const statusCounts = rooms.reduce((counts, room) => {
    const status = room.status || "UNKNOWN";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const isAdmin = type === "admin";
  const tableRows = isAdmin ? bookings.slice(0, 6) : arrivals.slice(0, 6);
  const shiftOpen = shift?.status === "OPEN";

  return (
    <div className="ops-page">
      <div className="hc-page-title u-bar">
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

      <div className="ov-grid">
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-journal-text text-primary u-mr-8"></i>
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
            <Paginated items={tableRows}>
              {(pageRows, pager) => (
                <>
                  <div className="hc-card-body flush u-scroll-x">
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
                        {pageRows.map((b) => {
                          const meta = BOOKING_STATUS[b.status] || { label: b.status, badge: "hc-badge-muted" };
                          return (
                            <tr key={b.bookingCode}>
                              <td>
                                <strong>{b.bookingCode}</strong>
                              </td>
                              <td>{b.customerName}</td>
                              <td>{b.roomType?.typeName || b.roomNumber || "—"}</td>
                              <td className="u-nowrap">
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
                  {pager}
                </>
              )}
            </Paginated>
          )}
        </div>

        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-grid-3x3-gap text-primary u-mr-8"></i>
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

      {type === "staff" && (
        <div className="hc-card ov-full">
          <div className="hc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div className="hc-card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <i className="bi bi-flag-fill text-primary"></i>
              <span>Công việc ưu tiên</span>
              {myActiveTasks.length > 0 && (
                <span className="hc-badge hc-badge-primary" style={{ fontSize: "11px" }}>
                  {myActiveTasks.length} việc được gán cho bạn
                </span>
              )}
            </div>

            {activeTasks.length > 0 && (
              <div className="u-row-6">
                <button
                  type="button"
                  className={`hc-btn hc-btn-sm ${taskFilter === "MY_TASKS" ? "hc-btn-primary" : "hc-btn-outline"}`}
                  onClick={() => setTaskFilter("MY_TASKS")}
                >
                  <i className="bi bi-person-check"></i> Việc của tôi ({myActiveTasks.length})
                </button>
                <button
                  type="button"
                  className={`hc-btn hc-btn-sm ${taskFilter === "ALL" ? "hc-btn-primary" : "hc-btn-outline"}`}
                  onClick={() => setTaskFilter("ALL")}
                >
                  <i className="bi bi-list-task"></i> Tất cả công việc ({activeTasks.length})
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="hc-loading-spinner" style={{ padding: "30px 0" }}>
              <div className="hc-spinner"></div>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="hc-empty-state" style={{ padding: "30px 0" }}>
              <i className="bi bi-check2-circle" style={{ fontSize: "32px", color: "var(--hc-success, #16a34a)" }}></i>
              <p style={{ marginTop: "8px" }}>
                {taskFilter === "MY_TASKS"
                  ? "Bạn hiện không có công việc dọn phòng hoặc bảo trì nào đang chờ xử lý."
                  : "Không có công việc ưu tiên nào cần xử lý lúc này."}
              </p>
            </div>
          ) : (
            <Paginated items={displayedTasks} pageSize={6}>
              {(pageRows, pager) => (
                <>
                  <div className="hc-card-body flush u-scroll-x">
                    <table className="hc-table">
                      <thead>
                        <tr>
                          <th>Yêu cầu / Công việc</th>
                          <th>Phòng</th>
                          <th>Loại công việc</th>
                          <th>Độ ưu tiên</th>
                          <th>Người phụ trách</th>
                          <th>Trạng thái</th>
                          <th className="col-actions">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((task) => {
                          const meta = TASK_STATUS[task.status] || { label: task.status, badge: "hc-badge-muted" };
                          const typeMeta = TASK_TYPE_META[task.taskType] || { label: task.taskType, badge: "hc-badge-info", icon: "bi-tag", link: "#" };
                          const priMeta = PRIORITY_META[task.priority?.toUpperCase()] || { label: task.priority || "Bình thường", badge: "hc-badge-muted" };
                          const assignedToMe = isAssignedToMe(task);

                          return (
                            <tr key={task.uniqueKey} style={assignedToMe ? { background: "rgba(2, 132, 199, 0.04)" } : {}}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{task.title}</div>
                                {task.description && task.description !== task.title && (
                                  <small style={{ color: "var(--hc-text-muted)" }}>{task.description}</small>
                                )}
                              </td>
                              <td>
                                <strong>Phòng {task.roomNumber || "—"}</strong>
                              </td>
                              <td>
                                <span className={`hc-badge ${typeMeta.badge}`}>
                                  <i className={`bi ${typeMeta.icon}`}></i> {typeMeta.label}
                                </span>
                              </td>
                              <td>
                                <span className={`hc-badge ${priMeta.badge}`}>
                                  {priMeta.label}
                                </span>
                              </td>
                              <td>
                                {assignedToMe ? (
                                  <span className="hc-badge hc-badge-primary">
                                    <i className="bi bi-person-check-fill"></i> Bạn
                                  </span>
                                ) : (
                                  <span>{task.assignedStaff || <em style={{ color: "var(--hc-text-muted)" }}>Chưa phân công</em>}</span>
                                )}
                              </td>
                              <td>
                                <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                              </td>
                              <td className="col-actions">
                                <Link to={typeMeta.link} className="hc-btn hc-btn-outline hc-btn-sm" style={{ whiteSpace: "nowrap" }}>
                                  Xem <i className="bi bi-arrow-right"></i>
                                </Link>
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
    </div>
  );
}
