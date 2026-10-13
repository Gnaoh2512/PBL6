import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function StaffSidebar() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['ADMIN', 'MANAGER']);

  return (
    <aside className="hc-sidebar">
      <div className="hc-sidebar-heading">Nghiệp Vụ Lễ Tân & Thu Ngân</div>
      <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
        <NavLink 
          to="/staff/shifts" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-cash-coin"></i>
          <span>Quản lý Ca trực</span>
        </NavLink>
        <NavLink 
          to="/staff/rooms" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-grid-3x3-gap"></i>
          <span>Sơ đồ phòng & Quyết toán</span>
        </NavLink>
        <NavLink 
          to="/staff/walkin" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-person-plus"></i>
          <span>Đặt phòng tại quầy (Walk-in)</span>
        </NavLink>
      </nav>

      {isAdmin && (
        <>
          <div className="hc-sidebar-heading">Chuyển Sang Quản Trị</div>
          <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
            <NavLink 
              to="/admin/accounts" 
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-shield-check"></i>
              <span>Quản trị Hệ thống (Admin)</span>
            </NavLink>
          </nav>
        </>
      )}

      <div className="hc-sidebar-footer">
        <Link to="/" className="hc-btn hc-btn-outline hc-btn-sm" style={{ width: '100%' }}>
          <i className="bi bi-arrow-left"></i>
          <span>Về trang chủ</span>
        </Link>
      </div>
    </aside>
  );
}
