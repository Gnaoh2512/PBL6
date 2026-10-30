import { useCallback, useEffect, useState } from 'react';
import { apiCall, formatVND, formatDateTime } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';

const TIER_COLORS = {
  SEASHELL: '#94a3b8',
  STARFISH: '#f59e0b',
  CORAL: '#f97316',
  PEARL: '#8b5cf6',
};

export default function AdminLoyaltyPage() {
  const { addToast } = useToast();

  // Tier management
  const [tiers, setTiers] = useState([]);
  // Customer loyalty list
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selected customer for detail / adjust
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);

  // Adjust modal
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ scoreAdjust: '', note: '' });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersRes, customersRes] = await Promise.allSettled([
        apiCall('/api/admin/loyalty/tiers', { silentError: true }),
        apiCall('/api/admin/loyalty/customers', { silentError: true }),
      ]);
      setTiers(tiersRes.status === 'fulfilled' && tiersRes.value?.success ? tiersRes.value.data || [] : []);
      setCustomers(customersRes.status === 'fulfilled' && customersRes.value?.success ? customersRes.value.data || [] : []);
    } catch (err) {
      addToast(err.message || 'Không thể tải dữ liệu loyalty.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadTransactions = useCallback(async (customerId) => {
    setTxnLoading(true);
    try {
      const res = await apiCall(`/api/admin/loyalty/customers/${customerId}/transactions`, { silentError: true });
      setTransactions(res?.success ? res.data || [] : []);
    } catch {
      setTransactions([]);
    } finally {
      setTxnLoading(false);
    }
  }, []);

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setTransactions([]);
    loadTransactions(customer.customerId);
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const score = Number(adjustForm.scoreAdjust);
    if (isNaN(score) || score === 0) {
      addToast('Vui lòng nhập số điểm cần điều chỉnh (dương để cộng, âm để trừ).', 'warning');
      return;
    }
    setAdjustSubmitting(true);
    try {
      const res = await apiCall(`/api/admin/loyalty/customers/${selectedCustomer.customerId}/adjust`, {
        method: 'POST',
        body: {
          scoreAdjust: score,
          note: adjustForm.note.trim() || `Điều chỉnh điểm bởi quản trị viên (${score > 0 ? '+' : ''}${score})`,
        },
      });
      if (res?.success) {
        addToast(`Đã điều chỉnh điểm cho ${selectedCustomer.customerName || 'khách hàng'}.`, 'success');
        setAdjustModal(false);
        setAdjustForm({ scoreAdjust: '', note: '' });
        await loadData();
        // Reload transactions for selected customer
        loadTransactions(selectedCustomer.customerId);
        // Update selectedCustomer with latest data from response if available
        if (res.data) setSelectedCustomer(res.data);
      }
    } catch (err) {
      addToast(err.message || 'Không thể điều chỉnh điểm.', 'error');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const filtered = customers.filter((c) => {
    const matchTier = !tierFilter || (c.tierCode === tierFilter);
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (c.customerName || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q);
    return matchTier && matchSearch;
  });

  const getTierColor = (tierCode) => TIER_COLORS[tierCode] || '#94a3b8';

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-gem-fill"></i> CHƯƠNG TRÌNH HỘI VIÊN
          </div>
          <h2>Quản lý Loyalty</h2>
          <p>Xem hạng thành viên, điểm tích lũy và điều chỉnh điểm thưởng cho khách hàng.</p>
        </div>
        <button type="button" className="hc-btn hc-btn-outline" onClick={loadData} disabled={loading}>
          <i className="bi bi-arrow-clockwise"></i> Làm mới
        </button>
      </div>

      {/* Tier Overview */}
      {tiers.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {tiers.map((tier) => (
            <div key={tier.tierId} style={{
              background: 'var(--hc-bg-card, #1e293b)',
              borderRadius: 12,
              padding: '16px 20px',
              flex: '1 1 140px',
              borderTop: `4px solid ${getTierColor(tier.tierCode)}`,
              minWidth: 130,
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: getTierColor(tier.tierCode) }}>{tier.tierName}</div>
              <div style={{ fontSize: 12, color: 'var(--hc-text-muted)', marginTop: 4 }}>
                Từ {Number(tier.minScore || 0).toLocaleString('vi-VN')} điểm
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>
                {customers.filter((c) => c.tierCode === tier.tierCode).length}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--hc-text-muted)', marginLeft: 4 }}>khách</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedCustomer ? '1fr 400px' : '1fr', gap: 20, alignItems: 'start' }}>
        {/* Customer list */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--hc-text-muted)' }}></i>
                <input
                  type="text"
                  className="hc-input"
                  style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
                  placeholder="Tên, SĐT, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className="hc-select" style={{ height: '38px', fontSize: '13px', minWidth: 160 }} value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
                <option value="">Tất cả hạng</option>
                {tiers.map((t) => <option key={t.tierId} value={t.tierCode}>{t.tierName}</option>)}
              </select>
            </div>
          </div>
          <div className="hc-card-body flush">
            {loading ? (
              <div className="hc-loading-spinner"><div className="hc-spinner"></div></div>
            ) : filtered.length === 0 ? (
              <div className="hc-empty-state"><i className="bi bi-people"></i><p>Không tìm thấy hội viên.</p></div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Hạng</th>
                    <th>Điểm</th>
                    <th>Ngày lưu trú</th>
                    <th>Tổng chi tiêu</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.customerId}
                      style={{ cursor: 'pointer', background: selectedCustomer?.customerId === c.customerId ? 'rgba(99,102,241,0.1)' : undefined }}
                      onClick={() => selectCustomer(c)}
                    >
                      <td>
                        <strong>{c.customerName || '—'}</strong>
                        <br/><small>{c.phone || c.email || '—'}</small>
                      </td>
                      <td>
                        <span style={{
                          background: getTierColor(c.tierCode),
                          color: '#fff',
                          borderRadius: 20,
                          padding: '2px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {c.tierCode || '—'}
                        </span>
                      </td>
                      <td><strong>{Number(c.totalScore || 0).toLocaleString('vi-VN')}</strong></td>
                      <td>{c.totalStayDays || 0} đêm</td>
                      <td>{formatVND(c.totalSpent || 0)}</td>
                      <td>
                        <button
                          type="button"
                          className="hc-btn hc-btn-outline hc-btn-sm"
                          onClick={(e) => { e.stopPropagation(); selectCustomer(c); setAdjustModal(true); setAdjustForm({ scoreAdjust: '', note: '' }); }}
                          title="Điều chỉnh điểm"
                        >
                          <i className="bi bi-plus-slash-minus"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Customer Detail Panel */}
        {selectedCustomer && (
          <div className="hc-card" style={{ position: 'sticky', top: 20 }}>
            <div className="hc-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedCustomer.customerName || 'Chi tiết hội viên'}</div>
                <div style={{ fontSize: 12, color: 'var(--hc-text-muted)' }}>{selectedCustomer.phone || selectedCustomer.email || ''}</div>
              </div>
              <button
                type="button"
                className="hc-btn hc-btn-primary hc-btn-sm"
                onClick={() => { setAdjustModal(true); setAdjustForm({ scoreAdjust: '', note: '' }); }}
              >
                <i className="bi bi-plus-slash-minus"></i> Điều chỉnh điểm
              </button>
            </div>
            <div className="hc-card-body" style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Hạng hiện tại', value: selectedCustomer.tierCode, color: getTierColor(selectedCustomer.tierCode) },
                  { label: 'Điểm tích lũy', value: `${Number(selectedCustomer.totalScore || 0).toLocaleString('vi-VN')} điểm` },
                  { label: 'Tổng đêm lưu trú', value: `${selectedCustomer.totalStayDays || 0} đêm` },
                  { label: 'Tổng chi tiêu', value: formatVND(selectedCustomer.totalSpent || 0) },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: 'var(--hc-bg-subtle, rgba(255,255,255,0.04))', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--hc-text-muted)', marginBottom: 4 }}>{stat.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: stat.color || 'inherit' }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Lịch sử điểm gần đây</div>
              {txnLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--hc-text-muted)', fontSize: 13 }}>Đang tải…</div>
              ) : transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--hc-text-muted)', fontSize: 13 }}>Chưa có giao dịch điểm.</div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {transactions.slice(0, 20).map((txn) => (
                    <div key={txn.txnId} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--hc-border-subtle, rgba(255,255,255,0.06))',
                      fontSize: 13,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{txn.txnType === 'EARN' ? 'Tích điểm' : 'Điều chỉnh'}</div>
                        <div style={{ color: 'var(--hc-text-muted)', fontSize: 11 }}>{formatDateTime(txn.createdAt)}</div>
                        {txn.note && <div style={{ color: 'var(--hc-text-muted)', fontSize: 11 }}>{txn.note}</div>}
                      </div>
                      <div style={{ fontWeight: 700, color: Number(txn.scoreEarned) >= 0 ? '#10b981' : '#ef4444' }}>
                        {Number(txn.scoreEarned) >= 0 ? '+' : ''}{Number(txn.scoreEarned || 0).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      <Modal
        isOpen={adjustModal}
        onClose={() => setAdjustModal(false)}
        title={`Điều chỉnh điểm: ${selectedCustomer?.customerName || ''}`}
        maxWidth="400px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setAdjustModal(false)}>Hủy</button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleAdjust} disabled={adjustSubmitting}>
              {adjustSubmitting ? 'Đang xử lý...' : 'Xác nhận điều chỉnh'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAdjust}>
          <div style={{ padding: '0 0 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--hc-text-muted)', marginBottom: 12 }}>
              Điểm hiện tại: <strong>{Number(selectedCustomer?.totalScore || 0).toLocaleString('vi-VN')} điểm</strong>
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Số điểm điều chỉnh <span style={{ color: 'var(--hc-error)' }}>*</span></label>
              <input
                type="number"
                className="hc-input"
                placeholder="Nhập số dương để cộng, âm để trừ (VD: 5 hoặc -3)"
                value={adjustForm.scoreAdjust}
                onChange={(e) => setAdjustForm({ ...adjustForm, scoreAdjust: e.target.value })}
                required
              />
              <small style={{ color: 'var(--hc-text-muted)', fontSize: 11 }}>Nhập số dương để cộng điểm, số âm để trừ điểm.</small>
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Lý do / Ghi chú</label>
              <textarea
                className="hc-input"
                rows={3}
                placeholder="Nhập lý do điều chỉnh điểm..."
                value={adjustForm.note}
                onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
              ></textarea>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
