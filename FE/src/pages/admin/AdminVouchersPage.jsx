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
  const INITIAL_FORM = {
    code: '',              // ✅ Đúng tên field BE: `code` (không phải voucherCode)
    voucherName: '',
    discountType: 'PERCENT',   // ✅ Đúng enum DB: PERCENT hoặc FIXED
    discountValue: 10,
    maxDiscountAmount: 200000,
    minOrderAmount: 500000,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    usageLimit: 100
  };
  const [form, setForm] = useState(INITIAL_FORM);
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

    // Validate
    if (!form.code.trim() || !form.voucherName.trim()) {
      addToast('Vui lòng điền đầy đủ mã voucher và tên chương trình!', 'warning');
      return;
    }
    if (!form.discountValue || parseFloat(form.discountValue) <= 0) {
      addToast('Giá trị giảm phải lớn hơn 0!', 'warning');
      return;
    }
    if ((form.discountType === 'PERCENT' || form.discountType === 'PERCENTAGE') && parseFloat(form.discountValue) > 100) {
      addToast('Phần trăm giảm không thể vượt quá 100%!', 'warning');
      return;
    }

    setSubmitting(true);
    // ✅ Payload đúng theo VoucherCreateRequest DTO của BE
    const payload = {
      code: form.code.trim().toUpperCase(),           // BE field: `code`
      voucherName: form.voucherName.trim(),
      discountType: form.discountType,                 // PERCENTAGE hoặc FIXED_AMOUNT
      discountValue: parseFloat(form.discountValue),
      maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
      minOrderAmount: parseFloat(form.minOrderAmount) || 0,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      usageLimit: parseInt(form.usageLimit) || null
    };

    try {
      const res = await apiCall('/api/admin/vouchers', {
        method: 'POST',
        body: payload
      });

      if (res && res.success) {
        addToast(`Tạo mã ưu đãi ${payload.code} thành công!`, 'success');
        setModalOpen(false);
        setForm(INITIAL_FORM);
        loadVouchers();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi tạo voucher. Kiểm tra lại mã code có bị trùng không!', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ VoucherResponse dùng `isActive` (không phải `active`)
  const isVoucherActive = (v) => v.isActive === true;

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-ticket-perforated-fill"></i> MARKETING &amp; KHUYẾN MÃI
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
              <p>Chưa có mã voucher nào. Nhấn &quot;Tạo Voucher Mới&quot; để bắt đầu.</p>
            </div>
          ) : (
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Mã Voucher</th>
                  <th>Tên chương trình</th>
                  <th>Loại giảm</th>
                  <th>Mức giảm</th>
                  <th>Giảm tối đa</th>
                  <th>Đơn tối thiểu</th>
                  <th>Thời hạn áp dụng</th>
                  <th>Lượt dùng</th>
                  <th>Kích hoạt</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => {
                  const active = isVoucherActive(v);
                  const isPercent = v.discountType === 'PERCENT' || v.discountType === 'PERCENTAGE';
                  return (
                    <tr key={v.voucherId} style={{ opacity: active ? 1 : 0.55 }}>
                      <td>
                        {/* ✅ VoucherResponse trả về `code` */}
                        <span className="hc-badge hc-badge-warning" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
                          {v.code}
                        </span>
                      </td>
                      <td>
                        <strong>{v.voucherName}</strong>
                      </td>
                      <td>
                        <span className={`hc-badge ${isPercent ? 'hc-badge-info' : 'hc-badge-secondary'}`} style={{ fontSize: '11px' }}>
                          {isPercent ? 'Phần trăm' : 'Số tiền cố định'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--hc-secondary-dark)' }}>
                          {isPercent
                            ? `${v.discountValue}%`
                            : formatVND(v.discountValue)}
                        </strong>
                      </td>
                      <td>
                        {isPercent ? (
                          (v.maxDiscountAmount && Number(v.maxDiscountAmount) > 0) ? (
                            <strong style={{ color: 'var(--hc-primary, #0284c7)', fontWeight: 600 }}>
                              {formatVND(v.maxDiscountAmount)}
                            </strong>
                          ) : (
                            <span className="hc-badge" style={{ background: '#f1f5f9', color: '#64748b', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                              Không giới hạn
                            </span>
                          )
                        ) : (
                          <span style={{ color: 'var(--hc-text-muted)', fontSize: '12px' }}>
                            Cố định ({formatVND(v.discountValue)})
                          </span>
                        )}
                      </td>
                      <td>{formatVND(v.minOrderAmount || 0)}</td>
                      <td style={{ fontSize: '13px', color: 'var(--hc-text-secondary)' }}>
                        {v.startDate ? formatDate(v.startDate) : '—'} → {v.endDate ? formatDate(v.endDate) : '—'}
                      </td>
                      <td>{v.usedCount || 0} / {v.usageLimit ?? '∞'}</td>
                      <td>
                        <label className="hc-switch" title={active ? 'Đang bật — nhấn để tắt' : 'Đang tắt — nhấn để bật'}>
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => handleToggleVoucher(v.voucherId)}
                          />
                          <span style={{ color: active ? 'var(--hc-success)' : 'var(--hc-text-muted)', fontSize: 12 }}>
                            {active ? 'Đang bật' : 'Đã tắt'}
                          </span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Voucher Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setForm(INITIAL_FORM); }}
        title="Tạo Mới Mã Voucher Khuyến Mãi"
        maxWidth="560px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => { setModalOpen(false); setForm(INITIAL_FORM); }}>
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
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
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
              <label className="hc-label">Kiểu giảm giá <span style={{ color: 'var(--hc-error)' }}>*</span></label>
              <select
                className="hc-select"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              >
                {/* ✅ Đúng enum DB: PERCENT hoặc FIXED */}
                <option value="PERCENT">Phần trăm (%)</option>
                <option value="FIXED">Số tiền cố định (VNĐ)</option>
              </select>
            </div>
            <div className="hc-form-group">
              <label className="hc-label">
                Giá trị giảm <span style={{ color: 'var(--hc-error)' }}>*</span>
                <span style={{ color: 'var(--hc-text-muted)', fontWeight: 400, marginLeft: 4 }}>
                  {(form.discountType === 'PERCENT' || form.discountType === 'PERCENTAGE') ? '(1 – 100%)' : '(VNĐ)'}
                </span>
              </label>
              <input
                type="number"
                className="hc-input"
                min="1"
                max={(form.discountType === 'PERCENT' || form.discountType === 'PERCENTAGE') ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                required
              />
            </div>
          </div>

          {(form.discountType === 'PERCENT' || form.discountType === 'PERCENTAGE') && (
            <div className="hc-form-group">
              <label className="hc-label">
                Giảm tối đa (VNĐ)
                <span style={{ color: 'var(--hc-text-muted)', fontWeight: 400, marginLeft: 4 }}>(tùy chọn)</span>
              </label>
              <input
                type="number"
                className="hc-input"
                min="0"
                step="10000"
                placeholder="Để trống = không giới hạn mức giảm tối đa"
                value={form.maxDiscountAmount}
                onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
              />
            </div>
          )}

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
                placeholder="Để trống = không giới hạn"
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
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Ngày kết thúc</label>
              <input
                type="date"
                className="hc-input"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
