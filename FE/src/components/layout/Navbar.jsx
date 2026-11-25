import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

const RESORT_NAV_ITEMS = [
  { hash: "#about", label: "Về chúng tôi", icon: "bi-info-circle" },
  { hash: "#discover", label: "Khám phá", icon: "bi-compass" },
  { hash: "#rooms", label: "Phòng nghỉ", icon: "bi-door-open" },
  { hash: "#experiences", label: "Trải nghiệm", icon: "bi-stars" },
  { hash: "#offers", label: "Ưu đãi", icon: "bi-ticket-perforated" },
];

export default function Navbar({ variant, hideLinks = false, compact = false, booking = false }) {
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

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const isStaff = hasRole(["RECEPTIONIST", "HOUSEKEEPING", "SERVICE_STAFF", "MAINTENANCE", "MANAGER", "ADMIN"]);
  const isAdmin = hasRole(["ADMIN", "MANAGER"]);

  const handlePortalNavigation = () => {
    if (hasRole(["CUSTOMER"])) {
      navigate("/guest");
    } else if (hasRole(["MANAGER", "ADMIN"])) {
      navigate("/admin/overview");
    } else {
      navigate("/staff");
    }
  };

  const handleLogout = () => {
    logout();
    addToast("Đã đăng xuất thành công", "info");
    navigate("/login");
  };

  if (variant === "resort") {
    return (
      <>
      <header className={`hc-navbar resort-nav ${booking ? "booking-resort-nav" : ""} ${scrolled ? "scrolled" : ""} ${mobileOpen ? "menu-open" : ""}`}>
        <div className="resort-nav-inner">
          <Link to="/" className="resort-brand" onClick={() => setMobileOpen(false)}>
            <img className="resort-brand-logo" src="/logo.svg" alt="" />
            <span>
              <strong>AZURE BAY</strong>
            </span>
          </Link>
          <nav className={`resort-nav-links ${mobileOpen ? "open" : ""}`}>
            {RESORT_NAV_ITEMS.map((item) => (
              <Link key={item.hash} to={{ pathname: "/", hash: item.hash }} onClick={() => setMobileOpen(false)}>
                <i className={`bi ${item.icon} resort-nav-ico`} aria-hidden="true" />
                <span>{item.label}</span>
                <i className="bi bi-chevron-right resort-nav-chev" aria-hidden="true" />
              </Link>
            ))}
            <div className={`resort-nav-mobile-actions ${isAuthenticated ? "is-auth" : ""}`}>
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    className="resort-login"
                    onClick={() => {
                      handlePortalNavigation();
                      setMobileOpen(false);
                    }}
                  >
                    <i className="bi bi-person-circle" aria-hidden="true" /> {user?.fullName || user?.username}
                  </button>
                  <button
                    type="button"
                    className="resort-logout"
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                  >
                    <i className="bi bi-box-arrow-right" aria-hidden="true" /> Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link className="resort-login" to="/login" onClick={() => setMobileOpen(false)}>
                    <i className="bi bi-person" aria-hidden="true" /> Đăng nhập
                  </Link>
                  <Link className="resort-nav-book" to="/booking" onClick={() => setMobileOpen(false)}>
                    <i className="bi bi-calendar-check" aria-hidden="true" /> Đặt phòng
                  </Link>
                </>
              )}
            </div>
          </nav>
          <div className="resort-nav-actions">
            {isAuthenticated ? (
              <button className="resort-login" onClick={handlePortalNavigation}>
                {user?.fullName || user?.username}
              </button>
            ) : (
              <Link className="resort-login" to="/login">
                Đăng nhập
              </Link>
            )}
            <Link className="resort-nav-book" to="/booking" onClick={() => setMobileOpen(false)}>
              Đặt phòng
            </Link>
            <button className="resort-menu-toggle" aria-label="Mở hoặc đóng trình đơn" onClick={() => setMobileOpen(!mobileOpen)}>
              <i className={`bi ${mobileOpen ? "bi-x-lg" : "bi-list"}`} />
            </button>
          </div>
        </div>
      </header>
      {mobileOpen && <div className="resort-nav-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
      </>
    );
  }

  return (
    <header className={`hc-navbar ${compact ? "hc-navbar-compact" : ""}`}>
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
                <span>Dịch vụ & Hóa đơn</span>
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
            <div className="hc-navbar-user-actions">
              <div className="hc-user-badge" onClick={handlePortalNavigation} style={{ cursor: "pointer" }} title="Chuyển đến trang cá nhân">
                <i className="bi bi-person-circle"></i>
                <span>{user.fullName || user.username}</span>
              </div>
              <button type="button" onClick={handleLogout} className="hc-btn hc-btn-outline hc-btn-sm" title="Đăng xuất">
                <i className="bi bi-box-arrow-right"></i>
                <span className="d-none d-md-inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="hc-navbar-auth-actions">
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
