import React from "react";
import { Link } from "react-router-dom";

const currentYear = new Date().getFullYear();

export default function Footer({ variant }) {
  if (variant === "resort") {
    return (
      <footer className="resort-footer">
        <div className="resort-footer-brand">
          <Link to="/" className="resort-footer-logo" aria-label="Azure Bay - Trang chủ">
            <span className="resort-footer-logo-mark">
              <img src="/logo.svg" alt="" />
            </span>
            <span className="resort-footer-wordmark">
              <strong>AZURE BAY</strong>
              <small>KHU NGHỈ DƯỠNG</small>
            </span>
          </Link>
          <p>Một chốn nghỉ dưỡng ven biển riêng tư, nơi vẻ đẹp của Phú Quốc hòa cùng lòng hiếu khách tinh tế.</p>
        </div>

        <nav className="resort-footer-column" aria-label="Khám phá">
          <b>KHÁM PHÁ</b>
          <a href="/#rooms">Phòng nghỉ &amp; biệt thự</a>
          <a href="/#experiences">Trải nghiệm</a>
          <a href="/#offers">Ưu đãi</a>
          <a href="/#gallery">Thư viện ảnh</a>
        </nav>

        <nav className="resort-footer-column" aria-label="Dịch vụ">
          <b>TRẢI NGHIỆM</b>
          <Link to="/services">Ẩm thực</Link>
          <Link to="/services">Spa &amp; chăm sóc sức khỏe</Link>
          <Link to="/services">Hồ bơi &amp; bãi biển</Link>
          <Link to="/services">Dịch vụ concierge</Link>
        </nav>

        <div className="resort-footer-column">
          <b>LIÊN HỆ</b>
          <a href="https://maps.google.com/?q=Phu+Quoc+Vietnam">Bờ tây Phú Quốc, Việt Nam</a>
          <a href="tel:+842973888888">+84 297 388 8888</a>
          <a href="mailto:hello@azurebay.vn">hello@azurebay.vn</a>
        </div>

        <div className="resort-footer-bottom">
          <span>© {currentYear} Azure Bay Resort. Bảo lưu mọi quyền.</span>
          <span>
            Quyền riêng tư <i aria-hidden="true">·</i> Điều khoản sử dụng
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="hc-footer">
      <div className="hc-container">
        <div className="hc-footer-grid">
          <div className="hc-footer-intro">
            <Link to="/" className="hc-footer-brand">
              <span className="hc-footer-brand-mark">
                <img className="hc-brand-logo" src="/logo.svg" alt="" />
              </span>
              <span>Azure Bay</span>
            </Link>
            <p>Trải nghiệm nghỉ dưỡng đẳng cấp quốc tế với hệ thống quản lý lưu trú &amp; dịch vụ phòng thông minh, hiện đại.</p>
          </div>

          <div className="hc-footer-column">
            <h4>TRUY CẬP NHANH</h4>
            <Link to="/">Trang chủ &amp; Tìm phòng</Link>
            <Link to="/booking">Đặt phòng trực tuyến &amp; VietQR</Link>
            <Link to="/services">Dịch vụ phòng &amp; Hóa đơn Live Folio</Link>
            <Link to="/login">Lịch sử đặt phòng trong tài khoản</Link>
          </div>

          <div className="hc-footer-column">
            <h4>LIÊN HỆ &amp; ĐỊA CHỈ</h4>
            <span>54 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng</span>
            <a href="tel:02363842145">Hotline: 0236 3842 145</a>
            <a href="mailto:contact@hotelcalifornia.vn">contact@hotelcalifornia.vn</a>
          </div>

          <div className="hc-footer-column">
            <h4>DÀNH CHO NHÂN VIÊN</h4>
            <Link to="/staff/shifts">Quản lý Ca Thu Ngân</Link>
            <Link to="/staff/rooms">Sơ đồ phòng &amp; Quyết toán</Link>
            <Link to="/admin/accounts">Hệ thống Quản Trị Admin</Link>
          </div>
        </div>

        <div className="hc-footer-bottom">
          <span>© {currentYear} Azure Bay. Dự án PBL6 Công Nghệ Phần Mềm.</span>
          <div>
            <span>Bảo mật dữ liệu</span>
            <span>Điều khoản dịch vụ</span>
            <span>Hỗ trợ kỹ thuật 24/7</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
