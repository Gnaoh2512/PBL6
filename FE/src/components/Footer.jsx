import React from 'react';
import { Link } from 'react-router-dom';

const currentYear = new Date().getFullYear();

export default function Footer({ variant }) {
  if (variant === 'resort') {
    return (
      <footer className="resort-footer">
        <div className="resort-footer-brand">
          <div className="resort-footer-logo"><img src="/logo.svg" alt=""/><strong>AZURE BAY<small>KHU NGHỈ DƯỠNG</small></strong></div>
          <p>Một chốn nghỉ dưỡng ven biển riêng tư, nơi vẻ đẹp của Phú Quốc hòa cùng lòng hiếu khách tinh tế.</p>
        </div>
        <div><b>KHÁM PHÁ</b><a href="/#rooms">Phòng nghỉ & biệt thự</a><a href="/#experiences">Trải nghiệm</a><a href="/#offers">Ưu đãi</a><a href="/#gallery">Thư viện ảnh</a></div>
        <div><b>TRẢI NGHIỆM</b><Link to="/services">Ẩm thực</Link><Link to="/services">Spa & chăm sóc sức khỏe</Link><Link to="/services">Hồ bơi & bãi biển</Link><Link to="/services">Dịch vụ concierge</Link></div>
        <div><b>LIÊN HỆ</b><a href="https://maps.google.com/?q=Phu+Quoc+Vietnam">Bờ tây Phú Quốc, Việt Nam</a><a href="tel:+842973888888">+84 297 388 8888</a><a href="mailto:hello@azurebay.vn">hello@azurebay.vn</a></div>
        <div className="resort-footer-bottom"><span>© {currentYear} Azure Bay Resort. Bảo lưu mọi quyền.</span><span>Quyền riêng tư　 ·　 Điều khoản sử dụng</span></div>
      </footer>
    );
  }
  return (
    <footer className="hc-footer">
      <div className="hc-container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px', marginBottom: '32px' }}>
          <div>
            <div className="hc-footer-brand">
              <img className="hc-brand-logo" src="/logo.svg" alt="" />
              Azure Bay
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
              <Link to="/login" style={{ color: 'rgba(255,255,255,0.7)' }}>Lịch sử đặt phòng trong tài khoản</Link>
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
          <div>© {currentYear} Azure Bay. Dự án PBL6 Công Nghệ Phần Mềm.</div>
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
