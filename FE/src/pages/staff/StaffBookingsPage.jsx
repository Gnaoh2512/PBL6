import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall, formatDate, formatVND } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import '../../pages/PortalPages.css';

export default function StaffBookingsPage() {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');

  const loadBookings = useCallback(async () => {
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
      const response = await apiCall(`/api/staff/bookings/${encodeURIComponent(booking.bookingCode)}/${action}`, {
        method: 'POST',
        body: action === 'cancel' ? { reason: 'Hủy theo thao tác của nhân viên.' } : undefined,
      });
      if (response?.success) {
        addToast(action === 'confirm-deposit' ? 'Đã xác nhận tiền cọc.' : 'Đã hủy đặt phòng.', 'success');
        await loadBookings();
      }
    } catch (error) { addToast(error.message || 'Không thể cập nhật đặt phòng.', 'error'); }
    finally { setWorking(''); }
  };

  return <main className="portal-page"><div className="portal-page-title"><div><span className="portal-eyebrow">LỄ TÂN & THU NGÂN</span><h1>Đặt phòng</h1><p>Tìm kiếm và xử lý các đặt phòng theo trạng thái.</p></div><Link className="portal-action primary" to="/staff/walkin"><i className="bi bi-plus-lg"/> Khách vãng lai</Link></div>
    <section className="portal-panel portal-data-panel"><div className="portal-toolbar"><label>Tìm khách hoặc mã đặt phòng<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tên khách, số điện thoại, mã đặt phòng"/></label><label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{['PENDING_DEPOSIT','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELED','EXPIRED'].map((value) => <option key={value}>{value}</option>)}</select></label><button className="portal-action secondary" onClick={loadBookings} disabled={loading}><i className="bi bi-search"/> Tìm kiếm</button></div>
      {loading ? <div className="portal-empty">Đang tải đặt phòng…</div> : bookings.length === 0 ? <div className="portal-empty">Không tìm thấy đặt phòng phù hợp.</div> : <div className="portal-table-wrap"><table><thead><tr><th>MÃ ĐẶT PHÒNG</th><th>KHÁCH</th><th>PHÒNG</th><th>LƯU TRÚ</th><th>THANH TOÁN</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.bookingCode}><td><strong>{booking.bookingCode}</strong></td><td>{booking.customerName}<br/><small>{booking.customerPhone}</small></td><td>{booking.roomType?.typeName || booking.roomNumber || '—'}{booking.roomNumber ? ` · ${booking.roomNumber}` : ''}</td><td>{formatDate(booking.checkInDate)} – {formatDate(booking.checkOutDate)}</td><td>{formatVND(booking.totalAmount || booking.totalRoomCharge)}</td><td>{booking.status}</td><td><div className="portal-row-actions">{booking.status === 'PENDING_DEPOSIT' && <button className="portal-action primary" disabled={!!working} onClick={() => updateBooking(booking, 'confirm-deposit')}>{working === `${booking.bookingCode}-confirm-deposit` ? 'Đang xử lý…' : 'Xác nhận cọc'}</button>}{!['CANCELED','CHECKED_OUT','EXPIRED'].includes(booking.status) && <button className="portal-action secondary" disabled={!!working} onClick={() => updateBooking(booking, 'cancel')}>Hủy</button>}</div></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
