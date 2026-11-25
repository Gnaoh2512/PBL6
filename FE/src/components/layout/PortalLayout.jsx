import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { getPrimaryRole } from "../../services/api";
import { roleLabel } from "../../utils/labels";
import "./PortalLayout.css";

const portalLinks = {
  guest: [
    { to: "/guest", label: "Tổng quan", icon: "bi-grid" },
    { to: "/guest/bookings", label: "Lịch sử đặt phòng", short: "Đặt phòng", icon: "bi-calendar-check" },
    { to: "/guest/services", label: "Dịch vụ & hóa đơn", short: "Dịch vụ", icon: "bi-stars" },
    { to: "/guest/loyalty", label: "Đặc quyền hội viên", short: "Hội viên", icon: "bi-gem" },
    { to: "/guest/profile", label: "Hồ sơ", icon: "bi-person-circle" },
  ],
  staff: [
    { to: "/staff/overview", label: "Hôm nay", icon: "bi-grid", roles: ["ADMIN", "MANAGER", "RECEPTIONIST"] },
    { to: "/staff/rooms", label: "Sơ đồ phòng", short: "Phòng", icon: "bi-door-open", roles: ["RECEPTIONIST", "HOUSEKEEPING", "MANAGER", "ADMIN"] },
    { to: "/staff/bookings", label: "Đặt phòng", icon: "bi-calendar-check", roles: ["RECEPTIONIST", "MANAGER", "ADMIN"] },
    { to: "/staff/walkin", label: "Khách vãng lai", short: "Vãng lai", icon: "bi-person-plus", roles: ["RECEPTIONIST", "MANAGER", "ADMIN"] },
    { to: "/staff/shifts", label: "Ca thu ngân", short: "Thu ngân", icon: "bi-cash-coin", roles: ["RECEPTIONIST", "MANAGER", "ADMIN"] },
    { to: "/staff/schedules", label: "Lịch làm việc của tôi", short: "Lịch làm", icon: "bi-calendar-week", roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "SERVICE_STAFF", "MAINTENANCE"] },
    { to: "/staff/requests", label: "Yêu cầu dịch vụ", short: "Yêu cầu", icon: "bi-bell", roles: ["SERVICE_STAFF", "RECEPTIONIST", "MANAGER", "ADMIN"] },
    { to: "/staff/maintenance", label: "Bảo trì", icon: "bi-tools", roles: ["MAINTENANCE", "HOUSEKEEPING", "RECEPTIONIST", "MANAGER", "ADMIN"] },
    { to: "/staff/equipment", label: "Thiết bị & tài sản", short: "Thiết bị", icon: "bi-cpu", roles: ["RECEPTIONIST", "MAINTENANCE"] },
    { to: "/staff/profile", label: "Hồ sơ", icon: "bi-person-circle", roles: ["MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "SERVICE_STAFF", "MAINTENANCE"] },
  ],
  admin: [
    { to: "/admin/overview", label: "Tổng quan", icon: "bi-grid" },
    { to: "/admin/history", label: "Lịch sử hoạt động", short: "Lịch sử", icon: "bi-clock-history", roles: ["ADMIN"] },
    { to: "/admin/accounts", label: "Tài khoản", short: "Tài khoản", icon: "bi-people", roles: ["ADMIN"] },
    { to: "/admin/rooms", label: "Phòng & hạng phòng", short: "Phòng", icon: "bi-door-closed" },
    { to: "/admin/services", label: "Dịch vụ", icon: "bi-cup-hot" },
    { to: "/admin/schedules", label: "Ca & lịch làm việc", short: "Ca & lịch", icon: "bi-calendar-week" },
    { to: "/admin/vouchers", label: "Ưu đãi", icon: "bi-ticket-perforated" },
    { to: "/admin/equipment", label: "Thiết bị & tài sản", short: "Thiết bị", icon: "bi-cpu" },
    { to: "/admin/loyalty", label: "Hội viên & Loyalty", short: "Hội viên", icon: "bi-gem" },
    { to: "/admin/profile", label: "Hồ sơ", icon: "bi-person-circle", roles: ["MANAGER"] },
  ],
};

const portalTitles = { guest: "Kỳ nghỉ của bạn", staff: "Vận hành khách sạn", admin: "Quản trị Azure Bay" };

export default function PortalLayout({ type }) {
  const { user, logout, hasRole } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const links = portalLinks[type].filter((link) => !link.roles || hasRole(link.roles));
  const current = links.find((link) => link.to === location.pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const TAB_SLOTS = 4;
  const tabLinks = links.slice(0, TAB_SLOTS);
  const moreLinks = links.slice(TAB_SLOTS);
  const moreActive = moreLinks.some((link) => link.to === location.pathname);
  const switchTarget =
    type === "admin"
      ? { to: "/staff/overview", label: "Mở cổng nhân viên", icon: "bi-grid-3x3-gap" }
      : type === "staff" && hasRole(["ADMIN", "MANAGER"])
        ? { to: "/admin/overview", label: "Mở cổng quản trị", icon: "bi-shield-check" }
        : null;

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMoreOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const handleLogout = () => {
    logout();
    addToast("Bạn đã đăng xuất.", "info");
    navigate("/login");
  };

  return (
    <div className={`portal-shell portal-${type} ${collapsed ? "portal-collapsed" : ""}`}>
      <aside className="portal-sidebar">
        <NavLink to="/" className="portal-brand">
          <img className="portal-brand-logo" src="/logo.svg" alt="" />
          <span>
            <strong>AZURE BAY</strong>
          </span>
        </NavLink>
        <div className="portal-caption">{portalTitles[type]}</div>
        <nav aria-label="Điều hướng cổng thông tin">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end className={({ isActive }) => `portal-link ${isActive ? "active" : ""}`}>
              <i className={`bi ${link.icon}`} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        {type === "admin" && (
          <div className="portal-switch">
            <span>KHU VỰC NGHIỆP VỤ</span>
            <NavLink to="/staff/overview">
              <i className="bi bi-grid-3x3-gap" />
              Mở cổng nhân viên
            </NavLink>
          </div>
        )}
        {type === "staff" && hasRole(["ADMIN", "MANAGER"]) && (
          <div className="portal-switch">
            <span>QUẢN LÝ</span>
            <NavLink to="/admin/overview">
              <i className="bi bi-shield-check" />
              Mở cổng quản trị
            </NavLink>
          </div>
        )}
        <div className="portal-sidebar-bottom">
          <NavLink to="/" className="portal-link">
            <i className="bi bi-arrow-left" />
            <span>Về trang khách sạn</span>
          </NavLink>
          <button className="portal-link" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right" />
            <span>Đăng xuất</span>
          </button>
          <button className="portal-link portal-collapse-toggle" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Mở rộng trình đơn" : "Thu gọn trình đơn"}>
            <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`} />
            <span>{collapsed ? "Mở rộng trình đơn" : "Thu gọn trình đơn"}</span>
          </button>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-header">
          <div>
            <span className="portal-mobile-brand">
              <img src="/logo.svg" alt="" />
              AZURE BAY
            </span>
            <b>{portalTitles[type]}</b>
            <span className="portal-breadcrumb">/ {current?.label || "Tổng quan"}</span>
          </div>
          <div className="portal-user">
            <span className="portal-avatar">
              {(user?.fullName || user?.username || "AB")
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <span>
              <b>{user?.fullName || user?.username || "Thành viên"}</b>
              <small>{type === "guest" ? "Khách lưu trú" : roleLabel(getPrimaryRole(user), "Nhân viên")}</small>
            </span>
            <button aria-label="Đăng xuất" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </header>
        <Outlet />
      </div>

      {/* Mobile navigation (<= 768px): 4 tabs + "More" sheet. Hidden on desktop via CSS. */}
      <nav className="portal-tabbar" aria-label="Điều hướng nhanh">
        {tabLinks.map((link) => (
          <NavLink key={link.to} to={link.to} end className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}>
            <i className={`bi ${link.icon}`} />
            <span>{link.short || link.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`portal-tab ${moreActive || moreOpen ? "active" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <i className="bi bi-grid-3x3-gap-fill" />
          <span>Thêm</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="portal-sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="portal-sheet" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="portal-sheet-handle" />
            <div className="portal-sheet-user">
              <span className="portal-avatar">
                {(user?.fullName || user?.username || "AB")
                  .split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <span>
                <b>{user?.fullName || user?.username || "Thành viên"}</b>
                <small>{portalTitles[type]}</small>
              </span>
            </div>
            {moreLinks.length > 0 && (
              <div className="portal-sheet-grid">
                {moreLinks.map((link) => (
                  <NavLink key={link.to} to={link.to} end className={({ isActive }) => `portal-sheet-item ${isActive ? "active" : ""}`}>
                    <i className={`bi ${link.icon}`} />
                    <span>{link.short || link.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
            <div className="portal-sheet-list">
              {switchTarget && (
                <NavLink to={switchTarget.to} className="portal-sheet-row">
                  <i className={`bi ${switchTarget.icon}`} />
                  {switchTarget.label}
                </NavLink>
              )}
              <NavLink to="/" className="portal-sheet-row">
                <i className="bi bi-arrow-left" />
                Về trang khách sạn
              </NavLink>
              <button type="button" className="portal-sheet-row danger" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right" />
                Đăng xuất
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
