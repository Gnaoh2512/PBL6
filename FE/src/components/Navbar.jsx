import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

export default function Navbar({ variant, hideLinks = false }) {
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 48);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  const isStaff = hasRole(["RECEPTIONIST", "HOUSEKEEPING", "SERVICE_STAFF", "MAINTENANCE", "MANAGER", "ADMIN"]);
  const isAdmin = hasRole(["ADMIN", "MANAGER"]);

  if (variant === "resort") {
    return (
      <header className={`hc-navbar resort-nav ${scrolled ? "scrolled" : ""} ${mobileOpen ? "menu-open" : ""}`}>
        <div className="resort-nav-inner">
          <Link to="/" className="resort-brand" onClick={() => setMobileOpen(false)}>
            <img className="resort-brand-logo" src="/logo.svg" alt="" />
            <span>
              <strong>AZURE BAY</strong>
              <small>KHU NGHỈ DƯỠNG</small>
            </span>
          </Link>
          <nav className={`resort-nav-links ${mobileOpen ? "open" : ""}`}>
            <Link to={{ pathname: "/", hash: "#about" }} onClick={() => setMobileOpen(false)}>
              Về chúng tôi
            </Link>
            <Link to={{ pathname: "/", hash: "#discover" }} onClick={() => setMobileOpen(false)}>
              Khám phá
            </Link>
            <Link to={{ pathname: "/", hash: "#rooms" }} onClick={() => setMobileOpen(false)}>
              Phòng nghỉ
            </Link>
            <Link to={{ pathname: "/", hash: "#experiences" }} onClick={() => setMobileOpen(false)}>
              Trải nghiệm
            </Link>
            <Link to={{ pathname: "/", hash: "#offers" }} onClick={() => setMobileOpen(false)}>
              Ưu đãi
            </Link>
          </nav>
          <div className="resort-nav-actions">
            {isAuthenticated ? (
              <button className="resort-login" onClick={() => (hasRole(["CUSTOMER"]) ? navigate("/guest") : hasRole(["MANAGER", "ADMIN"]) ? navigate("/admin/overview") : navigate("/staff"))}>
                {user?.fullName || user?.username}
              </button>
            ) : (
              <Link className="resort-login" to="/login">
                Đăng nhập
              </Link>
            )}
            <Link className="resort-nav-book" to={{ pathname: "/", hash: "#stay" }} onClick={() => setMobileOpen(false)}>
              Đặt phòng
            </Link>
            <button className="resort-menu-toggle" aria-label="Mở hoặc đóng trình đơn" onClick={() => setMobileOpen(!mobileOpen)}>
              <i className={`bi ${mobileOpen ? "bi-x-lg" : "bi-list"}`} />
            </button>
          </div>
        </div>
      </header>
    );
  }

  const handleLogout = () => {
    logout();
    addToast("Đã đăng xuất thành công", "info");
    navigate("/login");
  };

  const getRoleDisplayName = (r) => {
    if (!r) return "";
    const clean = r.replace("ROLE_", "").toUpperCase();
    if (clean === "ADMIN") return "Quản Trị Viên";
    if (clean === "RECEPTIONIST") return "Lễ Tân";
    if (clean === "HOUSEKEEPING") return "Buồng Phòng";
    if (clean === "MANAGER") return "Quản Lý";
    return "Thành Viên";
  };

  return (
    <header className="hc-navbar">
      <div className="hc-container">
        <Link to="/" className="hc-navbar-brand">
          <img className="hc-brand-logo" src="/logo.svg" alt="" />
          <span>Azure Bay</span>
        </Link>

        {!hideLinks && (
          <button className="hc-nav-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">
            <i className={`bi ${mobileOpen ? "bi-x-lg" : "bi-list"}`}></i>
          </button>
        )}

        {!hideLinks && (
          <nav className={`hc-navbar-links ${mobileOpen ? "open" : ""}`}>
            <NavLink to="/" end className={({ isActive }) => `hc-nav-link ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <i className="bi bi-house-door"></i>
              <span>Trang chủ</span>
            </NavLink>

            <NavLink to="/booking" className={({ isActive }) => `hc-nav-link ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <i className="bi bi-calendar-check"></i>
              <span>Đặt phòng & QR</span>
            </NavLink>

            {isStaff && (
              <NavLink to="/services" className={({ isActive }) => `hc-nav-link ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
                <i className="bi bi-cup-hot"></i>
                <span>Dịch vụ & Folio</span>
              </NavLink>
            )}

            {isStaff && (
              <NavLink to="/staff" className={({ isActive }) => `hc-nav-link ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
                <i className="bi bi-grid-3x3-gap"></i>
                <span>Lễ tân & Thu ngân</span>
              </NavLink>
            )}

            {isAdmin && (
              <NavLink to="/admin/overview" className={({ isActive }) => `hc-nav-link ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
                <i className="bi bi-shield-check"></i>
                <span>Quản trị Admin</span>
              </NavLink>
            )}
          </nav>
        )}

        <div className="hc-navbar-actions">
          {isAuthenticated && user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="hc-user-badge">
                <i className="bi bi-person-circle"></i>
                <span>{user.fullName || user.username}</span>
                <span className="hc-badge hc-badge-primary" style={{ fontSize: "11px" }}>
                  {getRoleDisplayName(user.role)}
                </span>
              </div>
              <button type="button" onClick={handleLogout} className="hc-btn hc-btn-outline hc-btn-sm" title="Đăng xuất">
                <i className="bi bi-box-arrow-right"></i>
                <span className="d-none d-md-inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Link to="/login" className="hc-btn hc-btn-outline hc-btn-sm">
                Đăng nhập
              </Link>
              <Link to="/register" className="hc-btn hc-btn-primary hc-btn-sm">
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
