import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Navbar() {
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isStaff = hasRole(['RECEPTIONIST', 'CASHIER', 'HOUSEKEEPING', 'MANAGER', 'ADMIN']);
  const isAdmin = hasRole(['ADMIN', 'MANAGER']);

  const handleLogout = () => {
    logout();
    addToast('Đã đăng xuất thành công', 'info');
    navigate('/login');
  };

  const getRoleDisplayName = (r) => {
    if (!r) return '';
    const clean = r.replace('ROLE_', '').toUpperCase();
    if (clean === 'ADMIN') return 'Quản Trị Viên';
    if (clean === 'RECEPTIONIST') return 'Lễ Tân';
    if (clean === 'CASHIER') return 'Thu Ngân';
    if (clean === 'HOUSEKEEPING') return 'Buồng Phòng';
    if (clean === 'MANAGER') return 'Quản Lý';
    return 'Thành Viên';
  };

  return (
    <header className="hc-navbar">
      <div className="hc-container">
        <Link to="/" className="hc-navbar-brand">
          <i className="bi bi-buildings"></i>
          <span>Hotel California</span>
        </Link>

        <button 
          className="hc-nav-toggle" 
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
        </button>

        <nav className={`hc-navbar-links ${mobileOpen ? 'open' : ''}`}>
          <NavLink 
            to="/" 
            end 
            className={({ isActive }) => `hc-nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-house-door"></i>
            <span>Trang chủ</span>
          </NavLink>

          <NavLink 
            to="/booking" 
            className={({ isActive }) => `hc-nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-calendar-check"></i>
            <span>Đặt phòng & QR</span>
          </NavLink>

          <NavLink 
            to="/services" 
            className={({ isActive }) => `hc-nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-cup-hot"></i>
            <span>Dịch vụ & Folio</span>
          </NavLink>

          <NavLink 
            to="/history" 
            className={({ isActive }) => `hc-nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-clock-history"></i>
            <span>Lịch sử & Tra cứu</span>
          </NavLink>

          {isStaff && (
            <NavLink 
              to="/staff/rooms" 
              className={({ isActive }) => `hc-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <i className="bi bi-grid-3x3-gap"></i>
              <span>Lễ tân & Thu ngân</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink 
              to="/admin/accounts" 
              className={({ isActive }) => `hc-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <i className="bi bi-shield-check"></i>
              <span>Quản trị Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="hc-navbar-actions">
          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="hc-user-badge">
                <i className="bi bi-person-circle"></i>
                <span>{user.fullName || user.username}</span>
                <span className="hc-badge hc-badge-primary" style={{ fontSize: '11px' }}>
                  {getRoleDisplayName(user.role)}
                </span>
              </div>
              <button 
                type="button" 
                onClick={handleLogout} 
                className="hc-btn hc-btn-outline hc-btn-sm"
                title="Đăng xuất"
              >
                <i className="bi bi-box-arrow-right"></i>
                <span className="d-none d-md-inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
