import React from 'react';
import { NavLink, Link } from 'react-router-dom';

export default function AdminSidebar() {
  return (
    <aside className="hc-sidebar">
      <div className="hc-sidebar-heading">Quản Trị Hệ Thống (Admin)</div>
      <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
        <NavLink 
          to="/admin/accounts" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-people"></i>
          <span>Tài khoản & Audit Log</span>
        </NavLink>
        <NavLink 
          to="/admin/rooms" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-door-closed"></i>
          <span>Phòng & Hạng phòng</span>
        </NavLink>
        <NavLink 
          to="/admin/services" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-cup-hot"></i>
          <span>Quản lý Dịch vụ</span>
        </NavLink>
        <NavLink 
          to="/admin/schedules" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-calendar-week"></i>
          <span>Ca & Lịch làm việc</span>
        </NavLink>
        <NavLink 
          to="/admin/vouchers" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-ticket-perforated"></i>
          <span>Quản lý Voucher</span>
        </NavLink>
      </nav>

      <div className="hc-sidebar-heading">Khu Vực Nghiệp Vụ</div>
      <nav style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
        <NavLink 
          to="/staff/rooms" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-grid-3x3-gap"></i>
          <span>Sơ đồ phòng (Lễ tân)</span>
        </NavLink>
        <NavLink 
          to="/staff/shifts" 
          className={({ isActive }) => `hc-sidebar-link ${isActive ? 'active' : ''}`}
        >
          <i className="bi bi-cash-coin"></i>
          <span>Ca thu ngân</span>
        </NavLink>
      </nav>

      <div className="hc-sidebar-footer">
        <Link to="/" className="hc-btn hc-btn-outline hc-btn-sm" style={{ width: '100%' }}>
          <i className="bi bi-arrow-left"></i>
          <span>Về trang chủ</span>
        </Link>
      </div>
    </aside>
  );
}
