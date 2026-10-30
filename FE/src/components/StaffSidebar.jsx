import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function StaffSidebar() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['ADMIN', 'MANAGER']);
  const isReceptionist = hasRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']);
  const isServiceStaff = hasRole(['SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN']);
  const isMaintenance = hasRole(['MAINTENANCE', 'HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN']);

  return (
    <aside className="hc-sidebar">
      {isReceptionist && (
        <>
          <div className="hc-sidebar-heading">Lễ Tân & Thu Ngân</div>
          <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
            <NavLink
              to="/staff/shifts"
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-cash-coin"></i>
              <span>Ca thu ngân</span>
            </NavLink>
            <NavLink
              to="/staff/rooms"
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-grid-3x3-gap"></i>
              <span>Sơ đồ phòng & Quyết toán</span>
            </NavLink>
            <NavLink
              to="/staff/bookings"
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-calendar2-check"></i>
              <span>Quản lý đặt phòng</span>
            </NavLink>
            <NavLink
              to="/staff/walkin"
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-person-plus"></i>
              <span>Walk-in (Khách vãng lai)</span>
            </NavLink>
          </nav>
        </>
      )}

      {isAdmin && (
        <>
          <div className="hc-sidebar-heading">Phân Ca & Lịch Làm Việc</div>
          <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
            <NavLink
              to="/admin/schedules"
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-calendar-week"></i>
              <span>Lịch làm việc nhân viên</span>
            </NavLink>
          </nav>
        </>
      )}

      {isServiceStaff && (
        <>
          <div className="hc-sidebar-heading">Dịch Vụ Phòng</div>
          <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
            <NavLink
              to="/staff/requests"
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-bell"></i>
              <span>Yêu cầu dịch vụ</span>
            </NavLink>
          </nav>
        </>
      )}

      {isMaintenance && (
        <>
          <div className="hc-sidebar-heading">Kỹ Thuật & Bảo Trì</div>
          <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
            <NavLink
              to="/staff/maintenance"
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-tools"></i>
              <span>Bảo trì & Sự cố</span>
            </NavLink>
          </nav>
        </>
      )}

      {isAdmin && (
        <>
          <div className="hc-sidebar-heading">Chuyển Sang Quản Trị</div>
          <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
            <NavLink
              to="/admin/overview"
              className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-shield-check"></i>
              <span>Cổng quản trị (Admin/Manager)</span>
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
