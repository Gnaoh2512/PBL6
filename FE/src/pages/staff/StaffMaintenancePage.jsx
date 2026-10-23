import { useCallback, useEffect, useState } from 'react';
import { apiCall, formatDateTime } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import '../../pages/PortalPages.css';

export default function StaffMaintenancePage() {
  const { hasRole } = useAuth();
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [technicianIds, setTechnicianIds] = useState({});
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [form, setForm] = useState({ roomId: '', equipmentId: '', title: '', description: '', priority: 'MEDIUM' });
  const canComplete = hasRole(['MAINTENANCE', 'MANAGER', 'ADMIN']);
  const canAssign = hasRole(['MAINTENANCE', 'MANAGER', 'ADMIN']);
  const canConfirm = hasRole(['MANAGER', 'RECEPTIONIST', 'ADMIN']);
  const canReport = hasRole(['HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN']);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (roomFilter) params.set('roomId', roomFilter);
      const query = params.size ? `?${params}` : '';
      const [requestResult, roomResult, equipmentResult] = await Promise.allSettled([
        apiCall(`/api/staff/maintenance/requests${query}`, { silentError: true }),
        canReport ? apiCall('/api/admin/rooms', { silentError: true }) : Promise.resolve(null),
        canReport ? apiCall('/api/staff/maintenance/equipment', { silentError: true }) : Promise.resolve(null),
      ]);
      setRequests(requestResult.status === 'fulfilled' && requestResult.value?.success ? requestResult.value.data || [] : []);
      setRooms(roomResult.status === 'fulfilled' && roomResult.value?.success ? roomResult.value.data || [] : []);
      setEquipment(equipmentResult.status === 'fulfilled' && equipmentResult.value?.success ? equipmentResult.value.data || [] : []);
    } catch (error) { addToast(error.message || 'Không thể tải yêu cầu bảo trì.', 'error'); }
    finally { setLoading(false); }
  }, [addToast, canReport, priority, roomFilter, status]);

  useEffect(() => { loadData(); }, [loadData]);

  const reportIssue = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await apiCall('/api/staff/maintenance/report', { method: 'POST', body: { ...form, roomId: Number(form.roomId), equipmentId: form.equipmentId ? Number(form.equipmentId) : null } });
      if (result?.success) { addToast('Đã gửi báo cáo bảo trì.', 'success'); setForm({ roomId: '', equipmentId: '', title: '', description: '', priority: 'MEDIUM' }); await loadData(); }
    } catch (error) { addToast(error.message || 'Không thể gửi báo cáo.', 'error'); }
    finally { setSubmitting(false); }
  };

  const updateRequest = async (request, action) => {
    setWorkingId(request.requestId);
    try {
      const technicianId = technicianIds[request.requestId];
      const resolutionNote = resolutionNotes[request.requestId]?.trim();
      if (action === 'assign' && !technicianId) throw new Error('Vui lòng nhập mã nhân viên kỹ thuật.');
      if (action === 'complete' && !resolutionNote) throw new Error('Vui lòng nhập ghi chú xử lý.');
      const endpoint = action === 'assign'
        ? `/api/staff/maintenance/requests/${request.requestId}/assign?technicianId=${encodeURIComponent(technicianId)}`
        : `/api/staff/maintenance/requests/${request.requestId}/${action}`;
      const response = await apiCall(endpoint, { method: 'POST', body: action === 'complete' ? { resolutionNote } : undefined });
      if (response?.success) { addToast(action === 'complete' ? 'Đã cập nhật hoàn tất bảo trì.' : action === 'assign' ? 'Đã phân công kỹ thuật viên.' : 'Đã xác nhận nghiệm thu.', 'success'); await loadData(); }
    } catch (error) { addToast(error.message || 'Không thể cập nhật yêu cầu.', 'error'); }
    finally { setWorkingId(null); }
  };

  return <main className="portal-page"><div className="portal-page-title"><div><span className="portal-eyebrow">VẬN HÀNH PHÒNG</span><h1>Bảo trì & sự cố</h1><p>Báo cáo, theo dõi và nghiệm thu các yêu cầu sửa chữa.</p></div></div>
    {canReport && <section className="portal-panel portal-data-panel"><div><span className="portal-eyebrow">BÁO CÁO SỰ CỐ</span><h2>Tạo yêu cầu bảo trì</h2></div><form className="portal-form" onSubmit={reportIssue}><label>Phòng<select required value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value, equipmentId: '' })}><option value="">Chọn phòng</option>{rooms.map((room) => <option value={room.roomId} key={room.roomId}>Phòng {room.roomNumber}{room.floor ? ` · Tầng ${room.floor}` : ''}</option>)}</select></label><label>Thiết bị cụ thể<select value={form.equipmentId} disabled={!form.roomId} onChange={(event) => setForm({ ...form, equipmentId: event.target.value })}><option value="">Sự cố chung trong phòng</option>{equipment.filter((item) => item.status !== 'RETIRED' && String(item.roomId) === String(form.roomId)).map((item) => <option value={item.equipmentId} key={item.equipmentId}>{item.equipmentName}{item.serialNumber ? ` · ${item.serialNumber}` : ''}</option>)}</select>{form.roomId && !equipment.some((item) => item.status !== 'RETIRED' && String(item.roomId) === String(form.roomId)) && <small>Phòng này chưa có thiết bị khả dụng để chọn.</small>}</label><label>Tiêu đề<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Mô tả ngắn sự cố"/></label><label>Mô tả<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Thông tin bổ sung"/></label><label>Mức độ ưu tiên<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{['LOW','MEDIUM','HIGH','URGENT'].map((value) => <option key={value}>{value}</option>)}</select></label><button className="portal-action primary" type="submit" disabled={submitting || !rooms.length}>{submitting ? 'Đang gửi…' : 'Gửi báo cáo'}</button></form></section>}
    <section className="portal-panel portal-data-panel"><div className="portal-toolbar"><label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{['OPEN','IN_PROGRESS','DONE','CONFIRMED'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Ưu tiên<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Mọi mức độ</option>{['LOW','MEDIUM','HIGH','URGENT'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Phòng<select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}><option value="">Tất cả phòng</option>{rooms.map((room) => <option value={room.roomId} key={room.roomId}>{room.roomNumber}</option>)}</select></label><button className="portal-action secondary" onClick={loadData} disabled={loading}><i className="bi bi-arrow-clockwise"/> Làm mới</button></div>{loading ? <div className="portal-empty">Đang tải yêu cầu bảo trì…</div> : requests.length === 0 ? <div className="portal-empty">Không có yêu cầu bảo trì phù hợp.</div> : <div className="portal-table-wrap"><table><thead><tr><th>SỰ CỐ</th><th>PHÒNG</th><th>ƯU TIÊN</th><th>NGƯỜI XỬ LÝ</th><th>BÁO LÚC</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>{requests.map((request) => <tr key={request.requestId}><td><strong>{request.title}</strong><br/><small>{request.description}</small>{request.equipmentName && <><br/><small>Thiết bị: {request.equipmentName}</small></>}</td><td>{request.roomNumber || '—'}</td><td>{request.priority}</td><td>{request.assignedToStaff || 'Chưa phân công'}</td><td>{formatDateTime(request.reportedAt)}</td><td>{request.status}</td><td><div className="portal-row-actions">{canAssign && !['DONE','CONFIRMED'].includes(request.status) && <><input aria-label={`Mã kỹ thuật viên cho yêu cầu ${request.requestId}`} type="number" min="1" placeholder="ID kỹ thuật viên" value={technicianIds[request.requestId] || ''} onChange={(event) => setTechnicianIds({ ...technicianIds, [request.requestId]: event.target.value })}/><button className="portal-action secondary" disabled={workingId !== null} onClick={() => updateRequest(request, 'assign')}>Phân công</button></>}{canComplete && !['DONE','CONFIRMED'].includes(request.status) && <><input aria-label={`Ghi chú sửa chữa cho yêu cầu ${request.requestId}`} placeholder="Ghi chú sửa chữa" value={resolutionNotes[request.requestId] || ''} onChange={(event) => setResolutionNotes({ ...resolutionNotes, [request.requestId]: event.target.value })}/><button className="portal-action primary" disabled={workingId !== null} onClick={() => updateRequest(request, 'complete')}>Hoàn tất</button></>}{canConfirm && request.status === 'DONE' && <button className="portal-action secondary" disabled={workingId !== null} onClick={() => updateRequest(request, 'confirm')}>Nghiệm thu</button>}</div></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
