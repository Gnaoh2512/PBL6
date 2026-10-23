import { useCallback, useEffect, useState } from 'react';
import { apiCall, formatDateTime } from '../../services/api';

export default function AdminActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiCall('/api/admin/audit-logs', { silentError: true });
      if (!response?.success) throw new Error(response?.message || 'Không thể tải nhật ký hoạt động.');
      setLogs(response.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải nhật ký hoạt động.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <main className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <div className="hc-hero-badge"><i className="bi bi-shield-check" /> NHẬT KÝ HỆ THỐNG</div>
          <h2>Nhật ký hoạt động</h2>
          <p>Lịch sử thao tác quản trị và thay đổi dữ liệu trong hệ thống.</p>
        </div>
        <button className="hc-btn hc-btn-outline" type="button" onClick={loadLogs} disabled={loading}>
          <i className="bi bi-arrow-clockwise" /> Làm mới
        </button>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <section className="hc-card">
        <div className="hc-card-header"><strong>Hoạt động gần đây ({logs.length})</strong></div>
        <div className="hc-card-body flush">
          {loading ? <div className="hc-loading-spinner"><div className="hc-spinner" /></div>
            : logs.length === 0 ? <div className="hc-empty-state"><i className="bi bi-journal-x" /><p>Chưa có nhật ký hoạt động.</p></div>
              : <div className="table-responsive"><table className="hc-table">
                <thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Hành động</th><th>Chi tiết</th></tr></thead>
                <tbody>{logs.map((log, index) => <tr key={log.logId || index}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.timestamp || log.createdAt || log.loggedAt)}</td>
                  <td><strong>{log.account?.username || log.username || 'System'}</strong></td>
                  <td><span className="hc-badge hc-badge-warning">{log.actionType || log.action || '—'}</span></td>
                  <td>{[log.moduleName, log.targetTable, log.targetId && `#${log.targetId}`, log.newValue].filter(Boolean).join(' · ') || '—'}</td>
                </tr>)}</tbody>
              </table></div>}
        </div>
      </section>
    </main>
  );
}
