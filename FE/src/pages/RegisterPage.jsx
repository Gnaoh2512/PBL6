import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiCall } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import "./AuthPages.css";

const REGISTER_PHOTO = "https://images.unsplash.com/photo-1588504633950-9dc518941e93?auto=format&fit=crop&w=1800&q=88";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    phone: "",
    email: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password || !formData.fullName.trim()) {
      addToast("Vui lòng điền đầy đủ các thông tin bắt buộc (*)", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall("/api/auth/register", {
        method: "POST",
        body: {
          username: formData.username.trim(),
          password: formData.password,
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
        },
      });

      if (res && res.success) {
        addToast("Đăng ký tài khoản thành công! Vui lòng đăng nhập.", "success");
        navigate("/login");
      } else {
        addToast(res ? res.message : "Đăng ký không thành công", "error");
      }
    } catch (err) {
      addToast(err.message || "Lỗi đăng ký tài khoản", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-visual">
        <img className="auth-visual-img" src={REGISTER_PHOTO} alt="" />
        <div className="auth-visual-shade" />
        <Link to="/" className="auth-brand">
          <span className="auth-brand-mark">
            <img src="/logo.svg" alt="" />
          </span>
          <span>
            <strong>AZURE BAY</strong>
            <small>KHU NGHỈ DƯỠNG</small>
          </span>
        </Link>
        <div className="auth-visual-copy">
          <span className="auth-eyebrow">ĐẶC QUYỀN DÀNH RIÊNG CHO BẠN</span>
          <h2>
            Mỗi lần trở lại,
            <em>một điều đáng nhớ hơn.</em>
          </h2>
          <p>Trở thành khách hàng thân thiết của Azure Bay để tích điểm và nhận ưu đãi độc quyền.</p>
          <ul className="auth-perks">
            <li>
              <i className="bi bi-check-lg"></i> Tích điểm sau mỗi kỳ nghỉ
            </li>
            <li>
              <i className="bi bi-check-lg"></i> Ưu tiên nâng hạng phòng
            </li>
            <li>
              <i className="bi bi-check-lg"></i> Trải nghiệm được cá nhân hóa
            </li>
          </ul>
        </div>
      </aside>

      <div className="auth-panel">
        <Link to="/" className="auth-back">
          <i className="bi bi-arrow-left"></i> Trang chủ
        </Link>

        <div className="auth-card is-wide">
          <Link to="/" className="auth-mobile-brand">
            <span className="auth-brand-mark">
              <img src="/logo.svg" alt="" />
            </span>
            <strong>AZURE BAY</strong>
          </Link>

          <div className="auth-head">
            <h1>Tạo tài khoản</h1>
            <span className="auth-rule" />
            <p>Tích điểm và nhận ưu đãi độc quyền cho mỗi kỳ nghỉ tại Azure Bay</p>
          </div>

          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <div className="auth-field">
              <label htmlFor="reg-username">
                Tên tài khoản (Username) <span className="auth-required">*</span>
              </label>
              <div className="auth-input-wrap">
                <i className="bi bi-person"></i>
                <input
                  id="reg-username"
                  type="text"
                  name="username"
                  className="auth-input"
                  placeholder="ví dụ: nguyenvana"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-password">
                Mật khẩu <span className="auth-required">*</span>
              </label>
              <div className="auth-input-wrap">
                <i className="bi bi-lock"></i>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="auth-input"
                  placeholder="Tối thiểu 6 ký tự"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="auth-eye" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((v) => !v)}>
                  <i key={showPassword ? "hide" : "show"} className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-fullname">
                Họ và tên đầy đủ <span className="auth-required">*</span>
              </label>
              <div className="auth-input-wrap">
                <i className="bi bi-person-vcard"></i>
                <input id="reg-fullname" type="text" name="fullName" className="auth-input" placeholder="Nguyễn Văn A" value={formData.fullName} onChange={handleChange} autoComplete="name" required />
              </div>
            </div>

            <div className="auth-grid-2">
              <div className="auth-field">
                <label htmlFor="reg-phone">Số điện thoại</label>
                <div className="auth-input-wrap">
                  <i className="bi bi-telephone"></i>
                  <input id="reg-phone" type="tel" name="phone" className="auth-input" placeholder="0912345678" value={formData.phone} onChange={handleChange} autoComplete="tel" />
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="reg-email">Email</label>
                <div className="auth-input-wrap">
                  <i className="bi bi-envelope"></i>
                  <input id="reg-email" type="email" name="email" className="auth-input" placeholder="email@example.com" value={formData.email} onChange={handleChange} autoComplete="email" />
                </div>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="auth-spinner"></span>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>Tạo tài khoản ngay</span>
                  <i className="bi bi-arrow-right"></i>
                </>
              )}
            </button>
          </form>

          <div className="auth-foot">
            Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
