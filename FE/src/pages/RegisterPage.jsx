import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password || !formData.fullName.trim()) {
      addToast('Vui lòng điền đầy đủ các thông tin bắt buộc (*)', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall('/api/auth/register', {
        method: 'POST',
        body: {
          username: formData.username.trim(),
          password: formData.password,
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null
        }
      });

      if (res && res.success) {
        addToast('Đăng ký tài khoản thành công! Vui lòng đăng nhập.', 'success');
        navigate('/login');
      } else {
        addToast(res ? res.message : 'Đăng ký không thành công', 'error');
      }
    } catch (err) {
      addToast(err.message || 'Lỗi đăng ký tài khoản', 'error');
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
      <div className="hc-glass-card" style={{ maxWidth: '480px', width: '100%', padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'var(--hc-secondary-light)',
            color: 'var(--hc-primary-dark)',
            fontSize: '28px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <i className="bi bi-person-plus-fill"></i>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--hc-primary-dark)', marginBottom: '4px' }}>
            Đăng Ký Thành Viên
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--hc-text-secondary)', margin: 0 }}>
            Trở thành khách hàng thân thiết để tích điểm & nhận ưu đãi độc quyền
          </p>
        </div>

        <form onSubmit={handleRegisterSubmit}>
          <div className="hc-form-group">
            <label className="hc-label">Tên tài khoản (Username) <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="text"
              name="username"
              className="hc-input"
              placeholder="ví dụ: nguyenvana"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Mật khẩu <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="password"
              name="password"
              className="hc-input"
              placeholder="Tối thiểu 6 ký tự"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Họ và tên đầy đủ <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="text"
              name="fullName"
              className="hc-input"
              placeholder="Nguyễn Văn A"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Số điện thoại</label>
              <input
                type="tel"
                name="phone"
                className="hc-input"
                placeholder="0912345678"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Email</label>
              <input
                type="email"
                name="email"
                className="hc-input"
                placeholder="email@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="hc-btn hc-btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="hc-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderColor: '#fff', borderTopColor: 'transparent' }}></div>
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle"></i>
                <span>Tạo tài khoản ngay</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--hc-text-secondary)' }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={{ fontWeight: 600, color: 'var(--hc-primary)' }}>
            Đăng nhập ngay
          </Link>
          <div style={{ marginTop: '8px' }}>
            <Link to="/" style={{ color: 'var(--hc-text-muted)', fontSize: '12px' }}>
              ← Quay lại Trang Chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
