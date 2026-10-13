import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall, setAuthSession } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      addToast('Vui lòng nhập tên đăng nhập và mật khẩu', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall('/api/auth/login', {
        method: 'POST',
        body: { username: username.trim(), password }
      });

      if (res && res.success) {
        const data = res.data;
        const token = data.accessToken || data.token;
        const user = data.user || {
          username: data.username,
          fullName: data.fullName,
          role: data.role
        };

        login(token, user);
        addToast('Đăng nhập thành công! Đang chuyển hướng...', 'success');

        const role = (user.role || '').toUpperCase();
        setTimeout(() => {
          if (role.includes('ADMIN') || role.includes('MANAGER')) {
            navigate('/admin/accounts');
          } else if (role.includes('RECEPTIONIST') || role.includes('CASHIER') || role.includes('HOUSEKEEPING')) {
            navigate('/staff/rooms');
          } else {
            navigate('/');
          }
        }, 400);
      } else {
        addToast(res ? res.message : 'Tài khoản hoặc mật khẩu không đúng', 'error');
      }
    } catch (err) {
      addToast(err.message || 'Đăng nhập không thành công', 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #091929 0%, #102a45 50%, #1e3a5f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="hc-glass-card" style={{ maxWidth: '440px', width: '100%', padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--hc-primary-subtle)',
            color: 'var(--hc-primary)',
            fontSize: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: 'var(--hc-shadow-sm)'
          }}>
            <i className="bi bi-buildings"></i>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--hc-primary-dark)', marginBottom: '6px' }}>
            Hotel California
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--hc-text-secondary)', margin: 0 }}>
            Hệ thống Quản lý Lưu trú & Khách sạn Cao Cấp
          </p>
        </div>

        <form onSubmit={handleLoginSubmit}>
          <div className="hc-form-group">
            <label className="hc-label">Tên đăng nhập</label>
            <div style={{ position: 'relative' }}>
              <i className="bi bi-person" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--hc-text-muted)' }}></i>
              <input
                type="text"
                className="hc-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Nhập username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="hc-form-group" style={{ marginBottom: '24px' }}>
            <label className="hc-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <i className="bi bi-lock" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--hc-text-muted)' }}></i>
              <input
                type="password"
                className="hc-input"
                style={{ paddingLeft: '38px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="hc-btn hc-btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="hc-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderColor: '#fff', borderTopColor: 'transparent' }}></div>
                <span>Đang xác thực...</span>
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right"></i>
                <span>Đăng nhập hệ thống</span>
              </>
            )}
          </button>
        </form>


        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--hc-text-secondary)' }}>
          Chưa có tài khoản?{' '}
          <Link to="/register" style={{ fontWeight: 600, color: 'var(--hc-primary)' }}>
            Đăng ký thành viên
          </Link>
          <div style={{ marginTop: '12px' }}>
            <Link to="/" style={{ color: 'var(--hc-text-muted)', fontSize: '12px' }}>
              ← Quay lại Trang Chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
