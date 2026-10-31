import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall, formatDate, formatVND } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './PortalPages.css';

const resortRoomPhoto = 'https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85';
const stayStates = new Set(['CONFIRMED', 'CHECKED_IN']);

export default function GuestDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [folio, setFolio] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiCall('/api/customer/bookings/history', { silentError: true }),
      apiCall('/api/customer/loyalty/profile', { silentError: true }),
      apiCall('/api/customer/service-requests/my-requests', { silentError: true }),
    ]).then(async ([bookingsResult, loyaltyResult, requestsResult]) => {
      if (!active) return;
      const bookingList = bookingsResult.status === 'fulfilled' && bookingsResult.value?.success ? bookingsResult.value.data || [] : [];
      setBookings(bookingList);
      setLoyalty(loyaltyResult.status === 'fulfilled' && loyaltyResult.value?.success ? loyaltyResult.value.data : null);
      setRequests(requestsResult.status === 'fulfilled' && requestsResult.value?.success ? requestsResult.value.data || [] : []);
      const nextStay = bookingList.filter((booking) => stayStates.has(booking.bookingStatus) && booking.checkOutDate >= today)
        .sort((a, b) => String(a.checkInDate).localeCompare(String(b.checkInDate)))[0];
      if (nextStay) {
        try {
          const detail = await apiCall(`/api/customer/bookings/history/${encodeURIComponent(nextStay.bookingCode)}`, { silentError: true });
          if (active && detail?.success) setFolio(detail.data);
        } catch { /* booking summary still provides the trip details */ }
      }
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [today]);

  const nextStay = bookings.filter((booking) => stayStates.has(booking.bookingStatus) && booking.checkOutDate >= today)
    .sort((a, b) => String(a.checkInDate).localeCompare(String(b.checkInDate)))[0] || null;
  const balance = folio?.remainingBalance ?? (nextStay ? Math.max(0, Number(nextStay.totalAmount || 0) - Number(nextStay.depositPaid || 0)) : 0);
  const activeRequests = requests.filter((request) => !['COMPLETED', 'CANCELED', 'CANCELLED'].includes(request.status));

  return (
    <main className="portal-page guest-dashboard">
      <div className="portal-page-title"><div><span className="portal-eyebrow">KỲ NGHỈ CỦA BẠN</span><h1>Chào {user?.fullName?.split(' ')[0] || user?.username || 'bạn'}.</h1><p>{nextStay ? 'Chỉ còn vài ngày nữa là đến kỳ nghỉ trên đảo của bạn.' : 'Mọi điều bạn cần cho một kỳ nghỉ trọn vẹn tại Azure Bay.'}</p></div><Link className="portal-action secondary" to="/guest/bookings"><i className="bi bi-clock-history"/> Lịch sử đặt phòng</Link></div>

      {loading ? <div className="portal-panel portal-loading">Đang tải thông tin kỳ nghỉ…</div> : nextStay ? <section className="portal-stay-card">
        <img src={resortRoomPhoto} alt="Suite Sân Hiên Biển tại Azure Bay"/>
        <div className="portal-stay-info"><div className="portal-stay-heading"><span className="portal-eyebrow">KỲ NGHỈ SẮP TỚI</span><span className={`portal-status status-${nextStay.bookingStatus?.toLowerCase()}`}>{nextStay.bookingStatus?.replaceAll('_', ' ')}</span></div>
          <h2>{nextStay.roomTypeName || 'Kỳ nghỉ tại Azure Bay'}</h2><p>Mã đặt phòng <strong>{nextStay.bookingCode}</strong></p>
          <div className="portal-stay-dates"><div><span>NHẬN PHÒNG</span><b>{formatDate(nextStay.checkInDate)}</b><small>Từ 14:00</small></div><i/><div><span>TRẢ PHÒNG</span><b>{formatDate(nextStay.checkOutDate)}</b><small>Trước 12:00</small></div><i/><div><span>KHÁCH</span><b>{nextStay.guestCount || 1} người</b><small>{nextStay.nights || 1} đêm</small></div></div>
          <div className="portal-stay-actions"><button className="portal-action primary" onClick={() => navigate('/guest/bookings')}>Xem đặt phòng</button><Link className="portal-action quiet" to={`/guest/services?bookingCode=${encodeURIComponent(nextStay.bookingCode)}`}>Dịch vụ & hóa đơn</Link></div>
        </div>
      </section> : <section className="portal-panel guest-no-stay"><span className="portal-empty-icon"><i className="bi bi-sun"/></span><div><span className="portal-eyebrow">AZURE BAY ĐANG CHỜ BẠN</span><h2>Bắt đầu lên kế hoạch cho kỳ nghỉ tiếp theo.</h2><p>Chọn ngày lưu trú và khám phá các phòng nghỉ còn trống.</p></div><Link className="portal-action primary" to="/booking">Tìm phòng nghỉ <i className="bi bi-arrow-right"/></Link></section>}

      <section className="portal-summary-grid">
        <article className="portal-panel portal-payment-card"><div className="portal-panel-heading"><div><span className="portal-eyebrow">THANH TOÁN</span><h2>Số dư đặt phòng</h2></div><span className="portal-summary-icon"><i className="bi bi-wallet2"/></span></div>{nextStay ? <><div className="portal-balance"><span>Số tiền còn lại</span><b>{formatVND(balance)}</b><small>{nextStay.isPaidFull || folio?.isFullySettled ? 'Đã thanh toán đầy đủ' : 'Thanh toán khi nhận phòng'}</small></div><div className="portal-payment-line"><span>Đã nhận tiền cọc</span><b>{formatVND(nextStay.depositPaid || 0)}</b></div><div className="portal-payment-line"><span>Tổng kỳ nghỉ</span><b>{formatVND(folio?.totalAmount ?? nextStay.totalAmount)}</b></div><Link className="portal-text-link" to={`/guest/services?bookingCode=${encodeURIComponent(nextStay.bookingCode)}`}>Xem hóa đơn & thanh toán <i className="bi bi-arrow-right"/></Link></> : <p className="portal-muted">Chi tiết thanh toán sẽ xuất hiện sau khi bạn đặt phòng.</p>}</article>
        <article className="portal-panel portal-actions-card"><div className="portal-panel-heading"><div><span className="portal-eyebrow">TRƯỚC KHI BẠN ĐẾN</span><h2>Kỳ nghỉ theo cách của bạn</h2></div></div><Link to={nextStay ? `/guest/services?bookingCode=${encodeURIComponent(nextStay.bookingCode)}` : '/guest/services'}><span><i className="bi bi-stars"/></span><div><b>Khám phá dịch vụ</b><small>Ẩm thực, spa và trải nghiệm đảo</small></div><i className="bi bi-chevron-right"/></Link><Link to="/guest/bookings"><span><i className="bi bi-calendar2-check"/></span><div><b>Quản lý đặt phòng</b><small>{bookings.length} đặt phòng trong tài khoản</small></div><i className="bi bi-chevron-right"/></Link><Link to="/guest/loyalty"><span><i className="bi bi-gem"/></span><div><b>Azure Bay Privilege</b><small>{loyalty ? `${loyalty.currentScore || 0} điểm · ${loyalty.tierName || 'Thành viên'}` : 'Xem quyền lợi hội viên'}</small></div><i className="bi bi-chevron-right"/></Link></article>
      </section>
      <section className="portal-message-strip"><span><i className="bi bi-chat-heart"/></span><div><b>Đội ngũ Azure Bay luôn sẵn sàng hỗ trợ</b><p>{activeRequests.length ? `Bạn đang có ${activeRequests.length} yêu cầu dịch vụ cần xử lý.` : 'Hãy liên hệ với chúng tôi nếu bạn cần hỗ trợ trong kỳ nghỉ.'}</p></div><Link className="portal-action outline" to={nextStay ? `/guest/services?bookingCode=${encodeURIComponent(nextStay.bookingCode)}` : '/guest/services'}>Xem dịch vụ</Link></section>
    </main>
  );
}
