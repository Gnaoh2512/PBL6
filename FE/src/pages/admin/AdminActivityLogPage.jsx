import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall, formatDateTime } from '../../services/api';

const PREDEFINED_MODULES = [
  'ALL',
  'XÁC THỰC',
  'QUẢN TRỊ TÀI KHOẢN',
  'PHÒNG & HẠNG PHÒNG',
  'DỊCH VỤ',
  'ƯU ĐÃI & VOUCHER',
  'CA LÀM VIỆC',
  'LỊCH LÀM VIỆC',
  'THU NGÂN',
  'ĐẶT PHÒNG',
  'YÊU CẦU DỊCH VỤ',
  'BẢO TRÌ',
  'THIẾT BỊ',
  'HỆ THỐNG'
];

export default function AdminActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiCall('/api/admin/audit-logs', { silentError: true });
      if (response && response.success) {
        setLogs(response.data || []);
      } else {
        throw new Error(response?.message || 'Không thể tải nhật ký hoạt động.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải nhật ký hoạt động.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getActionBadgeClass = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('DELETE') || act.includes('XÓA') || act.includes('HỦY') || act.includes('CANCEL') || act.includes('DEACTIVATE')) {
      return 'hc-badge-error';
    }
    if (act.includes('CREATE') || act.includes('TẠO') || act.includes('THÊM') || act.includes('COMPLETE') || act.includes('CHECK_OUT') || act.includes('CLOSE_SHIFT') || act.includes('CONFIRM')) {
      return 'hc-badge-success';
    }
    if (act.includes('UPDATE') || act.includes('CẤU HÌNH') || act.includes('SỬA') || act.includes('STATUS_CHANGE')) {
      return 'hc-badge-info';
    }
    if (act.includes('LOGIN') || act.includes('REGISTER') || act.includes('WALKIN') || act.includes('CHECK_IN') || act.includes('ASSIGN') || act.includes('OPEN_SHIFT')) {
      return 'hc-badge-primary';
    }
    return 'hc-badge-warning';
  };

  const getActionDisplayName = (action) => {
    const act = (action || '').toUpperCase();
    switch (act) {
      case 'LOGIN': return 'Đăng nhập';
      case 'REGISTER': return 'Đăng ký';
      case 'CREATE': return 'Tạo mới';
      case 'UPDATE': return 'Cập nhật';
      case 'DELETE': return 'Xóa';
      case 'ACTIVATE': return 'Kích hoạt';
      case 'DEACTIVATE': return 'Tạm ngưng';
      case 'STATUS_CHANGE': return 'Đổi trạng thái';
      case 'ASSIGN': return 'Phân công';
      case 'WALKIN': return 'Khách Walk-in';
      case 'CHECK_IN': return 'Nhận phòng (Check-in)';
      case 'CHECK_OUT': return 'Trả phòng (Check-out)';
      case 'CANCEL': return 'Hủy bỏ';
      case 'CONFIRM_DEPOSIT': return 'Duyệt cọc';
      case 'OPEN_SHIFT': return 'Mở ca';
      case 'CLOSE_SHIFT': return 'Đóng ca & Quyết toán';
      case 'ORDER': return 'Gọi dịch vụ';
      case 'COMPLETE': return 'Hoàn thành';
      case 'REPORT': return 'Báo hỏng';
      case 'USE_VOUCHER': return 'Dùng ưu đãi';
      default: return action || '—';
    }
  };

  // Modules present in current logs plus presets
  const availableModules = [
    'ALL',
    ...new Set([
      ...PREDEFINED_MODULES.filter(m => m !== 'ALL'),
      ...logs.map(l => l.moduleName).filter(Boolean)
    ])
  ];

  const filteredLogs = logs.filter(log => {
    const matchModule = moduleFilter === 'ALL' || log.moduleName === moduleFilter;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchModule;

    const username = (log.account?.username || log.username || '').toLowerCase();
    const fullName = (log.account?.fullName || '').toLowerCase();
    const action = (log.actionType || log.action || '').toLowerCase();
    const details = (log.newValue || log.oldValue || '').toLowerCase();
    const module = (log.moduleName || '').toLowerCase();
    const table = (log.targetTable || '').toLowerCase();
    return matchModule && (username.includes(query) || fullName.includes(query) || action.includes(query) || details.includes(query) || module.includes(query) || table.includes(query));
  });

  return (
    <main className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="hc-hero-badge"><i className="bi bi-shield-check" /> BẢO MẬT &amp; GIÁM SÁT</div>
          <h2>Nhật Ký Hoạt Động Toàn Hệ Thống (Audit Logs)</h2>
          <p>Truy vết chi tiết mọi thao tác của Quản trị viên, Nhân viên và Khách hàng trên tất cả các phân hệ.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link to="/admin/accounts" className="hc-btn hc-btn-outline">
            <i className="bi bi-people" /> Tài Khoản Người Dùng
          </Link>
          <button className="hc-btn hc-btn-primary" type="button" onClick={loadLogs} disabled={loading}>
            <i className="bi bi-arrow-clockwise" /> Làm mới dữ liệu
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <section className="hc-card">
        <div className="hc-card-header">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: '320px', flex: 1, maxWidth: '450px' }}>
              <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--hc-text-muted)' }}></i>
              <input
                type="text"
                className="hc-input"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
                placeholder="Tìm theo người thực hiện, hành động, phòng, mã đơn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--hc-text-secondary)', fontWeight: 500 }}>
                <i className="bi bi-funnel"></i> Phân hệ:
              </span>
              <select
                className="hc-select"
                style={{ width: '220px', height: '38px', fontSize: '13px' }}
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                {availableModules.map(m => (
                  <option key={m} value={m}>
                    {m === 'ALL' ? `Tất cả phân hệ (${logs.length})` : m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="hc-card-body flush">
          {loading ? (
            <div className="hc-loading-spinner"><div className="hc-spinner" /></div>
          ) : filteredLogs.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-journal-x" />
              <p>Chưa có nhật ký hoạt động nào phù hợp với bộ lọc hiện tại.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="hc-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>Thời gian</th>
                    <th style={{ width: '200px' }}>Người thực hiện</th>
                    <th style={{ width: '150px' }}>Phân hệ</th>
                    <th style={{ width: '140px' }}>Hành động</th>
                    <th>Nội dung chi tiết thao tác</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Địa chỉ IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => {
                    const account = log.account;
                    const username = account?.username || log.username;
                    const fullName = account?.fullName || log.performerName;
                    const roleCode = log.performerRole || account?.role?.roleCode || account?.role?.roleName || '';
                    const roleDisplay = roleCode ? roleCode.replace('ROLE_', '') : '';
                    const isSystem = (!account && (!username || username.toLowerCase() === 'system' || username.toLowerCase() === 'hệ thống'));

                    const time = log.loggedAt || log.timestamp || log.createdAt;

                    return (
                      <tr key={log.logId || index}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--hc-text-secondary)' }}>
                          <i className="bi bi-clock" style={{ marginRight: '6px', opacity: 0.7 }}></i>
                          {formatDateTime(time)}
                        </td>
                        <td>
                          {isSystem ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className="bi bi-cpu text-secondary" style={{ fontSize: '15px' }}></i>
                              <span className="hc-badge hc-badge-neutral" style={{ fontSize: '11px' }}>
                                Hệ thống tự động
                              </span>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="bi bi-person-circle text-primary" style={{ fontSize: '15px' }}></i>
                                <strong style={{ color: 'var(--hc-text-primary)' }}>
                                  {fullName && fullName !== username ? fullName : (username || 'Nhân sự')}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                {username && (
                                  <span style={{ fontSize: '11px', color: 'var(--hc-text-muted)' }}>
                                    @{username}
                                  </span>
                                )}
                                {roleDisplay && (
                                  <span className="hc-badge hc-badge-primary" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                    {roleDisplay}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="hc-badge hc-badge-info" style={{ fontSize: '11px', letterSpacing: '0.02em', fontWeight: 600 }}>
                            {log.moduleName || 'HỆ THỐNG'}
                          </span>
                        </td>
                        <td>
                          <span className={`hc-badge ${getActionBadgeClass(log.actionType || log.action)}`} style={{ fontSize: '11px' }}>
                            {getActionDisplayName(log.actionType || log.action)}
                          </span>
                        </td>
                        <td>
                          <div>
                            <span style={{ lineHeight: 1.5 }}>
                              {log.newValue || log.oldValue || ('Thao tác trên bảng ' + (log.targetTable || 'dữ liệu'))}
                            </span>
                            {log.targetTable && (
                              <span style={{ fontSize: '11px', color: 'var(--hc-text-muted)', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                                [{log.targetTable}{log.targetId ? ` #${log.targetId}` : ''}]
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--hc-text-muted)', fontFamily: 'monospace', textAlign: 'center' }}>
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
