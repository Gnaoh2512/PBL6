import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import { apiCall, formatVND, formatDateTime } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function StaffShiftsPage() {
  const { addToast } = useToast();
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);

  // Open Shift Form State
  const [initialFloat, setInitialFloat] = useState(2000000);
  const [openNotes, setOpenNotes] = useState('Bàn giao tiền mặt đầu ca');
  const [opening, setOpening] = useState(false);

  // Close Shift Modal State
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [actualBalance, setActualBalance] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    loadCurrentShift();
  }, []);

  const loadCurrentShift = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/staff/cashier-shifts/me', { silentError: true });
      if (res && res.success && res.data) {
        setCurrentShift(res.data);
      } else {
        setCurrentShift(null);
      }
    } catch {
      setCurrentShift(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setOpening(true);
    try {
      const res = await apiCall('/api/staff/cashier-shifts/open', {
        method: 'POST',
        body: {
          openingCash: parseFloat(initialFloat) || 0,
          scheduleId: null
        }
      });
      if (res && res.success) {
        addToast('Mở ca thu ngân thành công! Bây giờ bạn có thể thực hiện giao dịch.', 'success');
        setCurrentShift(res.data);
      }
    } catch (err) {
      addToast(err.message || 'Lỗi mở ca thu ngân', 'error');
    } finally {
      setOpening(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!currentShift) return;

    setClosing(true);
    try {
      const shiftId = currentShift.cashierShiftId || currentShift.id;
      const res = await apiCall(`/api/staff/cashier-shifts/${shiftId}/close`, {
        method: 'POST',
        body: {
          closingCashActual: parseFloat(actualBalance) || 0,
          handoverNote: closeNotes
        }
      });
      if (res && res.success) {
        addToast('Đã đóng ca và đối soát doanh thu thành công!', 'success');
        setCloseModalOpen(false);
        loadCurrentShift();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi đóng ca', 'error');
    } finally {
      setClosing(false);
    }
  };

  const isShiftOpen = currentShift && currentShift.status === 'OPEN';

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ marginBottom: '24px' }}>
        <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
          <i className="bi bi-cash-stack"></i> NGHIỆP VỤ THU NGÂN
        </div>
        <h2>Quản Lý Ca Làm Việc & Thu Ngân</h2>
        <p>Bắt buộc mở ca trước khi tiếp nhận thanh toán phòng, cọc online hoặc check-in Walk-in</p>
      </div>

      {loading ? (
        <div className="hc-loading-spinner">
          <div className="hc-spinner"></div>
        </div>
      ) : isShiftOpen ? (
        /* Active Shift Dashboard */
        <div>
          <div className="hc-stats-grid">
            <StatCard
              icon="bi-cash-coin"
              label="Tiền Đầu Ca (Float)"
              value={formatVND(currentShift.openingCash || 0)}
              color="var(--hc-primary)"
              bg="var(--hc-primary-subtle)"
            />
            <StatCard
              icon="bi-graph-up-arrow"
              label="Doanh Thu Trong Ca"
              value={formatVND(currentShift.totalRevenue || 0)}
              color="var(--hc-success)"
              bg="var(--hc-success-bg)"
            />
            <StatCard
              icon="bi-wallet2"
              label="Tổng Quỹ Hiện Tại"
              value={formatVND((currentShift.openingCash || 0) + (currentShift.totalRevenue || 0))}
              color="var(--hc-secondary-dark)"
              bg="var(--hc-warning-bg)"
            />
            <StatCard
              icon="bi-clock-history"
              label="Giờ Bắt Đầu Ca"
              value={new Date(currentShift.startTime).toLocaleTimeString('vi-VN')}
              color="var(--hc-info)"
              bg="var(--hc-info-bg)"
            />
          </div>

          <div className="hc-card">
            <div className="hc-card-header">
              <div className="hc-card-title">
                <i className="bi bi-file-earmark-text text-primary" style={{ marginRight: '8px' }}></i>
                Thông Tin Chi Tiết Ca Trực #{currentShift.cashierShiftId || currentShift.id}
              </div>
              <span className="hc-badge hc-badge-success" style={{ padding: '6px 14px', fontSize: '13px' }}>
                <span className="hc-pulse-dot" style={{ background: 'var(--hc-success)', marginRight: '6px' }}></span>
                Đang Mở (Active)
              </span>
            </div>

            <div className="hc-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <div style={{ color: 'var(--hc-text-secondary)', fontSize: '13px' }}>Thu ngân phụ trách:</div>
                  <strong style={{ fontSize: '16px' }}>{currentShift.cashierName || 'Nhân viên lễ tân'}</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--hc-text-secondary)', fontSize: '13px' }}>Thời gian mở ca:</div>
                  <strong style={{ fontSize: '16px' }}>{formatDateTime(currentShift.startTime)}</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--hc-text-secondary)', fontSize: '13px' }}>Ghi chú mở ca:</div>
                  <div>{currentShift.notes || 'Không có ghi chú'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--hc-text-secondary)', fontSize: '13px' }}>Trạng thái hệ thống:</div>
                  <div style={{ color: 'var(--hc-success)', fontWeight: 600 }}>Sẵn sàng tiếp nhận đặt cọc & thanh toán</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--hc-border)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="hc-btn hc-btn-outline"
                  onClick={loadCurrentShift}
                >
                  <i className="bi bi-arrow-clockwise"></i> Cập nhật số dư
                </button>
                <button
                  type="button"
                  className="hc-btn hc-btn-danger"
                  onClick={() => {
                    setActualBalance((currentShift.openingCash || 0) + (currentShift.totalRevenue || 0));
                    setCloseModalOpen(true);
                  }}
                >
                  <i className="bi bi-door-closed"></i> Đóng Ca & Quyết Toán Cuối Ca
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Open Shift Form Card */
        <div className="hc-card" style={{ maxWidth: '600px' }}>
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-box-arrow-in-right text-primary" style={{ marginRight: '8px' }}></i>
              Mở Ca Làm Việc Thu Ngân Mới
            </div>
          </div>
          <div className="hc-card-body">
            <div className="hc-alert hc-alert-info" style={{ marginBottom: '20px' }}>
              <i className="bi bi-info-circle-fill"></i>
              <div>
                Vui lòng kiểm đếm tiền mặt thực tế trong két để nhập chính xác <strong>Tiền đầu ca</strong> trước khi nhận tiền của khách hàng.
              </div>
            </div>

            <form onSubmit={handleOpenShift}>
              <div className="hc-form-group">
                <label className="hc-label">Tiền mặt bàn giao đầu ca (VNĐ) <span style={{ color: 'var(--hc-error)' }}>*</span></label>
                <input
                  type="number"
                  className="hc-input"
                  min="0"
                  step="50000"
                  value={initialFloat}
                  onChange={(e) => setInitialFloat(e.target.value)}
                  required
                />
                <div className="hc-help-text">Số tiền hiện có trong két thu ngân để trả lại khách.</div>
              </div>

              <div className="hc-form-group">
                <label className="hc-label">Ghi chú khi mở ca</label>
                <textarea
                  className="hc-textarea"
                  rows="3"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="Ví dụ: Nhận bàn giao từ ca sáng, két đủ tiền lẻ..."
                ></textarea>
              </div>

              <button
                type="submit"
                className="hc-btn hc-btn-primary hc-btn-lg"
                style={{ width: '100%', marginTop: '8px' }}
                disabled={opening}
              >
                {opening ? 'Đang mở ca...' : 'Xác Nhận Mở Ca Thu Ngân →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Đối Soát Doanh Thu & Đóng Ca Thu Ngân"
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="hc-btn hc-btn-outline hc-btn-sm"
              onClick={() => setCloseModalOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-danger hc-btn-sm"
              onClick={handleCloseShift}
              disabled={closing}
            >
              {closing ? 'Đang đóng ca...' : 'Xác nhận Đóng Ca'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCloseShift}>
          <div style={{ background: 'var(--hc-bg)', padding: '14px', borderRadius: 'var(--hc-radius-md)', marginBottom: '16px', border: '1px solid var(--hc-border)', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--hc-text-secondary)' }}>Tiền đầu ca:</span>
              <strong>{formatVND(currentShift?.openingCash || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--hc-text-secondary)' }}>Doanh thu thu được:</span>
              <strong>{formatVND(currentShift?.totalRevenue || 0)}</strong>
            </div>
            <hr className="hc-divider" style={{ margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Tổng tiền lý thuyết trong két:</span>
              <span style={{ color: 'var(--hc-primary)' }}>
                {formatVND((currentShift?.openingCash || 0) + (currentShift?.totalRevenue || 0))}
              </span>
            </div>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Tiền mặt thực tế kiểm đếm cuối ca (VNĐ) <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="number"
              className="hc-input"
              value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              required
            />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Ghi chú bàn giao ca sau</label>
            <textarea
              className="hc-textarea"
              rows="3"
              placeholder="Ghi chú về chênh lệch tiền (nếu có) hoặc bàn giao..."
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
            ></textarea>
          </div>
        </form>
      </Modal>
    </div>
  );
}
