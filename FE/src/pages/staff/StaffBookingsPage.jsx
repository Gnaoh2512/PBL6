import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall, formatDate, formatVND } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import '../../pages/PortalPages.css';

const STATUS_LABELS = {
  PENDING_DEPOSIT: 'Chờ cọc',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

export default function StaffBookingsPage() {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  // Cancel-with-refund modal state
  const [refundModal, setRefundModal] = useState(null); // booking object
  const [refundNote, setRefundNote] = useState('');
  const [refundWorking, setRefundWorking] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (keyword.trim()) query.set('keyword', keyword.trim());
      if (status) query.set('status', status);
      const response = await apiCall(`/api/staff/bookings${query.size ? `?${query}` : ''}`, { silentError: true });
      setBookings(response?.success ? response.data || [] : []);
    } catch (error) {
      setBookings([]);
      addToast(error.message || 'Không thể tải danh sách đặt phòng.', 'error');
    } finally { setLoading(false); }
  }, [addToast, keyword, status]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const updateBooking = async (booking, action) => {
    setWorking(`${booking.bookingCode}-${action}`);
    try {
      let body;
      if (action === 'cancel') body = { reason: 'Hủy theo thao tác của nhân viên.' };
      const response = await apiCall(
        action === 'check-in'
          ? `/api/staff/billing/bookings/${encodeURIComponent(booking.bookingCode)}/check-in`
          : `/api/staff/bookings/${encodeURIComponent(booking.bookingCode)}/${action}`,
        { method: 'POST', body }
      );
      if (response?.success) {
        const messages = {
          'confirm-deposit': 'Đã xác nhận tiền cọc.',
          'cancel': 'Đã hủy đặt phòng.',
          'check-in': 'Check-in thành công! Phòng chuyển sang OCCUPIED.',
        };
        addToast(messages[action] || 'Cập nhật thành công.', 'success');
        await loadBookings();
      }
    } catch (error) { addToast(error.message || 'Không thể cập nhật đặt phòng.', 'error'); }
    finally { setWorking(''); }
  };

  const handleCancelWithRefund = async () => {
    if (!refundModal) return;
    setRefundWorking(true);
    try {
      const response = await apiCall(
        `/api/staff/billing/bookings/${encodeURIComponent(refundModal.bookingCode)}/cancel-with-refund`,
        { method: 'POST', body: { note: refundNote || 'Hủy và hoàn tiền cọc.' } }
      );
      if (response?.success) {
        addToast('Đã hủy đặt phòng và tính hoàn cọc theo chính sách.', 'success');
        setRefundModal(null);
        setRefundNote('');
        await loadBookings();
      }
    } catch (error) { addToast(error.message || 'Không thể hủy và hoàn tiền.', 'error'); }
    finally { setRefundWorking(false); }
  };

  return (
    <main className="portal-page">
      <div className="portal-page-title">
        <div>
          <span className="portal-eyebrow">LỄ TÂN & THU NGÂN</span>
          <h1>Đặt phòng</h1>
          <p>Tìm kiếm, xác nhận cọc, check-in và xử lý các đặt phòng theo trạng thái.</p>
        </div>
        <Link className="portal-action primary" to="/staff/walkin">
          <i className="bi bi-plus-lg"/> Khách vãng lai
        </Link>
      </div>

      <section className="portal-panel portal-data-panel">
        <div className="portal-toolbar">
          <label>Tìm khách hoặc mã đặt phòng
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tên khách, số điện thoại, mã đặt phòng"/>
          </label>
          <label>Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {['PENDING_DEPOSIT','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELED','EXPIRED'].map((v) => (
                <option key={v} value={v}>{STATUS_LABELS[v] || v}</option>
              ))}
            </select>
          </label>
          <button className="portal-action secondary" onClick={loadBookings} disabled={loading}>
            <i className="bi bi-search"/> Tìm kiếm
          </button>
        </div>

        {loading ? (
          <div className="portal-empty">Đang tải đặt phòng…</div>
        ) : bookings.length === 0 ? (
          <div className="portal-empty">Không tìm thấy đặt phòng phù hợp.</div>
        ) : (
          <div className="portal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>MÃ ĐẶT PHÒNG</th>
                  <th>KHÁCH</th>
                  <th>PHÒNG</th>
                  <th>LƯU TRÚ</th>
                  <th>THANH TOÁN</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.bookingCode}>
                    <td><strong>{booking.bookingCode}</strong><br/><small>{booking.source || ''}</small></td>
                    <td>{booking.customerName}<br/><small>{booking.customerPhone}</small></td>
                    <td>{booking.roomType?.typeName || booking.roomNumber || '—'}{booking.roomNumber ? ` · ${booking.roomNumber}` : ''}</td>
                    <td>{formatDate(booking.checkInDate)} – {formatDate(booking.checkOutDate)}</td>
                    <td>
                      {formatVND(booking.totalAmount || booking.totalRoomCharge)}
                      {booking.depositPaid > 0 && <><br/><small>Cọc: {formatVND(booking.depositPaid)}</small></>}
                    </td>
                    <td>
                      <span className={`portal-status status-${booking.status?.toLowerCase()}`}>
                        {STATUS_LABELS[booking.status] || booking.status}
                      </span>
                    </td>
                    <td>
                      <div className="portal-row-actions">
                        {/* Xác nhận cọc (PENDING_DEPOSIT) */}
                        {booking.status === 'PENDING_DEPOSIT' && (
                          <button
                            className="portal-action primary"
                            disabled={!!working}
                            onClick={() => updateBooking(booking, 'confirm-deposit')}
                          >
                            {working === `${booking.bookingCode}-confirm-deposit` ? 'Đang xử lý…' : 'Xác nhận cọc'}
                          </button>
                        )}
                        {/* Check-in (chỉ khi CONFIRMED) */}
                        {booking.status === 'CONFIRMED' && (
                          <button
                            className="portal-action primary"
                            disabled={!!working}
                            onClick={() => updateBooking(booking, 'check-in')}
                          >
                            {working === `${booking.bookingCode}-check-in` ? 'Đang xử lý…' : 'Check-in'}
                          </button>
                        )}
                        {/* Xem folio & check-out (CHECKED_IN) */}
                        {booking.status === 'CHECKED_IN' && (
                          <Link
                            className="portal-action secondary"
                            to={`/staff/rooms`}
                            title="Mở sơ đồ phòng để thực hiện quyết toán"
                          >
                            <i className="bi bi-receipt"/> Quyết toán
                          </Link>
                        )}
                        {/* Hủy có hoàn cọc (CONFIRMED) */}
                        {booking.status === 'CONFIRMED' && (
                          <button
                            className="portal-action warning"
                            disabled={!!working}
                            onClick={() => { setRefundModal(booking); setRefundNote(''); }}
                          >
                            Hủy & hoàn cọc
                          </button>
                        )}
                        {/* Hủy đơn giản */}
                        {!['CANCELED','CHECKED_OUT','EXPIRED','CHECKED_IN'].includes(booking.status) && (
                          <button
                            className="portal-action secondary"
                            disabled={!!working}
                            onClick={() => updateBooking(booking, 'cancel')}
                          >
                            {working === `${booking.bookingCode}-cancel` ? 'Đang hủy…' : 'Hủy đơn'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Hủy & Hoàn cọc */}
      {refundModal && (
        <div className="portal-modal-overlay" onClick={() => setRefundModal(null)}>
          <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h2>Hủy đặt phòng & Hoàn cọc</h2>
              <button className="portal-modal-close" onClick={() => setRefundModal(null)}>×</button>
            </div>
            <div className="portal-modal-body">
              <p>Bạn đang hủy đặt phòng <strong>{refundModal.bookingCode}</strong> của khách <strong>{refundModal.customerName}</strong>.</p>
              <p style={{color: 'var(--portal-warning, #d97706)', fontSize: 13}}>
                <i className="bi bi-info-circle"/> Hệ thống sẽ tự động tính số tiền hoàn cọc theo chính sách hủy phòng.
              </p>
              <label className="portal-label" style={{display:'block', marginTop:12}}>
                Ghi chú lý do hủy
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="Nhập lý do hủy (tùy chọn)"
                  rows={3}
                  style={{width:'100%', marginTop:6}}
                />
              </label>
            </div>
            <div className="portal-modal-footer">
              <button className="portal-action secondary" onClick={() => setRefundModal(null)}>Quay lại</button>
              <button
                className="portal-action primary"
                disabled={refundWorking}
                onClick={handleCancelWithRefund}
              >
                {refundWorking ? 'Đang xử lý…' : 'Xác nhận hủy & hoàn cọc'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
