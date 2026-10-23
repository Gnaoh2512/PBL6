import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { apiCall, formatVND, getCategoryName } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function AdminServicesPage() {
  const { addToast } = useToast();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Create/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editServiceId, setEditServiceId] = useState(null);
  const [form, setForm] = useState({
    serviceName: '',
    unit: 'Lần',
    unitPrice: 50000,
    category: 'Ẩm thực',
    active: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/admin/services', { silentError: true });
      if (res && res.success) {
        setServices(res.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditServiceId(null);
    setForm({
      serviceName: '',
      unit: 'Lần',
      unitPrice: 50000,
      category: 'Ẩm thực',
      active: true
    });
    setModalOpen(true);
  };

  const openEditModal = (service) => {
    setEditServiceId(service.serviceId);
    setForm({
      serviceName: service.serviceName,
      unit: service.unit || 'Lần',
      unitPrice: service.unitPrice || 0,
      category: getCategoryName(service.category),
      active: service.isActive !== false && service.active !== false
    });
    setModalOpen(true);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!form.serviceName.trim() || form.unitPrice < 0) {
      addToast('Vui lòng điền tên dịch vụ và đơn giá hợp lệ!', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      serviceName: form.serviceName.trim(),
      unit: form.unit.trim() || 'Lần',
      unitPrice: parseFloat(form.unitPrice) || 0,
      isActive: form.active
    };

    try {
      let res;
      if (editServiceId) {
        res = await apiCall(`/api/admin/services/${editServiceId}`, {
          method: 'PUT',
          body: payload
        });
      } else {
        res = await apiCall('/api/admin/services', {
          method: 'POST',
          body: payload
        });
      }

      if (res && res.success) {
        addToast(`${editServiceId ? 'Cập nhật' : 'Thêm'} dịch vụ thành công!`, 'success');
        setModalOpen(false);
        loadServices();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi lưu dịch vụ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ['ALL', ...Array.from(new Set(services.map(s => getCategoryName(s.category)).filter(Boolean)))];

  const filteredServices = services.filter(s => {
    const matchCategory = categoryFilter === 'ALL' || getCategoryName(s.category) === categoryFilter;
    const query = searchQuery.toLowerCase();
    const matchSearch = !query || (s.serviceName && s.serviceName.toLowerCase().includes(query));
    return matchCategory && matchSearch;
  });

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-cup-hot-fill"></i> DỊCH VỤ & MENU PHÒNG
          </div>
          <h2>Quản Lý Danh Mục Dịch Vụ Khách Sạn</h2>
          <p>Thiết lập menu đồ ăn, thức uống, giặt ủi, spa và bảng giá niêm yết</p>
        </div>

        <button type="button" className="hc-btn hc-btn-primary" onClick={openCreateModal}>
          <i className="bi bi-plus-lg"></i> Thêm Dịch Vụ Mới
        </button>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--hc-text-muted)' }}></i>
              <input
                type="text"
                className="hc-input"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
                placeholder="Tìm kiếm dịch vụ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="hc-select"
              style={{ width: '200px', height: '38px', fontSize: '13px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'ALL' ? 'Tất cả danh mục' : c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="hc-card-body flush">
          {loading ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="hc-empty-state">
              <i className="bi bi-cup"></i>
              <p>Không có dịch vụ nào phù hợp.</p>
            </div>
          ) : (
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Tên dịch vụ</th>
                  <th>Danh mục</th>
                  <th>Đơn vị tính</th>
                  <th>Đơn giá</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map(s => (
                  <tr key={s.serviceId}>
                    <td>
                      <strong style={{ fontSize: '15px', color: 'var(--hc-text)' }}>{s.serviceName}</strong>
                    </td>
                    <td>
                      <span className="hc-badge hc-badge-primary">{getCategoryName(s.category)}</span>
                    </td>
                    <td>{s.unit || 'Lần'}</td>
                    <td>
                      <strong style={{ color: 'var(--hc-secondary-dark)' }}>{formatVND(s.unitPrice)}</strong>
                    </td>
                    <td>
                      <span className={`hc-badge ${s.active !== false ? 'hc-badge-success' : 'hc-badge-muted'}`}>
                        {s.active !== false ? 'Sẵn sàng' : 'Tạm ngưng'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="hc-btn hc-btn-outline hc-btn-sm"
                        onClick={() => openEditModal(s)}
                      >
                        <i className="bi bi-pencil"></i> Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editServiceId ? 'Chỉnh Sửa Dịch Vụ' : 'Thêm Dịch Vụ Mới'}
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={handleSaveService}
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : 'Lưu dịch vụ'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveService}>
          <div className="hc-form-group">
            <label className="hc-label">Tên dịch vụ <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="text"
              className="hc-input"
              placeholder="ví dụ: Bữa sáng Buffet, Giặt ủi vest..."
              value={form.serviceName}
              onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Danh mục</label>
              <select
                className="hc-select"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="Ẩm thực">Ẩm thực</option>
                <option value="Đồ uống">Đồ uống</option>
                <option value="Giặt ủi">Giặt ủi</option>
                <option value="Spa & Massage">Spa & Massage</option>
                <option value="Đưa đón">Đưa đón</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Đơn vị tính</label>
              <input
                type="text"
                className="hc-input"
                placeholder="Phần, Ly, Bộ, Giờ..."
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Đơn giá (VNĐ) <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="number"
              className="hc-input"
              min="0"
              step="5000"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              required
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="hc-switch">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <span>Cho phép gọi dịch vụ này</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
