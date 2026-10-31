import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiCall, getPrimaryRole } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import "./AuthPages.css";

const LOGIN_PHOTO = "https://images.unsplash.com/photo-1735770517146-e95c872226fc?auto=format&fit=crop&w=2200&q=88";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      addToast("Vui lòng nhập tên đăng nhập và mật khẩu", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall("/api/auth/login", {
        method: "POST",
        body: { username: username.trim(), password },
      });

      if (res && res.success) {
        const data = res.data;
        const token = data.accessToken || data.token;
        const user = data.user || {
          username: data.username,
          fullName: data.fullName,
          role: data.role,
        };

        login(token, user);
        addToast("Đăng nhập thành công! Đang chuyển hướng...", "success");

        const role = getPrimaryRole(user);
        if (role === "ROLE_ADMIN" || role === "ROLE_MANAGER") {
          navigate("/admin/overview", { replace: true });
        } else if (["ROLE_RECEPTIONIST", "ROLE_HOUSEKEEPING", "ROLE_SERVICE_STAFF", "ROLE_MAINTENANCE"].includes(role)) {
          navigate("/staff", { replace: true });
        } else if (role === "ROLE_CUSTOMER") {
          navigate("/guest", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      } else {
        addToast(res ? res.message : "Tài khoản hoặc mật khẩu không đúng", "error");
      }
    } catch (err) {
      addToast(err.message || "Đăng nhập không thành công", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-visual">
        <img className="auth-visual-img" src={LOGIN_PHOTO} alt="" />
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
          <span className="auth-eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2>
            Nơi đường chân trời
            <em>khiến bạn sống chậm lại.</em>
          </h2>
          <p>Đăng nhập để quản lý kỳ nghỉ, theo dõi ưu đãi và tận hưởng những đặc quyền dành riêng cho bạn.</p>
        </div>
      </aside>

      <div className="auth-panel">
        <Link to="/" className="auth-back">
          <i className="bi bi-arrow-left"></i> Trang chủ
        </Link>

        <div className="auth-card">
          <Link to="/" className="auth-mobile-brand">
            <span className="auth-brand-mark">
              <img src="/logo.svg" alt="" />
            </span>
            <strong>AZURE BAY</strong>
          </Link>

          <div className="auth-head">
            <h1>Đăng nhập</h1>
            <span className="auth-rule" />
            <p>Truy cập hệ thống quản lý lưu trú Azure Bay</p>
          </div>

          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="auth-field">
              <label htmlFor="login-username">Tên đăng nhập</label>
              <div className="auth-input-wrap">
                <i className="bi bi-person"></i>
                <input
                  id="login-username"
                  type="text"
                  className="auth-input"
                  placeholder="Nhập username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Mật khẩu</label>
              <div className="auth-input-wrap">
                <i className="bi bi-lock"></i>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="auth-eye" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((v) => !v)}>
                  <i key={showPassword ? "hide" : "show"} className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="auth-spinner"></span>
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <i className="bi bi-arrow-right"></i>
                </>
              )}
            </button>
          </form>

          <div className="auth-foot">
            Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
