import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Modal from '../components/Modal';
import { apiCall, formatVND, formatDateTime, getCategoryName } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function ServicesPage() {
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const queryCode = searchParams.get('bookingCode') || '';
  const [bookingCode, setBookingCode] = useState(queryCode);
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loadingServices, setLoadingServices] = useState(true);

  // Folio state
  const [folio, setFolio] = useState(null);
  const [loadingFolio, setLoadingFolio] = useState(false);

  // Order modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [orderNote, setOrderNote] = useState('');
  const [ordering, setOrdering] = useState(false);

  const loadFolio = useCallback(async (code = bookingCode) => {
    const trimmed = (code || '').trim().toUpperCase();
    if (!trimmed) {
      addToast('Vui lòng nhập Mã đơn đặt phòng!', 'warning');
      return;
    }

    setLoadingFolio(true);
    try {
      const res = await apiCall(`/api/public/bookings/${trimmed}/folio`);
      if (res && res.success) {
        setFolio(res.data);
      } else {
        setFolio(null);
        addToast(res ? res.message : 'Không tìm thấy hóa đơn lưu trú', 'error');
      }
    } catch (err) {
      setFolio(null);
      addToast(err.message || 'Không tìm thấy hóa đơn', 'error');
    } finally {
      setLoadingFolio(false);
    }
  }, [bookingCode, addToast]);

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await apiCall('/api/public/services', { silentError: true });
        if (res && res.success) {
          setServices(res.data || []);
        }
      } catch {
        // silent
      } finally {
        setLoadingServices(false);
      }
    }
    loadServices();

    if (queryCode) {
      loadFolio(queryCode);
    }
  }, [queryCode, loadFolio]);

  const categories = ['ALL', ...Array.from(new Set(services.map(s => getCategoryName(s.category)).filter(Boolean)))];

  const filteredServices = services.filter(s => {
    if (selectedCategory === 'ALL') return true;
    return getCategoryName(s.category) === selectedCategory;
  });

  const handleOpenOrder = (s) => {
    if (!bookingCode.trim()) {
      addToast('Vui lòng nhập Mã đặt phòng trước khi gọi dịch vụ!', 'warning');
      return;
    }
    setSelectedService(s);
    setQuantity(1);
    setOrderNote('');
    setOrderModalOpen(true);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!selectedService || !bookingCode.trim()) return;

    setOrdering(true);
    try {
      const res = await apiCall('/api/public/services/order', {
        method: 'POST',
        body: {
          bookingCode: bookingCode.trim().toUpperCase(),
          serviceId: selectedService.serviceId,
          quantity: parseInt(quantity) || 1,
          note: orderNote.trim() || null
        }
      });

      if (res && res.success) {
        addToast(`Đã thêm dịch vụ "${selectedService.serviceName}" vào phòng thành công!`, 'success');
        setOrderModalOpen(false);
        loadFolio(bookingCode);
      }
    } catch (err) {
      addToast(err.message || 'Lỗi đặt dịch vụ', 'error');
    } finally {
      setOrdering(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="hc-page">
        <div className="hc-container">
          <div className="hc-page-title">
            <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
              <i className="bi bi-bell-fill"></i> DỊCH VỤ PHÒNG & HÓA ĐƠN TRỰC TIẾP
            </div>
            <h2>Dịch Vụ Lưu Trú & Hóa Đơn Trực Tiếp (Live Folio)</h2>
            <p>Gọi món ăn, nước uống, giặt ủi và theo dõi chi tiết hóa đơn phòng theo thời gian thực</p>
          </div>

          {/* Booking code input bar */}
          <div className="hc-card" style={{ marginBottom: '32px' }}>
            <div className="hc-card-body">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <label className="hc-label">Mã đơn đặt phòng (Booking Code)</label>
                  <div style={{ position: 'relative' }}>
                    <i className="bi bi-search" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--hc-text-muted)' }}></i>
                    <input
                      type="text"
                      className="hc-input"
                      style={{ paddingLeft: '38px', textTransform: 'uppercase' }}
                      placeholder="Ví dụ: BK-20261012-ABCD"
                      value={bookingCode}
                      onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') loadFolio(); }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="hc-btn hc-btn-primary"
                  onClick={() => loadFolio()}
                  disabled={loadingFolio}
                  style={{ minHeight: '44px' }}
                >
                  {loadingFolio ? 'Đang tải...' : 'Xem hóa đơn phòng'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(360px, 1fr)', gap: '32px' }}>
            {/* Left: Services Menu */}
            <div>
              <div className="hc-card">
                <div className="hc-card-header">
                  <div className="hc-card-title">
                    <i className="bi bi-card-list text-primary" style={{ marginRight: '8px' }}></i>
                    Menu Dịch Vụ Khách Sạn
                  </div>
                  <span className="hc-badge hc-badge-primary">
                    {filteredServices.length} dịch vụ
                  </span>
                </div>

                <div className="hc-card-body">
                  {/* Category Filter Pills */}
                  {categories.length > 1 && (
                    <div className="hc-tab-group">
                      {categories.map(c => (
                        <button
                          key={c}
                          className={`hc-tab-btn ${selectedCategory === c ? 'active' : ''}`}
                          onClick={() => setSelectedCategory(c)}
                        >
                          {c === 'ALL' ? 'Tất cả' : c}
                        </button>
                      ))}
                    </div>
                  )}

                  {loadingServices ? (
                    <div className="hc-loading-spinner">
                      <div className="hc-spinner"></div>
                    </div>
                  ) : filteredServices.length === 0 ? (
                    <div className="hc-empty-state">
                      <i className="bi bi-cup-hot"></i>
                      <p>Chưa có dịch vụ nào trong danh mục này.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {filteredServices.map(s => (
                        <div
                          key={s.serviceId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '14px 16px',
                            background: 'var(--hc-bg)',
                            borderRadius: 'var(--hc-radius-md)',
                            border: '1px solid var(--hc-border)'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--hc-text)', fontSize: '15px' }}>
                              {s.serviceName}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--hc-text-muted)' }}>
                              Đơn vị: {s.unit || 'Lần'} {getCategoryName(s.category) ? `• ${getCategoryName(s.category)}` : ''}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--hc-secondary-dark)', marginTop: '4px' }}>
                              {formatVND(s.unitPrice)}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            onClick={() => handleOpenOrder(s)}
                          >
                            <i className="bi bi-plus-lg"></i> Thêm vào phòng
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Live Folio Breakdown */}
            <div>
              <div className="hc-card">
                <div className="hc-card-header">
                  <div className="hc-card-title">
                    <i className="bi bi-receipt text-primary" style={{ marginRight: '8px' }}></i>
                    Bảng Kê Hóa Đơn (Live Folio)
                  </div>
                  {folio && (
                    <button
                      type="button"
                      className="hc-btn hc-btn-ghost hc-btn-sm"
                      onClick={() => loadFolio()}
                      title="Làm mới hóa đơn"
                    >
                      <i className="bi bi-arrow-clockwise"></i> Làm mới
                    </button>
                  )}
                </div>

                <div className="hc-card-body">
                  {!folio ? (
                    <div className="hc-empty-state">
                      <i className="bi bi-receipt-cutoff"></i>
                      <h4>Chưa chọn đơn đặt phòng</h4>
                      <p style={{ maxWidth: '320px', margin: '0 auto' }}>
                        Vui lòng nhập Mã đơn đặt phòng ở phía trên và bấm "Xem hóa đơn phòng" để tải bảng kê chi phí thời gian thực.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Booking meta banner */}
                      <div style={{ background: 'var(--hc-primary-subtle)', padding: '14px 16px', borderRadius: 'var(--hc-radius-md)', marginBottom: '16px', border: '1px solid var(--hc-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--hc-primary)', fontSize: '15px' }}>
                            {folio.bookingCode}
                          </span>
                          <span className={`hc-badge hc-badge-booking-${folio.bookingStatus || 'CONFIRMED'}`}>
                            {folio.bookingStatus || 'LƯU TRÚ'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--hc-text-secondary)' }}>
                          Khách hàng: <strong style={{ color: 'var(--hc-text)' }}>{folio.customerName || '---'}</strong>
                          <span style={{ margin: '0 8px' }}>|</span>
                          Phòng: <strong style={{ color: 'var(--hc-text)' }}>{folio.roomNumber || '---'}</strong>
                        </div>
                      </div>

                      {/* Services incurred list */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--hc-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Dịch Vụ Phát Sinh:
                        </div>
                        {(!folio.serviceUsages || folio.serviceUsages.length === 0) ? (
                          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--hc-text-muted)', fontSize: '13px', background: 'var(--hc-bg)', borderRadius: 'var(--hc-radius-sm)' }}>
                            Chưa có dịch vụ phát sinh nào
                          </div>
                        ) : (
                          <table className="hc-table" style={{ fontSize: '13px' }}>
                            <thead>
                              <tr>
                                <th>Dịch vụ</th>
                                <th style={{ textAlign: 'center' }}>SL</th>
                                <th style={{ textAlign: 'right' }}>Đơn giá</th>
                                <th style={{ textAlign: 'right' }}>Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody>
                              {folio.serviceUsages.map((u, idx) => (
                                <tr key={u.usageId || idx}>
                                  <td>
                                    <strong>{u.serviceName}</strong>
                                    <div style={{ fontSize: '11px', color: 'var(--hc-text-muted)' }}>
                                      {formatDateTime(u.orderTime)}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>{u.quantity}</td>
                                  <td style={{ textAlign: 'right' }}>{formatVND(u.unitPrice)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatVND(u.totalAmount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Financial breakdown */}
                      <div style={{ borderTop: '1px solid var(--hc-border)', paddingTop: '16px', fontSize: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--hc-text-secondary)' }}>Tiền phòng:</span>
                          <strong>{formatVND(folio.roomCharge)}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--hc-text-secondary)' }}>Tiền dịch vụ:</span>
                          <strong>{formatVND(folio.serviceCharge)}</strong>
                        </div>

                        {folio.discountAmount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--hc-success)' }}>
                            <span>Giảm giá Voucher:</span>
                            <strong>- {formatVND(folio.discountAmount)}</strong>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--hc-text-secondary)' }}>Thuế GTGT (VAT 10%):</span>
                          <strong>{formatVND(folio.taxAmount)}</strong>
                        </div>

                        <hr className="hc-divider" style={{ margin: '10px 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 700 }}>
                          <span>Tổng chi phí:</span>
                          <span style={{ color: 'var(--hc-text)' }}>{formatVND(folio.totalAmount)}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', color: 'var(--hc-secondary-dark)' }}>
                          <span>Tiền cọc đã trả:</span>
                          <strong>- {formatVND(folio.depositApplied)}</strong>
                        </div>

                        <div style={{
                          background: 'var(--hc-error-bg)',
                          border: '1px solid #fecaca',
                          borderRadius: 'var(--hc-radius-md)',
                          padding: '14px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontWeight: 700, color: 'var(--hc-error)' }}>
                            Số tiền còn lại (Balance Due):
                          </span>
                          <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--hc-error)' }}>
                            {formatVND(folio.finalBalance ?? folio.balanceDue ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Order Service Modal */}
      <Modal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title="Thêm Dịch Vụ Vào Phòng"
        maxWidth="440px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="hc-btn hc-btn-outline hc-btn-sm"
              onClick={() => setOrderModalOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={handleSubmitOrder}
              disabled={ordering}
            >
              {ordering ? 'Đang gửi...' : 'Xác nhận đặt'}
            </button>
          </div>
        }
      >
        {selectedService && (
          <form onSubmit={handleSubmitOrder}>
            <div style={{ background: 'var(--hc-bg)', padding: '14px', borderRadius: 'var(--hc-radius-md)', marginBottom: '16px', border: '1px solid var(--hc-border)' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--hc-text)' }}>
                {selectedService.serviceName}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--hc-secondary-dark)', fontWeight: 600, marginTop: '4px' }}>
                {formatVND(selectedService.unitPrice)} / {selectedService.unit || 'Lần'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--hc-text-muted)', marginTop: '4px' }}>
                Phòng đặt: <strong>{bookingCode}</strong>
              </div>
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Số lượng</label>
              <input
                type="number"
                className="hc-input"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Ghi chú hoặc yêu cầu đặc biệt</label>
              <input
                type="text"
                className="hc-input"
                placeholder="Ví dụ: Giao lên phòng lúc 19h30..."
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>

      <Footer />
    </>
  );
}
