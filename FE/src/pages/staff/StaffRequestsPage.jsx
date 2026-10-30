import { useCallback, useEffect, useState } from 'react';
import { apiCall, formatDateTime, formatVND } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import '../../pages/PortalPages.css';

const STATUS_LABELS = {
  PENDING: 'Chờ xử lý',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Hoàn tất',
  CANCELED: 'Đã hủy',
};

export default function StaffRequestsPage() {
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
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
      if (response?.success) {
        const messages = {
          assign: 'Đã nhận xử lý yêu cầu.',
          complete: 'Đã hoàn tất yêu cầu dịch vụ.',
          cancel: 'Đã hủy yêu cầu dịch vụ.',
        };
        addToast(messages[action] || 'Cập nhật thành công.', 'success');
        await loadRequests();
      }
    } catch (error) { addToast(error.message || 'Không thể cập nhật yêu cầu.', 'error'); }
    finally { setWorkingId(null); }
  };

  const isTerminal = (s) => ['COMPLETED', 'CANCELED', 'CANCELLED'].includes(s);

  return (
    <main className="portal-page">
      <div className="portal-page-title">
        <div>
          <span className="portal-eyebrow">VẬN HÀNH DỊCH VỤ</span>
          <h1>Yêu cầu dịch vụ</h1>
          <p>Tiếp nhận, xử lý và hoàn tất các yêu cầu từ khách lưu trú.</p>
        </div>
      </div>

      <section className="portal-panel portal-data-panel">
        <div className="portal-toolbar">
          <label>Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </label>
          <button className="portal-action secondary" onClick={loadRequests} disabled={loading}>
            <i className="bi bi-arrow-clockwise"/> Làm mới
          </button>
        </div>

        {loading ? (
          <div className="portal-empty">Đang tải yêu cầu…</div>
        ) : requests.length === 0 ? (
          <div className="portal-empty">Không có yêu cầu dịch vụ phù hợp.</div>
        ) : (
          <div className="portal-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DỊCH VỤ</th>
                  <th>KHÁCH</th>
                  <th>PHÒNG</th>
                  <th>SỐ LƯỢNG</th>
                  <th>THÀNH TIỀN</th>
                  <th>YÊU CẦU LÚC</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.serviceRequestId}>
                    <td>
                      {request.serviceName || 'Yêu cầu dịch vụ'}
                      {request.note && <><br/><small>{request.note}</small></>}
                    </td>
                    <td>{request.customerName || '—'}</td>
                    <td>{request.roomNumber || '—'}</td>
                    <td>{request.quantity || 1}</td>
                    <td>{formatVND(request.feeAmount || 0)}</td>
                    <td>{formatDateTime(request.requestedAt)}</td>
                    <td>
                      <span className={`portal-status status-${request.status?.toLowerCase()}`}>
                        {STATUS_LABELS[request.status] || request.status}
                      </span>
                    </td>
                    <td>
                      <div className="portal-row-actions">
                        {!isTerminal(request.status) && (
                          <>
                            {/* Nhận xử lý */}
                            <button
                              className="portal-action secondary"
                              disabled={workingId !== null}
                              onClick={() => updateRequest(request, 'assign')}
                            >
                              {request.assignedToStaff ? 'Nhận lại' : 'Nhận xử lý'}
                            </button>
                            {/* Hoàn tất */}
                            <button
                              className="portal-action primary"
                              disabled={workingId !== null}
                              onClick={() => updateRequest(request, 'complete')}
                            >
                              {workingId === request.serviceRequestId ? 'Đang xử lý…' : 'Hoàn tất'}
                            </button>
                            {/* Hủy yêu cầu — API: POST /api/staff/service-requests/{id}/cancel */}
                            <button
                              className="portal-action warning"
                              disabled={workingId !== null}
                              onClick={() => {
                                if (window.confirm('Xác nhận hủy yêu cầu dịch vụ này?')) {
                                  updateRequest(request, 'cancel');
                                }
                              }}
                              title="Hủy yêu cầu dịch vụ"
                            >
                              Hủy
                            </button>
                          </>
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
    </main>
  );
}
