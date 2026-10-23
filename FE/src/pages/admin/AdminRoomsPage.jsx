import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { apiCall, formatVND, getRoomTypeName, getRoomBasePrice, getRoomTypeId } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function AdminRoomsPage() {
  const { addToast } = useToast();

  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal Create/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editRoomId, setEditRoomId] = useState(null);
  const [form, setForm] = useState({
    roomNumber: '',
    roomTypeId: '',
    floor: 1,
    status: 'AVAILABLE'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [roomsRes, typesRes] = await Promise.all([
        apiCall('/api/admin/rooms', { silentError: true }),
        apiCall('/api/public/rooms/room-types', { silentError: true })
      ]);

      if (roomsRes && roomsRes.success) setRooms(roomsRes.data || []);
      if (typesRes && typesRes.success) {
        setRoomTypes(typesRes.data || []);
        if (typesRes.data.length > 0 && !form.roomTypeId) {
          setForm(prev => ({ ...prev, roomTypeId: typesRes.data[0].roomTypeId }));
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditRoomId(null);
    setForm({
      roomNumber: '',
      roomTypeId: roomTypes[0]?.roomTypeId || '',
      floor: 1,
      status: 'AVAILABLE'
    });
    setModalOpen(true);
  };

  const openEditModal = (room) => {
    setEditRoomId(room.roomId);
    setForm({
      roomNumber: room.roomNumber,
      roomTypeId: getRoomTypeId(room) || roomTypes[0]?.roomTypeId || '',
      floor: room.floor || 1,
      status: room.status || 'AVAILABLE'
    });
    setModalOpen(true);
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    if (!form.roomNumber.trim() || !form.roomTypeId) {
      addToast('Vui lòng điền số phòng và chọn hạng phòng!', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      roomNumber: form.roomNumber.trim(),
      roomTypeId: parseInt(form.roomTypeId),
      floor: parseInt(form.floor) || 1,
      status: form.status
    };

    try {
      let res;
      if (editRoomId) {
        res = await apiCall(`/api/admin/rooms/${editRoomId}`, {
          method: 'PUT',
          body: payload
        });
      } else {
        res = await apiCall('/api/admin/rooms', {
          method: 'POST',
          body: payload
        });
      }

      if (res && res.success) {
        addToast(`${editRoomId ? 'Cập nhật' : 'Thêm'} phòng ${form.roomNumber} thành công!`, 'success');
        setModalOpen(false);
        loadData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi lưu thông tin phòng', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatus = async (roomId, newStatus) => {
    try {
      const res = await apiCall(`/api/admin/rooms/${roomId}/status?status=${newStatus}`, {
        method: 'PATCH'
      });
      if (res && res.success) {
        addToast(`Cập nhật trạng thái phòng thành công!`, 'success');
        loadData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi đổi trạng thái', 'error');
    }
  };

  const filteredRooms = rooms.filter(r => {
    const matchType = typeFilter === 'ALL' || String(r.roomTypeId) === String(typeFilter);
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchType && matchStatus;
  });

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-door-closed-fill"></i> QUẢN TRỊ CƠ SỞ VẬT CHẤT
          </div>
          <h2>Quản Lý Danh Mục Phòng & Hạng Phòng</h2>
          <p>Thiết lập danh sách phòng, phân loại hạng mục và điều chỉnh trạng thái phòng</p>
        </div>

        <button type="button" className="hc-btn hc-btn-primary" onClick={openCreateModal}>
          <i className="bi bi-plus-lg"></i> Thêm Phòng Mới
        </button>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>
              Danh Sách Phòng ({filteredRooms.length})
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                className="hc-select"
                style={{ width: '180px', height: '38px', fontSize: '13px' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">Tất cả hạng phòng</option>
                {roomTypes.map(t => (
                  <option key={t.roomTypeId} value={t.roomTypeId}>{t.typeName}</option>
                ))}
              </select>

              <select
                className="hc-select"
                style={{ width: '160px', height: '38px', fontSize: '13px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="AVAILABLE">Phòng trống</option>
                <option value="OCCUPIED">Đang có khách</option>
                <option value="CLEANING">Đang dọn dẹp</option>
                <option value="MAINTENANCE">Bảo trì</option>
              </select>
            </div>
          </div>
        </div>

        <div className="hc-card-body flush">
          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-door-closed"></i>
              <p>Không có phòng nào phù hợp bộ lọc.</p>
            </div>
          ) : (
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Số phòng</th>
                  <th>Hạng phòng</th>
                  <th>Tầng</th>
                  <th>Đơn giá</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map(r => (
                  <tr key={r.roomId}>
                    <td>
                      <strong style={{ fontSize: '15px', color: 'var(--hc-primary)' }}>Phòng {r.roomNumber}</strong>
                    </td>
                    <td>{getRoomTypeName(r)}</td>
                    <td>Tầng {r.floor || 1}</td>
                    <td><strong>{formatVND(getRoomBasePrice(r))}</strong> / đêm</td>
                    <td>
                      <span className={`hc-badge ${
                        r.status === 'AVAILABLE' ? 'hc-badge-success' :
                        r.status === 'OCCUPIED' ? 'hc-badge-error' :
                        r.status === 'CLEANING' ? 'hc-badge-warning' : 'hc-badge-muted'
                      }`}>
                        {r.status === 'AVAILABLE' ? 'Trống' :
                         r.status === 'OCCUPIED' ? 'Đang ở' :
                         r.status === 'CLEANING' ? 'Đang dọn' : 'Bảo trì'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {r.status === 'CLEANING' && (
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            title="Xác nhận đã dọn xong"
                            onClick={() => handleQuickStatus(r.roomId, 'AVAILABLE')}
                          >
                            <i className="bi bi-check2"></i> Đã dọn xong
                          </button>
                        )}
                        {r.status === 'AVAILABLE' && (
                          <button
                            type="button"
                            className="hc-btn hc-btn-ghost hc-btn-sm"
                            title="Chuyển dọn dẹp"
                            onClick={() => handleQuickStatus(r.roomId, 'CLEANING')}
                          >
                            <i className="bi bi-brush"></i> Dọn
                          </button>
                        )}
                        <button
                          type="button"
                          className="hc-btn hc-btn-outline hc-btn-sm"
                          onClick={() => openEditModal(r)}
                        >
                          <i className="bi bi-pencil"></i> Sửa
                        </button>
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
        title={editRoomId ? `Chỉnh Sửa Thông Tin Phòng` : `Thêm Mới Phòng Nghỉ`}
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={handleSaveRoom}
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveRoom}>
          <div className="hc-form-group">
            <label className="hc-label">Số phòng <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="text"
              className="hc-input"
              placeholder="ví dụ: 101, 202, 305..."
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
              required
            />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Hạng phòng (Room Type) <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <select
              className="hc-select"
              value={form.roomTypeId}
              onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
              required
            >
              {roomTypes.map(t => (
                <option key={t.roomTypeId} value={t.roomTypeId}>
                  {t.typeName} - {formatVND(t.basePrice)}/đêm ({t.capacity} khách)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Tầng</label>
              <input
                type="number"
                className="hc-input"
                min="1"
                max="50"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Trạng thái phòng</label>
              <select
                className="hc-select"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="AVAILABLE">Trống (Sẵn sàng)</option>
                <option value="CLEANING">Đang dọn dẹp</option>
                <option value="MAINTENANCE">Bảo trì</option>
                <option value="OCCUPIED">Đang có khách</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
