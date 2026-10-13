import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { apiCall, formatDateTime } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function AdminAccountsPage() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('ACCOUNTS'); // ACCOUNTS | AUDIT
  const [accounts, setAccounts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    email: '',
    role: 'ROLE_RECEPTIONIST'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'ACCOUNTS') {
        const res = await apiCall('/api/admin/accounts', { silentError: true });
        if (res && res.success) setAccounts(res.data || []);
      } else {
        const res = await apiCall('/api/admin/audit-logs', { silentError: true });
        if (res && res.success) setAuditLogs(res.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password || !form.fullName.trim()) {
      addToast('Vui lòng điền đầy đủ username, password và họ tên!', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiCall('/api/admin/accounts', {
        method: 'POST',
        body: {
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          role: form.role
        }
      });

      if (res && res.success) {
        addToast(`Tạo tài khoản ${form.username} thành công!`, 'success');
        setModalOpen(false);
        setForm({
          username: '',
          password: '',
          fullName: '',
          phone: '',
          email: '',
          role: 'ROLE_RECEPTIONIST'
        });
        loadData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi tạo tài khoản', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAccounts = accounts.filter(a => {
    const matchRole = roleFilter === 'ALL' || a.role === roleFilter;
    const query = searchQuery.toLowerCase();
    const matchSearch = !query || 
      (a.username && a.username.toLowerCase().includes(query)) ||
      (a.fullName && a.fullName.toLowerCase().includes(query)) ||
      (a.phone && a.phone.includes(query));
    return matchRole && matchSearch;
  });

  return (
    <div>
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-shield-lock-fill"></i> QUẢN TRỊ BẢO MẬT
          </div>
          <h2>Tài Khoản Nhân Viên & Nhật Ký Hệ Thống</h2>
          <p>Quản lý người dùng, phân quyền truy cập RBAC và theo dõi lịch sử thao tác (Audit Logs)</p>
        </div>

        <button
          type="button"
          className="hc-btn hc-btn-primary"
          onClick={() => setModalOpen(true)}
        >
          <i className="bi bi-person-plus-fill"></i> Thêm Tài Khoản Mới
        </button>
      </div>

      <div className="hc-tab-group" style={{ marginBottom: '24px' }}>
        <button
          className={`hc-tab-btn ${activeTab === 'ACCOUNTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('ACCOUNTS')}
        >
          <i className="bi bi-people-fill"></i> Danh Sách Tài Khoản ({accounts.length})
        </button>
        <button
          className={`hc-tab-btn ${activeTab === 'AUDIT' ? 'active' : ''}`}
          onClick={() => setActiveTab('AUDIT')}
        >
          <i className="bi bi-journal-text"></i> Nhật Ký Hoạt Động (Audit Logs)
        </button>
      </div>

      {activeTab === 'ACCOUNTS' ? (
        <div className="hc-card">
          <div className="hc-card-header">
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', width: '320px' }}>
                <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--hc-text-muted)' }}></i>
                <input
                  type="text"
                  className="hc-input"
                  style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
                  placeholder="Tìm theo username, tên, SĐT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="hc-select"
                style={{ width: '200px', height: '38px', fontSize: '13px' }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="ROLE_ADMIN">Quản trị viên (Admin)</option>
                <option value="ROLE_MANAGER">Quản lý (Manager)</option>
                <option value="ROLE_RECEPTIONIST">Lễ tân (Receptionist)</option>
                <option value="ROLE_CASHIER">Thu ngân (Cashier)</option>
                <option value="ROLE_HOUSEKEEPING">Buồng phòng (Housekeeping)</option>
                <option value="ROLE_CUSTOMER">Khách hàng (Customer)</option>
              </select>
            </div>
          </div>

          <div className="hc-card-body flush">
            {loading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="hc-empty-state">
                <i className="bi bi-person-x"></i>
                <p>Không tìm thấy tài khoản nào.</p>
              </div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Họ và tên</th>
                    <th>Vai trò (Role)</th>
                    <th>Số điện thoại</th>
                    <th>Email</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map(a => (
                    <tr key={a.accountId || a.id || a.username}>
                      <td>
                        <strong>{a.username}</strong>
                      </td>
                      <td>{a.fullName || '---'}</td>
                      <td>
                        <span className="hc-badge hc-badge-primary">
                          {(a.role || '').replace('ROLE_', '')}
                        </span>
                      </td>
                      <td>{a.phone || '---'}</td>
                      <td>{a.email || '---'}</td>
                      <td>
                        <span className="hc-badge hc-badge-success">
                          <i className="bi bi-check-circle-fill"></i> Hoạt động
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Audit Logs Table */
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-shield-check text-primary" style={{ marginRight: '8px' }}></i>
              Lịch Sử Nhật Ký Audit Log ({auditLogs.length})
            </div>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={loadData}>
              <i className="bi bi-arrow-clockwise"></i> Làm mới
            </button>
          </div>

          <div className="hc-card-body flush">
            {loading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="hc-empty-state">
                <i className="bi bi-journal-x"></i>
                <p>Chưa có ghi nhận nhật ký nào.</p>
              </div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Tài khoản</th>
                    <th>Hành động (Action)</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, idx) => (
                    <tr key={log.logId || idx}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                        {formatDateTime(log.timestamp || log.createdAt)}
                      </td>
                      <td>
                        <strong>{log.username || 'System'}</strong>
                      </td>
                      <td>
                        <span className="hc-badge hc-badge-warning" style={{ fontSize: '11px' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ color: 'var(--hc-text-secondary)', fontSize: '13px' }}>
                        {log.details || log.description || '---'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Thêm Mới Tài Khoản Người Dùng"
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={handleCreateAccount}
              disabled={submitting}
            >
              {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateAccount}>
          <div className="hc-form-group">
            <label className="hc-label">Tên đăng nhập (Username) <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="text"
              className="hc-input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Mật khẩu <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="password"
              className="hc-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Họ và tên đầy đủ <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="text"
              className="hc-input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Vai trò phân quyền (Role) <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <select
              className="hc-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              required
            >
              <option value="ROLE_RECEPTIONIST">Lễ tân (ROLE_RECEPTIONIST)</option>
              <option value="ROLE_CASHIER">Thu ngân (ROLE_CASHIER)</option>
              <option value="ROLE_HOUSEKEEPING">Buồng phòng (ROLE_HOUSEKEEPING)</option>
              <option value="ROLE_MANAGER">Quản lý (ROLE_MANAGER)</option>
              <option value="ROLE_ADMIN">Quản trị viên (ROLE_ADMIN)</option>
              <option value="ROLE_CUSTOMER">Khách hàng (ROLE_CUSTOMER)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Số điện thoại</label>
              <input
                type="tel"
                className="hc-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Email</label>
              <input
                type="email"
                className="hc-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
