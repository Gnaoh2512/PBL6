import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { apiCall, formatVND, formatDate } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function AdminVouchersPage() {
  const { addToast } = useToast();

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    voucherCode: '',
    voucherName: '',
    discountType: 'PERCENT',
    discountValue: 10,
    minOrderAmount: 500000,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    usageLimit: 100
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/admin/vouchers', { silentError: true });
      if (res && res.success) {
        setVouchers(res.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVoucher = async (voucherId) => {
    try {
      const res = await apiCall(`/api/admin/vouchers/${voucherId}/toggle`, { method: 'PATCH' });
      if (res && res.success) {
        addToast('Đã đổi trạng thái kích hoạt của voucher!', 'success');
        loadVouchers();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi bật/tắt voucher', 'error');
    }
  };

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!form.voucherCode.trim() || !form.voucherName.trim() || form.discountValue <= 0) {
      addToast('Vui lòng điền đầy đủ mã voucher, tên và giá trị giảm!', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      voucherCode: form.voucherCode.trim().toUpperCase(),
      voucherName: form.voucherName.trim(),
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue),
      minOrderAmount: parseFloat(form.minOrderAmount) || 0,
      startDate: form.startDate,
      endDate: form.endDate,
      usageLimit: parseInt(form.usageLimit) || 100
    };

    try {
      const res = await apiCall('/api/admin/vouchers', {
        method: 'POST',
        body: payload
      });

      if (res && res.success) {
        addToast(`Tạo mã ưu đãi ${payload.voucherCode} thành công!`, 'success');
        setModalOpen(false);
        setForm({
          voucherCode: '',
          voucherName: '',
          discountType: 'PERCENT',
          discountValue: 10,
          minOrderAmount: 500000,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          usageLimit: 100
        });
        loadVouchers();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi tạo voucher', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-ticket-perforated-fill"></i> MARKETING & KHUYẾN MÃI
          </div>
          <h2>Quản Lý Mã Khuyến Mãi (Vouchers)</h2>
          <p>Tạo chiến dịch ưu đãi, cấu hình mức giảm giá và quản lý bật/tắt kích hoạt voucher</p>
        </div>

        <button
          type="button"
          className="hc-btn hc-btn-primary"
          onClick={() => setModalOpen(true)}
        >
          <i className="bi bi-plus-lg"></i> Tạo Voucher Mới
        </button>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div className="hc-card-title">
            <i className="bi bi-ticket-detailed text-primary" style={{ marginRight: '8px' }}></i>
            Danh Sách Voucher Khuyến Mãi ({vouchers.length})
          </div>
          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={loadVouchers}>
            <i className="bi bi-arrow-clockwise"></i> Làm mới
          </button>
        </div>

        <div className="hc-card-body flush">
          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : vouchers.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-ticket"></i>
              <p>Chưa có mã voucher nào. Nhấn "Tạo Voucher Mới" để bắt đầu.</p>
            </div>
          ) : (
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Mã Voucher</th>
                  <th>Tên chương trình</th>
                  <th>Mức giảm</th>
                  <th>Đơn tối thiểu</th>
                  <th>Thời hạn áp dụng</th>
                  <th>Lượt dùng</th>
                  <th>Kích hoạt</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => (
                  <tr key={v.voucherId}>
                    <td>
                      <span className="hc-badge hc-badge-warning" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
                        {v.voucherCode}
                      </span>
                    </td>
                    <td>
                      <strong>{v.voucherName}</strong>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--hc-secondary-dark)' }}>
                        {v.discountType === 'PERCENT' ? `${v.discountValue}%` : formatVND(v.discountValue)}
                      </strong>
                    </td>
                    <td>{formatVND(v.minOrderAmount)}</td>
                    <td style={{ fontSize: '13px', color: 'var(--hc-text-secondary)' }}>
                      {formatDate(v.startDate)} → {formatDate(v.endDate)}
                    </td>
                    <td>{v.usedCount || 0} / {v.usageLimit || '∞'}</td>
                    <td>
                      <label className="hc-switch">
                        <input
                          type="checkbox"
                          checked={v.active !== false}
                          onChange={() => handleToggleVoucher(v.voucherId)}
                        />
                        <span>{v.active !== false ? 'Bật' : 'Tắt'}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Voucher Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tạo Mới Mã Voucher Khuyến Mãi"
        maxWidth="520px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={handleCreateVoucher}
              disabled={submitting}
            >
              {submitting ? 'Đang tạo...' : 'Tạo Voucher'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateVoucher}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Mã Code <span style={{ color: 'var(--hc-error)' }}>*</span></label>
              <input
                type="text"
                className="hc-input"
                style={{ textTransform: 'uppercase' }}
                placeholder="VD: SALE20"
                value={form.voucherCode}
                onChange={(e) => setForm({ ...form, voucherCode: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Tên chương trình ưu đãi <span style={{ color: 'var(--hc-error)' }}>*</span></label>
              <input
                type="text"
                className="hc-input"
                placeholder="VD: Chào Mừng Khách Mới..."
                value={form.voucherName}
                onChange={(e) => setForm({ ...form, voucherName: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Kiểu giảm giá</label>
              <select
                className="hc-select"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              >
                <option value="PERCENT">Phần trăm (%)</option>
                <option value="AMOUNT">Số tiền cố định (VNĐ)</option>
              </select>
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Giá trị giảm <span style={{ color: 'var(--hc-error)' }}>*</span></label>
              <input
                type="number"
                className="hc-input"
                min="1"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Đơn tối thiểu (VNĐ)</label>
              <input
                type="number"
                className="hc-input"
                min="0"
                step="50000"
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Giới hạn số lượt dùng</label>
              <input
                type="number"
                className="hc-input"
                min="1"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Ngày bắt đầu</label>
              <input
                type="date"
                className="hc-input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Ngày kết thúc</label>
              <input
                type="date"
                className="hc-input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
