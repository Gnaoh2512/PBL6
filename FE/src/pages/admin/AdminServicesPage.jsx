import React, { useState, useEffect, useCallback } from "react";
import Modal from "../../components/Modal";
import SelectMenu from "../../components/SelectMenu";
import { apiCall, formatVND, getCategoryName } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";

export default function AdminServicesPage() {
  const { addToast } = useToast();

  const [services, setServices] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Create/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editServiceId, setEditServiceId] = useState(null);
  const [form, setForm] = useState({
    serviceName: "",
    unit: "Lần",
    unitPrice: 50000,
    categoryId: "",
    categoryName: "",
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [servicesRes, categoriesRes] = await Promise.all([apiCall("/api/admin/services", { silentError: true }), apiCall("/api/admin/services/categories", { silentError: true })]);

      if (servicesRes && servicesRes.success) {
        setServices(servicesRes.data || []);
      }

      if (categoriesRes && categoriesRes.success && Array.isArray(categoriesRes.data) && categoriesRes.data.length > 0) {
        setCategoriesList(categoriesRes.data);
      } else {
        // Fallback standard categories
        setCategoriesList([
          { categoryId: 1, categoryName: "Ẩm thực & Đồ uống (F&B)" },
          { categoryId: 2, categoryName: "Dịch vụ phòng & Giặt ủi" },
          { categoryId: 3, categoryName: "Thư giãn & Spa" },
          { categoryId: 4, categoryName: "Đưa đón & Phương tiện" },
          { categoryId: 5, categoryName: "Tiện ích & Khác" },
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
      serviceName: "",
      unit: "Lần",
      unitPrice: 50000,
      categoryId: defaultCat ? String(defaultCat.categoryId) : "1",
      categoryName: defaultCat ? defaultCat.categoryName : "Ẩm thực & Đồ uống (F&B)",
      active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (service) => {
    setEditServiceId(service.serviceId);
    const catId = service.category?.categoryId || service.categoryId || "";
    const catName = getCategoryName(service.category);
    setForm({
      serviceName: service.serviceName || "",
      unit: service.unit || "Lần",
      unitPrice: service.unitPrice || 0,
      categoryId: catId ? String(catId) : "",
      categoryName: catName,
      active: isServiceActive(service),
    });
    setModalOpen(true);
  };

  const handleToggleStatus = async (service) => {
    const sId = service.serviceId;
    const currentStatus = isServiceActive(service);
    setTogglingId(sId);
    try {
      const res = await apiCall(`/api/admin/services/${sId}/toggle`, {
        method: "PATCH",
      });
      if (res && res.success) {
        addToast(`Đã ${currentStatus ? "tắt" : "bật"} cho phép gọi dịch vụ "${service.serviceName}"!`, "success");
        loadData();
      } else {
        // Fallback to PUT
        const payload = {
          serviceName: service.serviceName,
          unit: service.unit || "Lần",
          unitPrice: service.unitPrice || 0,
          categoryId: service.category?.categoryId || null,
          isActive: !currentStatus,
        };
        await apiCall(`/api/admin/services/${sId}`, {
          method: "PUT",
          body: payload,
        });
        addToast(`Đã ${currentStatus ? "tắt" : "bật"} cho phép gọi dịch vụ "${service.serviceName}"!`, "success");
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi cập nhật trạng thái dịch vụ", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!form.serviceName.trim() || form.unitPrice < 0) {
      addToast("Vui lòng điền tên dịch vụ và đơn giá hợp lệ!", "warning");
      return;
    }

    setSubmitting(true);
    const selectedCatId = form.categoryId ? parseInt(form.categoryId, 10) : null;
    const foundCat = categoriesList.find((c) => c.categoryId === selectedCatId);

    const payload = {
      serviceName: form.serviceName.trim(),
      unit: form.unit.trim() || "Lần",
      unitPrice: parseFloat(form.unitPrice) || 0,
      categoryId: selectedCatId,
      categoryName: foundCat ? foundCat.categoryName : form.categoryName || undefined,
      isActive: Boolean(form.active),
      active: Boolean(form.active),
    };

    try {
      let res;
      if (editServiceId) {
        res = await apiCall(`/api/admin/services/${editServiceId}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        res = await apiCall("/api/admin/services", {
          method: "POST",
          body: payload,
        });
      }

      if (res && res.success) {
        addToast(`${editServiceId ? "Cập nhật" : "Thêm"} dịch vụ thành công!`, "success");
        setModalOpen(false);
        loadData();
      }
    } catch (err) {
      addToast(err.message || "Lỗi lưu dịch vụ", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Build filter options
  const filterCategories = ["ALL", ...new Set([...categoriesList.map((c) => c.categoryName), ...services.map((s) => getCategoryName(s.category)).filter((c) => c && c !== "Khác")])];

  const categoryFilterOptions = filterCategories.map((c) => ({
    value: c,
    label: c === "ALL" ? "Tất cả danh mục" : c,
  }));

  const categoryFormOptions = categoriesList.map((c) => ({
    value: String(c.categoryId),
    label: c.categoryName,
  }));

  const filteredServices = services.filter((s) => {
    const sCat = getCategoryName(s.category);
    const matchCategory = categoryFilter === "ALL" || sCat === categoryFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || (s.serviceName && s.serviceName.toLowerCase().includes(query));
    return matchCategory && matchSearch;
  });

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", textAlign: "left" }}>
        <div>
          <h2>Danh Mục Dịch Vụ</h2>
          <p>Quản lý dịch vụ, đơn giá và trạng thái phục vụ.</p>
        </div>

        <button type="button" className="hc-btn hc-btn-primary" onClick={openCreateModal}>
          <i className="bi bi-plus-lg"></i> Thêm Dịch Vụ Mới
        </button>
      </div>

      <div className="hc-card">
        <div className="hc-card-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--hc-border-light)" }}>
          <input
            type="search"
            className="hc-input"
            style={{ flex: "1 1 280px" }}
            placeholder="Tìm theo tên dịch vụ..."
            aria-label="Tìm dịch vụ"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div style={{ flex: "0 0 240px" }}>
            <SelectMenu value={categoryFilter} onChange={setCategoryFilter} options={categoryFilterOptions} ariaLabel="Lọc danh mục" icon="bi-funnel" />
          </div>
        </div>

        {loading ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="hc-empty-state">
            <i className="bi bi-cup"></i>
            <p>Không tìm thấy dịch vụ nào.</p>
          </div>
        ) : (
          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Tên dịch vụ</th>
                  <th>Danh mục</th>
                  <th>Đơn vị tính</th>
                  <th>Đơn giá</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((s) => {
                  const active = isServiceActive(s);
                  const catName = getCategoryName(s.category);
                  const isToggling = togglingId === s.serviceId;

                  return (
                    <tr key={s.serviceId}>
                      <td>
                        <strong>{s.serviceName}</strong>
                      </td>
                      <td>
                        <span className={`hc-badge ${catName !== "Khác" ? "hc-badge-primary" : "hc-badge-muted"}`}>{catName}</span>
                      </td>
                      <td>{s.unit || "Lần"}</td>
                      <td>
                        <strong>{formatVND(s.unitPrice)}</strong>
                      </td>
                      <td>
                        <span className={`hc-badge ${active ? "hc-badge-success" : "hc-badge-muted"}`}>{active ? "Sẵn sàng" : "Tạm ngưng"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                          <button
                            type="button"
                            className={`hc-btn hc-btn-sm ${active ? "hc-btn-outline" : "hc-btn-primary"}`}
                            style={{ minWidth: "92px" }}
                            onClick={() => handleToggleStatus(s)}
                            disabled={isToggling}
                            title={active ? "Tắt không cho phép khách gọi" : "Bật cho phép khách gọi"}
                          >
                            {isToggling ? (
                              "Đang xử lý..."
                            ) : active ? (
                              <>
                                <i className="bi bi-pause-circle"></i> Tắt gọi
                              </>
                            ) : (
                              <>
                                <i className="bi bi-play-circle"></i> Cho phép
                              </>
                            )}
                          </button>

                          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => openEditModal(s)}>
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editServiceId ? "Chỉnh Sửa Dịch Vụ" : "Thêm Dịch Vụ Mới"}
        subtitle={editServiceId ? `Cập nhật thông tin ${form.serviceName}` : "Khai báo dịch vụ mới trong hệ thống"}
        icon={editServiceId ? "bi-pencil-square" : "bi-cup-hot"}
        maxWidth="540px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSaveService} disabled={submitting}>
              {submitting ? "Đang lưu..." : editServiceId ? "Lưu thông tin" : "Thêm dịch vụ"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveService}>
          <div className="hc-form-group">
            <label className="hc-label">
              Tên dịch vụ <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input
              type="text"
              className="hc-input"
              placeholder="ví dụ: Bữa sáng Buffet, Giặt ủi vest..."
              value={form.serviceName}
              onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div className="hc-form-group">
              <label className="hc-label">
                Danh mục dịch vụ <span style={{ color: "var(--hc-error)" }}>*</span>
              </label>
              <SelectMenu
                value={form.categoryId}
                onChange={(val) => {
                  const cat = categoriesList.find((c) => String(c.categoryId) === String(val));
                  setForm({
                    ...form,
                    categoryId: val,
                    categoryName: cat ? cat.categoryName : "",
                  });
                }}
                options={categoryFormOptions}
                ariaLabel="Danh mục dịch vụ"
                icon="bi-tag"
              />
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Đơn vị tính</label>
              <input type="text" className="hc-input" placeholder="Suất, Chai, Kg, Vé, Lần..." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">
              Đơn giá (VNĐ) <span style={{ color: "var(--hc-error)" }}>*</span>
            </label>
            <input type="number" className="hc-input" min="0" step="1000" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required />
          </div>

          <div style={{ marginTop: "16px" }}>
            <label className="hc-switch">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>Cho phép gọi dịch vụ này</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
