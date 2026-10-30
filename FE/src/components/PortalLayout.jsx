import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getPrimaryRole } from '../services/api';
import './PortalLayout.css';

const portalLinks = {
  guest: [
    { to: '/guest', label: 'Tổng quan', icon: 'bi-grid' },
    { to: '/guest/bookings', label: 'Lịch sử đặt phòng', icon: 'bi-calendar-check' },
    { to: '/guest/services', label: 'Dịch vụ khách sạn', icon: 'bi-stars' },
    { to: '/guest/loyalty', label: 'Azure Bay Privilege', icon: 'bi-gem' },
    { to: '/guest/profile', label: 'Hồ sơ', icon: 'bi-person-circle' },
  ],
  staff: [
    { to: '/staff/overview', label: 'Hôm nay', icon: 'bi-grid', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
    { to: '/staff/history', label: 'Lịch sử hoạt động', icon: 'bi-clock-history' },
    { to: '/staff/rooms', label: 'Sơ đồ phòng', icon: 'bi-door-open', roles: ['RECEPTIONIST', 'HOUSEKEEPING', 'MANAGER', 'ADMIN'] },
    { to: '/staff/bookings', label: 'Đặt phòng', icon: 'bi-calendar-check', roles: ['RECEPTIONIST', 'MANAGER', 'ADMIN'] },
    { to: '/staff/walkin', label: 'Khách vãng lai', icon: 'bi-person-plus', roles: ['RECEPTIONIST', 'MANAGER', 'ADMIN'] },
    { to: '/staff/shifts', label: 'Ca thu ngân', icon: 'bi-clock-history', roles: ['RECEPTIONIST', 'MANAGER', 'ADMIN'] },
    { to: '/staff/requests', label: 'Yêu cầu dịch vụ', icon: 'bi-bell', roles: ['SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN'] },
    { to: '/staff/maintenance', label: 'Bảo trì', icon: 'bi-tools', roles: ['MAINTENANCE', 'HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN'] },
    { to: '/staff/profile', label: 'Hồ sơ', icon: 'bi-person-circle', roles: ['MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'SERVICE_STAFF', 'MAINTENANCE'] },
  ],
  admin: [
    { to: '/admin/overview', label: 'Tổng quan', icon: 'bi-grid' },
    { to: '/admin/history', label: 'Lịch sử hoạt động', icon: 'bi-clock-history', roles: ['ADMIN'] },
    { to: '/admin/accounts', label: 'Tài khoản & nhật ký', icon: 'bi-people', roles: ['ADMIN'] },
    { to: '/admin/rooms', label: 'Phòng & hạng phòng', icon: 'bi-door-closed' },
    { to: '/admin/services', label: 'Dịch vụ', icon: 'bi-cup-hot' },
    { to: '/admin/schedules', label: 'Ca & lịch làm việc', icon: 'bi-calendar-week' },
    { to: '/admin/vouchers', label: 'Ưu đãi', icon: 'bi-ticket-perforated' },
    { to: '/admin/profile', label: 'Hồ sơ', icon: 'bi-person-circle', roles: ['MANAGER'] },
  ],
};

const portalTitles = { guest: 'Kỳ nghỉ của bạn', staff: 'Vận hành khách sạn', admin: 'Quản trị Azure Bay' };

export default function PortalLayout({ type }) {
  const { user, logout, hasRole } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const links = portalLinks[type].filter((link) => !link.roles || hasRole(link.roles));
  const current = links.find((link) => link.to === location.pathname);

  const handleLogout = () => {
    logout();
    addToast('Bạn đã đăng xuất.', 'info');
    navigate('/login');
  };

  return (
    <div className={`portal-shell portal-${type} ${collapsed ? 'portal-collapsed' : ''}`}>
      <aside className="portal-sidebar">
        <NavLink to="/" className="portal-brand">
          <img className="portal-brand-logo" src="/logo.svg" alt="" />
          <span><strong>AZURE BAY</strong><small>KHU NGHỈ DƯỠNG</small></span>
        </NavLink>
        <div className="portal-caption">{portalTitles[type]}</div>
        <nav aria-label="Điều hướng cổng thông tin">
          {links.map((link) => <NavLink key={link.to} to={link.to} end className={({ isActive }) => `portal-link ${isActive ? 'active' : ''}`}><i className={`bi ${link.icon}`} /><span>{link.label}</span></NavLink>)}
        </nav>
        {type === 'admin' && <div className="portal-switch"><span>KHU VỰC NGHIỆP VỤ</span><NavLink to="/staff/overview"><i className="bi bi-grid-3x3-gap"/>Mở cổng nhân viên</NavLink></div>}
        {type === 'staff' && hasRole(['ADMIN', 'MANAGER']) && <div className="portal-switch"><span>QUẢN LÝ</span><NavLink to="/admin/overview"><i className="bi bi-shield-check"/>Mở cổng quản trị</NavLink></div>}
        <div className="portal-sidebar-bottom">
          <NavLink to="/" className="portal-link"><i className="bi bi-arrow-left"/><span>Về trang khách sạn</span></NavLink>
          <button className="portal-link" onClick={handleLogout}><i className="bi bi-box-arrow-right"/><span>Đăng xuất</span></button>
          <button className="portal-link portal-collapse-toggle" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Mở rộng trình đơn' : 'Thu gọn trình đơn'}><i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}/><span>{collapsed ? 'Mở rộng trình đơn' : 'Thu gọn trình đơn'}</span></button>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-header">
          <div><span className="portal-mobile-brand">AZURE BAY</span><b>{portalTitles[type]}</b><span className="portal-breadcrumb">/ {current?.label || 'Tổng quan'}</span></div>
          <div className="portal-user"><span className="portal-avatar">{(user?.fullName || user?.username || 'AB').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><b>{user?.fullName || user?.username || 'Thành viên'}</b><small>{type === 'guest' ? 'Khách lưu trú' : getPrimaryRole(user).replace(/^ROLE_/, '') || 'Nhân viên'}</small></span><button aria-label="Đăng xuất" onClick={handleLogout}><i className="bi bi-box-arrow-right"/></button></div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
