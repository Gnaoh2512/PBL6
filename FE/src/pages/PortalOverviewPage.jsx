import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall, formatDate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './PortalPages.css';

const statusLabels = { AVAILABLE: 'Sẵn sàng', VACANT: 'Sẵn sàng', OCCUPIED: 'Có khách', CLEANING: 'Đang dọn', MAINTENANCE: 'Bảo trì', RESERVED: 'Đã đặt', OUT_OF_SERVICE: 'Ngừng sử dụng' };

export default function PortalOverviewPage({ type }) {
  const { hasRole } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shift, setShift] = useState(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [date] = useState(() => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()));

  useEffect(() => {
    let active = true;
    const requests = [
      apiCall('/api/admin/rooms', { silentError: true }),
      hasRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']) ? apiCall('/api/staff/bookings', { silentError: true }) : Promise.resolve(null),
      hasRole(['SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN']) ? apiCall('/api/staff/service-requests', { silentError: true }) : Promise.resolve(null),
      hasRole(['MAINTENANCE', 'HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN']) ? apiCall('/api/staff/maintenance/requests', { silentError: true }) : Promise.resolve(null),
      type === 'staff' && hasRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']) ? apiCall('/api/staff/cashier-shifts/me', { silentError: true }) : Promise.resolve(null),
    ];
    Promise.allSettled(requests).then((results) => {
      if (!active) return;
      const value = (index) => results[index].status === 'fulfilled' && results[index].value?.success ? results[index].value.data : [];
      const list = (index) => {
        const data = value(index);
        return Array.isArray(data) ? data : [];
      };
      setRooms(list(0));
      setBookings(list(1));
      setTasks([...list(2).map((task) => ({ ...task, taskType: 'service' })), ...list(3).map((task) => ({ ...task, taskType: 'maintenance' }))]);
      setShift(value(4));
      setShiftChecked(type === 'staff' && hasRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']));
      setLoading(false);
    });
    return () => { active = false; };
  }, [hasRole, type]);

  const arrivals = bookings.filter((booking) => String(booking.checkInDate).slice(0, 10) === today && booking.status !== 'CANCELED');
  const departures = bookings.filter((booking) => String(booking.checkOutDate).slice(0, 10) === today && booking.status !== 'CANCELED');
  const activeTasks = tasks.filter((task) => !['COMPLETED', 'CANCELED', 'CANCELLED'].includes(task.status));
  const statusCounts = rooms.reduce((counts, room) => { const status = room.status || 'UNKNOWN'; counts[status] = (counts[status] || 0) + 1; return counts; }, {});

  return (
    <main className="portal-page">
      <div className="portal-page-title"><div><span className="portal-eyebrow">{type === 'admin' ? 'HIỆU SUẤT KHU NGHỈ DƯỠNG' : date.toLocaleUpperCase('vi-VN')}</span><h1>{type === 'admin' ? 'Tổng quan' : 'Hoạt động hôm nay'}</h1><p>{type === 'admin' ? 'Số liệu được tổng hợp từ tình trạng phòng và đặt phòng hiện tại.' : 'Tình hình hoạt động trên toàn khu nghỉ dưỡng hôm nay.'}</p></div>{type === 'staff' && <div className="portal-overview-actions">{shiftChecked && <Link className={`portal-shift-pill ${shift?.status === 'OPEN' ? 'is-open' : 'is-closed'}`} to="/staff/shifts"><i/><span><small>{shift?.status === 'OPEN' ? 'CA THU NGÂN ĐANG HOẠT ĐỘNG' : 'CA THU NGÂN CHƯA MỞ'}</small><b>{shift?.status === 'OPEN' ? `Bắt đầu lúc ${String(shift.startTime).slice(11, 16)}` : 'Mở ca trước khi nhận thanh toán'}</b></span><span>{shift?.status === 'OPEN' ? 'Chi tiết ca' : 'Mở ca'}</span></Link>}<Link className="portal-action primary" to="/staff/bookings"><i className="bi bi-calendar-check"/> Xem đặt phòng</Link></div>}</div>
      <section className="portal-metrics">
        <article className="portal-metric"><span><i className="bi bi-box-arrow-in-right"/></span><div><p>Khách đến hôm nay</p><b>{loading ? '—' : arrivals.length}</b><small>Đặt phòng có ngày nhận phòng hôm nay</small></div></article>
        <article className="portal-metric"><span><i className="bi bi-box-arrow-right"/></span><div><p>Khách đi hôm nay</p><b>{loading ? '—' : departures.length}</b><small>Đặt phòng có ngày trả phòng hôm nay</small></div></article>
        <article className="portal-metric"><span><i className="bi bi-door-closed"/></span><div><p>Tổng số phòng</p><b>{loading ? '—' : rooms.length}</b><small>Tình trạng từ sơ đồ phòng</small></div></article>
        <article className="portal-metric"><span><i className="bi bi-exclamation-circle"/></span><div><p>Việc cần xử lý</p><b>{loading ? '—' : activeTasks.length}</b><small>Yêu cầu dịch vụ và bảo trì đang mở</small></div></article>
      </section>
      <section className="portal-panel portal-data-panel">
        <div><span className="portal-eyebrow">VẬN HÀNH TRỰC TIẾP</span><h2>{type === 'admin' ? 'Đặt phòng gần đây' : 'Khách đến hôm nay'}</h2></div>
        {loading ? <div className="portal-empty">Đang tải dữ liệu…</div> : bookings.length === 0 ? <div className="portal-empty">Chưa có dữ liệu đặt phòng cho vai trò hiện tại.</div> : <div className="portal-table-wrap"><table><thead><tr><th>MÃ ĐẶT PHÒNG</th><th>KHÁCH</th><th>PHÒNG</th><th>THỜI GIAN LƯU TRÚ</th><th>TRẠNG THÁI</th><th/></tr></thead><tbody>{bookings.slice(0, 6).map((booking) => <tr key={booking.bookingCode}><td><strong>{booking.bookingCode}</strong></td><td>{booking.customerName}</td><td>{booking.roomType?.typeName || booking.roomNumber || '—'}</td><td>{formatDate(booking.checkInDate)} – {formatDate(booking.checkOutDate)}</td><td>{booking.status}</td><td><Link className="portal-text-link" to="/staff/bookings">Chi tiết</Link></td></tr>)}</tbody></table></div>}
      </section>
      <section className="portal-panel portal-data-panel">
        <div><span className="portal-eyebrow">MỨC ĐỘ SẴN SÀNG</span><h2>Tình trạng phòng</h2></div>
        {loading ? <div className="portal-empty">Đang tải trạng thái phòng…</div> : <div className="portal-room-status-grid">{Object.entries(statusCounts).map(([status, count]) => <div key={status}><i className="bi bi-circle-fill" style={{ color: status === 'OCCUPIED' ? '#4a8190' : status === 'CLEANING' ? '#d29b4e' : status === 'MAINTENANCE' ? '#a87a9d' : '#5a9a7c', fontSize: 7 }}/><b>{count}</b><span>{statusLabels[status] || status}</span></div>)}</div>}
      </section>
      {activeTasks.length > 0 && <section className="portal-panel portal-data-panel"><div><span className="portal-eyebrow">CẦN CHÚ Ý</span><h2>Công việc ưu tiên</h2></div><div className="portal-table-wrap"><table><thead><tr><th>YÊU CẦU</th><th>PHÒNG</th><th>TRẠNG THÁI</th><th>LOẠI</th></tr></thead><tbody>{activeTasks.slice(0, 5).map((task) => <tr key={`${task.taskType}-${task.serviceRequestId || task.requestId}`}><td>{task.title || task.serviceName || task.description || 'Yêu cầu cần xử lý'}</td><td>{task.roomNumber || '—'}</td><td>{task.status}</td><td>{task.taskType === 'service' ? 'Dịch vụ' : 'Bảo trì'}</td></tr>)}</tbody></table></div></section>}
    </main>
  );
}
