import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="hc-footer">
      <div className="hc-container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px', marginBottom: '32px' }}>
          <div>
            <div className="hc-footer-brand">
              <i className="bi bi-buildings" style={{ color: 'var(--hc-secondary)', marginRight: '8px' }}></i>
              Hotel California
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
              Trải nghiệm nghỉ dưỡng đẳng cấp quốc tế với hệ thống quản lý lưu trú & dịch vụ phòng thông minh, hiện đại.
            </p>
          </div>
          <div>
            <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '12px', letterSpacing: '0.05em' }}>TRUY CẬP NHANH</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <Link to="/" style={{ color: 'rgba(255,255,255,0.7)' }}>Trang chủ & Tìm phòng</Link>
              <Link to="/booking" style={{ color: 'rgba(255,255,255,0.7)' }}>Đặt phòng trực tuyến & VietQR</Link>
              <Link to="/services" style={{ color: 'rgba(255,255,255,0.7)' }}>Dịch vụ phòng & Hóa đơn Live Folio</Link>
              <Link to="/history" style={{ color: 'rgba(255,255,255,0.7)' }}>Tra cứu đơn đặt phòng</Link>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '12px', letterSpacing: '0.05em' }}>LIÊN HỆ & ĐỊA CHỈ</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              <div><i className="bi bi-geo-alt" style={{ marginRight: '6px' }}></i> 54 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng</div>
              <div><i className="bi bi-telephone" style={{ marginRight: '6px' }}></i> Hotline: 0236 3842 145</div>
              <div><i className="bi bi-envelope" style={{ marginRight: '6px' }}></i> contact@hotelcalifornia.vn</div>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '12px', letterSpacing: '0.05em' }}>DÀNH CHO NHÂN VIÊN</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <Link to="/staff/shifts" style={{ color: 'rgba(255,255,255,0.7)' }}>Quản lý Ca Thu Ngân</Link>
              <Link to="/staff/rooms" style={{ color: 'rgba(255,255,255,0.7)' }}>Sơ đồ phòng & Quyết toán</Link>
              <Link to="/admin/accounts" style={{ color: 'rgba(255,255,255,0.7)' }}>Hệ thống Quản Trị Admin</Link>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
          <div>© {new Date().getFullYear()} Hotel California. Dự án PBL6 Công Nghệ Phần Mềm.</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Bảo mật dữ liệu</span>
            <span>Điều khoản dịch vụ</span>
            <span>Hỗ trợ kỹ thuật 24/7</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
