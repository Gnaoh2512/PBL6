import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../components/Modal';
import { apiCall, formatVND, getCategoryName } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function AdminServicesPage() {
  const { addToast } = useToast();

  const [services, setServices] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
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
    categoryId: '',
    categoryName: '',
    active: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [servicesRes, categoriesRes] = await Promise.all([
        apiCall('/api/admin/services', { silentError: true }),
        apiCall('/api/admin/services/categories', { silentError: true })
      ]);

      if (servicesRes && servicesRes.success) {
        setServices(servicesRes.data || []);
      }

      if (categoriesRes && categoriesRes.success && Array.isArray(categoriesRes.data) && categoriesRes.data.length > 0) {
        setCategoriesList(categoriesRes.data);
      } else {
        // Fallback standard categories if DB has no categories table data
        setCategoriesList([
          { categoryId: 1, categoryName: 'Ẩm thực & Đồ uống (F&B)' },
          { categoryId: 2, categoryName: 'Dịch vụ phòng & Giặt ủi' },
          { categoryId: 3, categoryName: 'Thư giãn & Spa' },
          { categoryId: 4, categoryName: 'Đưa đón & Phương tiện' },
          { categoryId: 5, categoryName: 'Tiện ích & Khác' }
        ]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isServiceActive = (s) => {
    if (s?.isActive !== undefined && s?.isActive !== null) return s.isActive === true;
    if (s?.active !== undefined && s?.active !== null) return s.active === true;
    return false;
  };

  const openCreateModal = () => {
    setEditServiceId(null);
    const defaultCat = categoriesList[0];
    setForm({
      serviceName: '',
      unit: 'Lần',
      unitPrice: 50000,
      categoryId: defaultCat ? String(defaultCat.categoryId) : '1',
      categoryName: defaultCat ? defaultCat.categoryName : 'Ẩm thực & Đồ uống (F&B)',
      active: true
    });
    setModalOpen(true);
  };

  const openEditModal = (service) => {
    setEditServiceId(service.serviceId);
    const catId = service.category?.categoryId || service.categoryId || '';
    const catName = getCategoryName(service.category);
    setForm({
      serviceName: service.serviceName || '',
      unit: service.unit || 'Lần',
      unitPrice: service.unitPrice || 0,
      categoryId: catId ? String(catId) : '',
      categoryName: catName,
      active: isServiceActive(service)
    });
    setModalOpen(true);
  };

  const handleToggleStatus = async (service) => {
    const sId = service.serviceId;
    const currentStatus = isServiceActive(service);
    setTogglingId(sId);
    try {
      const res = await apiCall(`/api/admin/services/${sId}/toggle`, {
        method: 'PATCH'
      });
      if (res && res.success) {
        addToast(`Đã ${currentStatus ? 'tắt' : 'bật'} cho phép gọi dịch vụ "${service.serviceName}"!`, 'success');
        loadData();
      } else {
        // Fallback to PUT
        const payload = {
          serviceName: service.serviceName,
          unit: service.unit || 'Lần',
          unitPrice: service.unitPrice || 0,
          categoryId: service.category?.categoryId || null,
          isActive: !currentStatus
        };
        await apiCall(`/api/admin/services/${sId}`, {
          method: 'PUT',
          body: payload
        });
        addToast(`Đã ${currentStatus ? 'tắt' : 'bật'} cho phép gọi dịch vụ "${service.serviceName}"!`, 'success');
        loadData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi khi cập nhật trạng thái dịch vụ', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!form.serviceName.trim() || form.unitPrice < 0) {
      addToast('Vui lòng điền tên dịch vụ và đơn giá hợp lệ!', 'warning');
      return;
    }

    setSubmitting(true);
    const selectedCatId = form.categoryId ? parseInt(form.categoryId, 10) : null;
    const foundCat = categoriesList.find(c => c.categoryId === selectedCatId);

    const payload = {
      serviceName: form.serviceName.trim(),
      unit: form.unit.trim() || 'Lần',
      unitPrice: parseFloat(form.unitPrice) || 0,
      categoryId: selectedCatId,
      categoryName: foundCat ? foundCat.categoryName : (form.categoryName || undefined),
      isActive: Boolean(form.active),
      active: Boolean(form.active)
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
        loadData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi lưu dịch vụ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Build filter options
  const filterOptions = ['ALL', ...new Set([
    ...categoriesList.map(c => c.categoryName),
    ...services.map(s => getCategoryName(s.category)).filter(c => c && c !== 'Khác')
  ])];

  const filteredServices = services.filter(s => {
    const sCat = getCategoryName(s.category);
    const matchCategory = categoryFilter === 'ALL' || sCat === categoryFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || (s.serviceName && s.serviceName.toLowerCase().includes(query));
    return matchCategory && matchSearch;
  });

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-cup-hot-fill"></i> DỊCH VỤ &amp; MENU PHÒNG
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
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
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

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--hc-text-secondary)', fontWeight: 500 }}>Danh mục:</span>
              <select
                className="hc-select"
                style={{ width: '220px', height: '38px', fontSize: '13px' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {filterOptions.map(c => (
                  <option key={c} value={c}>{c === 'ALL' ? 'Tất cả danh mục' : c}</option>
                ))}
              </select>
            </div>
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
            <div className="table-responsive">
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
                  {filteredServices.map(s => {
                    const active = isServiceActive(s);
                    const catName = getCategoryName(s.category);
                    const isToggling = togglingId === s.serviceId;

                    return (
                      <tr key={s.serviceId}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="bi bi-check2-circle text-primary" style={{ opacity: active ? 1 : 0.3 }}></i>
                            <strong style={{ fontSize: '15px', color: active ? 'var(--hc-text)' : 'var(--hc-text-muted)' }}>
                              {s.serviceName}
                            </strong>
                          </div>
                        </td>
                        <td>
                          <span className={`hc-badge ${catName !== 'Khác' ? 'hc-badge-primary' : 'hc-badge-muted'}`}>
                            {catName}
                          </span>
                        </td>
                        <td>{s.unit || 'Lần'}</td>
                        <td>
                          <strong style={{ color: 'var(--hc-secondary-dark)' }}>{formatVND(s.unitPrice)}</strong>
                        </td>
                        <td>
                          <span className={`hc-badge ${active ? 'hc-badge-success' : 'hc-badge-error'}`}>
                            <i className={`bi ${active ? 'bi-check-circle-fill' : 'bi-slash-circle'}`} style={{ marginRight: '4px' }}></i>
                            {active ? 'Sẵn sàng' : 'Tạm ngưng'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className={`hc-btn hc-btn-sm ${active ? 'hc-btn-outline' : 'hc-btn-primary'}`}
                              style={{ minWidth: '92px' }}
                              onClick={() => handleToggleStatus(s)}
                              disabled={isToggling}
                              title={active ? 'Tắt không cho phép khách gọi' : 'Bật cho phép khách gọi'}
                            >
                              {isToggling ? (
                                <><span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} /> Đang xử lý</>
                              ) : active ? (
                                <><i className="bi bi-pause-circle"></i> Tắt gọi</>
                              ) : (
                                <><i className="bi bi-play-circle"></i> Cho phép</>
                              )}
                            </button>

                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              onClick={() => openEditModal(s)}
                            >
                              <i className="bi bi-pencil"></i> Sửa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editServiceId ? 'Chỉnh Sửa Dịch Vụ' : 'Thêm Dịch Vụ Mới'}
        maxWidth="520px"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Danh mục dịch vụ <span style={{ color: 'var(--hc-error)' }}>*</span></label>
              <select
                className="hc-select"
                value={form.categoryId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const cat = categoriesList.find(c => String(c.categoryId) === String(val));
                  setForm({
                    ...form,
                    categoryId: val,
                    categoryName: cat ? cat.categoryName : ''
                  });
                }}
                required
              >
                <option value="">-- Chọn danh mục --</option>
                {categoriesList.map(c => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName}
                  </option>
                ))}
              </select>
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Đơn vị tính</label>
              <input
                type="text"
                className="hc-input"
                placeholder="Suất, Chai, Kg, Vé, Lần..."
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
              step="1000"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              required
            />
          </div>

          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--hc-surface-variant, #f8fafc)', borderRadius: '8px', border: '1px solid var(--hc-border, #e2e8f0)' }}>
            <label className="hc-switch" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <span style={{ fontWeight: 600, color: form.active ? 'var(--hc-success, #16a34a)' : 'var(--hc-error, #dc2626)' }}>
                {form.active ? '✓ Cho phép gọi dịch vụ này (Đang sẵn sàng)' : '✗ Tạm ngưng dịch vụ này (Khách không thể gọi)'}
              </span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
