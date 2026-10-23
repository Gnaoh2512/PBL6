import { useCallback, useEffect, useState } from 'react';
import { apiCall, formatDateTime, formatVND } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import '../../pages/PortalPages.css';

export default function StaffRequestsPage() {
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const response = await apiCall(`/api/staff/service-requests${query}`, { silentError: true });
      setRequests(response?.success ? response.data || [] : []);
    } catch (error) { setRequests([]); addToast(error.message || 'Không thể tải yêu cầu dịch vụ.', 'error'); }
    finally { setLoading(false); }
  }, [addToast, status]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const updateRequest = async (request, action) => {
    setWorkingId(request.serviceRequestId);
    try {
      const response = await apiCall(`/api/staff/service-requests/${request.serviceRequestId}/${action}`, { method: 'POST' });
      if (response?.success) { addToast(action === 'assign' ? 'Đã nhận xử lý yêu cầu.' : 'Đã hoàn tất yêu cầu dịch vụ.', 'success'); await loadRequests(); }
    } catch (error) { addToast(error.message || 'Không thể cập nhật yêu cầu.', 'error'); }
    finally { setWorkingId(null); }
  };

  return <main className="portal-page"><div className="portal-page-title"><div><span className="portal-eyebrow">VẬN HÀNH DỊCH VỤ</span><h1>Yêu cầu dịch vụ</h1><p>Tiếp nhận và cập nhật tiến độ yêu cầu từ khách lưu trú.</p></div></div>
    <section className="portal-panel portal-data-panel"><div className="portal-toolbar"><label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{['PENDING','IN_PROGRESS','COMPLETED','CANCELED'].map((item) => <option key={item}>{item}</option>)}</select></label><button className="portal-action secondary" onClick={loadRequests} disabled={loading}><i className="bi bi-arrow-clockwise"/> Làm mới</button></div>
      {loading ? <div className="portal-empty">Đang tải yêu cầu…</div> : requests.length === 0 ? <div className="portal-empty">Không có yêu cầu dịch vụ phù hợp.</div> : <div className="portal-table-wrap"><table><thead><tr><th>DỊCH VỤ</th><th>KHÁCH</th><th>PHÒNG</th><th>SỐ LƯỢNG</th><th>THÀNH TIỀN</th><th>YÊU CẦU LÚC</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>{requests.map((request) => <tr key={request.serviceRequestId}><td>{request.serviceName || 'Yêu cầu dịch vụ'}{request.note && <><br/><small>{request.note}</small></>}</td><td>{request.customerName || '—'}</td><td>{request.roomNumber || '—'}</td><td>{request.quantity || 1}</td><td>{formatVND(request.feeAmount || 0)}</td><td>{formatDateTime(request.requestedAt)}</td><td>{request.status}</td><td><div className="portal-row-actions">{!['COMPLETED','CANCELED','CANCELLED'].includes(request.status) && <><button className="portal-action secondary" disabled={workingId !== null} onClick={() => updateRequest(request, 'assign')}>{request.assignedToStaff ? 'Nhận lại' : 'Nhận xử lý'}</button><button className="portal-action primary" disabled={workingId !== null} onClick={() => updateRequest(request, 'complete')}>{workingId === request.serviceRequestId ? 'Đang xử lý…' : 'Hoàn tất'}</button></>}</div></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
