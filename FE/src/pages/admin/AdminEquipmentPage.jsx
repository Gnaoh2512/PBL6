import { useCallback, useEffect, useState } from 'react';
import { apiCall, formatDateTime } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';

const STATUS_LABELS = {
  WORKING: 'Đang hoạt động',
  BROKEN: 'Hỏng',
  UNDER_REPAIR: 'Đang sửa chữa',
  RETIRED: 'Đã thanh lý',
};

const STATUS_COLORS = {
  WORKING: 'hc-badge-success',
  BROKEN: 'hc-badge-danger',
  UNDER_REPAIR: 'hc-badge-warning',
  RETIRED: 'hc-badge-secondary',
};

const EMPTY_FORM = {
  roomId: '',
  equipmentName: '',
  serialNumber: '',
  status: 'WORKING',
  note: '',
};

export default function AdminEquipmentPage() {
  const { addToast } = useToast();
  const [equipment, setEquipment] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create, object = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [equipRes, roomRes] = await Promise.allSettled([
        apiCall('/api/staff/maintenance/equipment', { silentError: true }),
        apiCall('/api/admin/rooms', { silentError: true }),
      ]);
      setEquipment(equipRes.status === 'fulfilled' && equipRes.value?.success ? equipRes.value.data || [] : []);
      setRooms(roomRes.status === 'fulfilled' && roomRes.value?.success ? roomRes.value.data || [] : []);
    } catch (err) {
      addToast(err.message || 'Không thể tải danh sách thiết bị.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      roomId: item.roomId ? String(item.roomId) : '',
      equipmentName: item.equipmentName || '',
      serialNumber: item.serialNumber || '',
      status: item.status || 'WORKING',
      note: item.note || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.equipmentName.trim()) {
      addToast('Vui lòng nhập tên thiết bị.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        roomId: form.roomId ? Number(form.roomId) : null,
        equipmentName: form.equipmentName.trim(),
        serialNumber: form.serialNumber.trim() || null,
        status: form.status,
        note: form.note.trim() || null,
      };
      let res;
      if (editTarget) {
        res = await apiCall(`/api/admin/equipment/${editTarget.equipmentId}`, { method: 'PUT', body });
      } else {
        res = await apiCall('/api/admin/equipment', { method: 'POST', body });
      }
      if (res?.success) {
        addToast(editTarget ? 'Đã cập nhật thiết bị.' : 'Đã thêm thiết bị mới.', 'success');
        setModalOpen(false);
        await loadData();
      }
    } catch (err) {
      addToast(err.message || 'Không thể lưu thiết bị.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      const res = await apiCall(`/api/admin/equipment/${item.equipmentId}/status?status=${encodeURIComponent(newStatus)}`, { method: 'PATCH' });
      if (res?.success) {
        addToast(`Đã cập nhật trạng thái thiết bị sang ${STATUS_LABELS[newStatus] || newStatus}.`, 'success');
        await loadData();
      }
    } catch (err) {
      addToast(err.message || 'Không thể cập nhật trạng thái.', 'error');
    }
  };

  const filtered = equipment.filter((item) => {
    const matchStatus = !statusFilter || item.status === statusFilter;
    const matchRoom = !roomFilter || String(item.roomId) === roomFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (item.equipmentName || '').toLowerCase().includes(q) ||
      (item.serialNumber || '').toLowerCase().includes(q);
    return matchStatus && matchRoom && matchSearch;
  });

  const getRoomLabel = (roomId) => {
    if (!roomId) return 'Khu vực chung';
    const room = rooms.find((r) => r.roomId === roomId);
    return room ? `Phòng ${room.roomNumber}` : `Phòng #${roomId}`;
  };

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-cpu-fill"></i> QUẢN LÝ TÀI SẢN
          </div>
          <h2>Thiết bị & Tài sản</h2>
          <p>Theo dõi và quản lý tình trạng thiết bị trong khách sạn.</p>
        </div>
        <button type="button" className="hc-btn hc-btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-lg"></i> Thêm thiết bị
        </button>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
              <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--hc-text-muted)' }}></i>
              <input
                type="text"
                className="hc-input"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
                placeholder="Tìm theo tên, số serial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="hc-select" style={{ height: '38px', fontSize: '13px', minWidth: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <select className="hc-select" style={{ height: '38px', fontSize: '13px', minWidth: 160 }} value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="">Tất cả vị trí</option>
              <option value="null">Khu vực chung</option>
              {rooms.map((r) => <option key={r.roomId} value={String(r.roomId)}>Phòng {r.roomNumber}</option>)}
            </select>
            <button className="hc-btn hc-btn-outline" style={{ height: '38px' }} onClick={loadData} disabled={loading}>
              <i className="bi bi-arrow-clockwise"></i> Làm mới
            </button>
          </div>
        </div>

        <div className="hc-card-body flush">
          {loading ? (
            <div className="hc-loading-spinner"><div className="hc-spinner"></div></div>
          ) : filtered.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-cpu"></i>
              <p>Không tìm thấy thiết bị nào phù hợp.</p>
            </div>
          ) : (
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Tên thiết bị</th>
                  <th>Số serial</th>
                  <th>Vị trí</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.equipmentId}>
                    <td><strong>{item.equipmentName}</strong></td>
                    <td>{item.serialNumber || '—'}</td>
                    <td>{getRoomLabel(item.roomId)}</td>
                    <td>
                      <span className={`hc-badge ${STATUS_COLORS[item.status] || 'hc-badge-secondary'}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 200, fontSize: 13 }}>{item.note || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="hc-btn hc-btn-outline hc-btn-sm"
                          onClick={() => openEdit(item)}
                          title="Chỉnh sửa thông tin thiết bị"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        {item.status !== 'WORKING' && (
                          <button type="button" className="hc-btn hc-btn-sm" style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                            onClick={() => handleStatusChange(item, 'WORKING')} title="Đánh dấu đang hoạt động">
                            Hoạt động
                          </button>
                        )}
                        {item.status !== 'UNDER_REPAIR' && item.status !== 'RETIRED' && (
                          <button type="button" className="hc-btn hc-btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                            onClick={() => handleStatusChange(item, 'UNDER_REPAIR')} title="Đưa vào sửa chữa">
                            Sửa chữa
                          </button>
                        )}
                        {item.status !== 'BROKEN' && item.status !== 'RETIRED' && (
                          <button type="button" className="hc-btn hc-btn-sm" style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                            onClick={() => handleStatusChange(item, 'BROKEN')} title="Đánh dấu hỏng">
                            Hỏng
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Chỉnh sửa thiết bị' : 'Thêm thiết bị mới'}
        maxWidth="480px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>Hủy</button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Đang lưu...' : (editTarget ? 'Cập nhật' : 'Thêm thiết bị')}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="hc-form-group">
            <label className="hc-label">Tên thiết bị <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input type="text" className="hc-input" value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })} placeholder="Ví dụ: Điều hòa, TV, Tủ lạnh..." required />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Phòng</label>
            <select className="hc-select" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">Khu vực chung (không thuộc phòng nào)</option>
              {rooms.map((r) => <option key={r.roomId} value={String(r.roomId)}>Phòng {r.roomNumber}{r.floor ? ` · Tầng ${r.floor}` : ''}</option>)}
            </select>
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Số serial / Mã tài sản</label>
            <input type="text" className="hc-input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Nhập số serial (tùy chọn)" />
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Trạng thái</label>
            <select className="hc-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div className="hc-form-group">
            <label className="hc-label">Ghi chú</label>
            <textarea className="hc-input" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ghi chú bổ sung về tình trạng thiết bị..."></textarea>
          </div>
        </form>
      </Modal>
    </div>
  );
}
