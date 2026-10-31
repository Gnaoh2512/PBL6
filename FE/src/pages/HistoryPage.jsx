import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Modal from '../components/Modal';
import { apiCall, formatVND, formatDate, formatDateTime, getAuthUser } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function HistoryPage({ portal = false }) {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const authUser = getAuthUser();

  const [activeTab, setActiveTab] = useState(authUser ? 'MEMBER' : 'PHONE');
  const [phoneInput, setPhoneInput] = useState(authUser?.phone || '');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Folio Detail Modal
  const [selectedBookingCode, setSelectedBookingCode] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (authUser && activeTab === 'MEMBER') {
      loadMemberHistory();
    }
  }, [activeTab]);

  const loadPhoneHistory = async () => {
    if (!phoneInput.trim()) {
      addToast('Vui lòng nhập số điện thoại để tra cứu!', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall(`/api/public/history/lookup?phone=${encodeURIComponent(phoneInput.trim())}`);
      if (res && res.success) {
        setBookings(res.data || []);
        if (res.data.length === 0) {
          addToast('Không tìm thấy đơn đặt phòng nào với số điện thoại này', 'info');
        }
      } else {
        setBookings([]);
      }
    } catch (err) {
      setBookings([]);
      addToast(err.message || 'Lỗi tra cứu đơn đặt phòng', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMemberHistory = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/customer/bookings/history');
      if (res && res.success) {
        setBookings(res.data || []);
      } else {
        setBookings([]);
      }
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = async (code) => {
    setSelectedBookingCode(code);
    setDetailModalOpen(true);
    setLoadingDetail(true);

    try {
      let endpoint = '';
      if (activeTab === 'MEMBER') {
        endpoint = `/api/customer/bookings/history/${code}`;
      } else {
        endpoint = `/api/public/history/lookup/${code}?phone=${encodeURIComponent(phoneInput.trim())}`;
      }

      const res = await apiCall(endpoint);
      if (res && res.success) {
        setBookingDetail(res.data);
      } else {
        setBookingDetail(null);
      }
    } catch (err) {
      setBookingDetail(null);
      addToast(err.message || 'Không thể tải chi tiết đơn', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <>
      {!portal && <Navbar />}

      <main className="hc-page">
        <div className="hc-container">
          <div className="hc-page-title">
            <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
              <i className="bi bi-clock-history"></i> TRA CỨU ĐƠN & HÓA ĐƠN ĐIỆN TỬ
            </div>
            <h2>Lịch Sử Đặt Phòng & Tra Cứu Trạng Thái</h2>
            <p>Kiểm tra tình trạng đặt phòng, xem chi tiết hóa đơn lưu trú và mã thanh toán VietQR</p>
          </div>

          {/* Search Card */}
          <div className="hc-card" style={{ marginBottom: '32px' }}>
            <div className="hc-card-body">
              {authUser && (
                <div className="hc-tab-group">
                  <button
                    className={`hc-tab-btn ${activeTab === 'MEMBER' ? 'active' : ''}`}
                    onClick={() => setActiveTab('MEMBER')}
                  >
                    <i className="bi bi-person-check"></i> Đơn của tôi ({authUser.username})
                  </button>
                  <button
                    className={`hc-tab-btn ${activeTab === 'PHONE' ? 'active' : ''}`}
                    onClick={() => setActiveTab('PHONE')}
                  >
                    <i className="bi bi-telephone"></i> Tra cứu theo số điện thoại
                  </button>
                </div>
              )}

              {activeTab === 'PHONE' && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <label className="hc-label">Số điện thoại liên hệ</label>
                    <div style={{ position: 'relative' }}>
                      <i className="bi bi-telephone" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--hc-text-muted)' }}></i>
                      <input
                        type="tel"
                        className="hc-input"
                        style={{ paddingLeft: '38px' }}
                        placeholder="Nhập số điện thoại khi đặt phòng..."
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') loadPhoneHistory(); }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="hc-btn hc-btn-primary"
                    onClick={loadPhoneHistory}
                    disabled={loading}
                    style={{ minHeight: '44px' }}
                  >
                    {loading ? 'Đang tra cứu...' : 'Tìm kiếm đơn'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table of bookings */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="hc-card-title">
                <i className="bi bi-card-checklist text-primary" style={{ marginRight: '8px' }}></i>
                Danh Sách Đơn Đặt Phòng ({bookings.length})
              </div>
            </div>

            <div className="hc-card-body flush">
              {loading ? (
                <div className="hc-loading-spinner">
                  <div className="hc-spinner"></div>
                </div>
              ) : bookings.length === 0 ? (
                <div className="hc-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>Không có đơn đặt phòng nào được tìm thấy.</p>
                </div>
              ) : (
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Phòng</th>
                      <th>Thời gian lưu trú</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b.bookingCode || b.bookingId}>
                        <td>
                          <strong style={{ color: 'var(--hc-primary)' }}>{b.bookingCode}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--hc-text-muted)' }}>
                            Khách: {b.customerName || b.fullName}
                          </div>
                        </td>
                        <td>
                          <strong>Phòng {b.roomNumber || '---'}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--hc-text-muted)' }}>
                            {b.roomTypeName || ''}
                          </div>
                        </td>
                        <td>
                          <div>{formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}</div>
                          <div style={{ fontSize: '12px', color: 'var(--hc-text-muted)' }}>
                            {b.guestCount} khách
                          </div>
                        </td>
                        <td>
                          <strong>{formatVND(b.totalAmount)}</strong>
                          {b.depositAmount > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--hc-success)' }}>
                              Đã cọc: {formatVND(b.depositAmount)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`hc-badge hc-badge-booking-${b.status || 'PENDING'}`}>
                            {b.status || 'PENDING'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              onClick={() => openDetailModal(b.bookingCode)}
                            >
                              <i className="bi bi-eye"></i> Chi tiết
                            </button>
                            <button
                              type="button"
                              className="hc-btn hc-btn-secondary hc-btn-sm"
                              onClick={() => navigate(`/services?bookingCode=${b.bookingCode}`)}
                            >
                              <i className="bi bi-cup-hot"></i> Dịch vụ
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
        </div>
      </main>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Chi Tiết Đơn Đặt Phòng #${selectedBookingCode}`}
        maxWidth="600px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="hc-btn hc-btn-outline hc-btn-sm"
              onClick={() => setDetailModalOpen(false)}
            >
              Đóng
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={() => {
                setDetailModalOpen(false);
                navigate(`/services?bookingCode=${selectedBookingCode}`);
              }}
            >
              <i className="bi bi-receipt"></i> Mở Folio & Dịch Vụ
            </button>
          </div>
        }
      >
        {loadingDetail ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : !bookingDetail ? (
          <div className="hc-empty-state">
            <p>Không thể tải chi tiết đơn hàng này.</p>
          </div>
        ) : (
          <div style={{ fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className={`hc-badge hc-badge-booking-${bookingDetail.status || 'PENDING'}`} style={{ padding: '6px 14px', fontSize: '13px' }}>
                Trạng thái: {bookingDetail.status}
              </span>
              <span style={{ color: 'var(--hc-text-muted)', fontSize: '12px' }}>
                Tạo lúc: {formatDateTime(bookingDetail.createdAt)}
              </span>
            </div>

            <div style={{ background: 'var(--hc-bg)', padding: '16px', borderRadius: 'var(--hc-radius-md)', marginBottom: '16px', border: '1px solid var(--hc-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--hc-text-secondary)', fontSize: '12px' }}>Khách hàng:</span>
                  <div style={{ fontWeight: 600 }}>{bookingDetail.customerName || bookingDetail.fullName}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--hc-text-secondary)', fontSize: '12px' }}>Số điện thoại:</span>
                  <div style={{ fontWeight: 600 }}>{bookingDetail.phone || '---'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--hc-text-secondary)', fontSize: '12px' }}>Phòng nghỉ:</span>
                  <div style={{ fontWeight: 600 }}>Phòng {bookingDetail.roomNumber} ({bookingDetail.roomTypeName})</div>
                </div>
                <div>
                  <span style={{ color: 'var(--hc-text-secondary)', fontSize: '12px' }}>Thời gian:</span>
                  <div style={{ fontWeight: 600 }}>{formatDate(bookingDetail.checkInDate)} → {formatDate(bookingDetail.checkOutDate)}</div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--hc-border)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--hc-text-secondary)' }}>Tiền phòng:</span>
                <strong>{formatVND(bookingDetail.roomCharge || bookingDetail.totalAmount)}</strong>
              </div>
              {bookingDetail.serviceCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--hc-text-secondary)' }}>Dịch vụ phòng phát sinh:</span>
                  <strong>{formatVND(bookingDetail.serviceCharge)}</strong>
                </div>
              )}
              {bookingDetail.depositAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--hc-success)' }}>
                  <span>Tiền cọc đã thanh toán:</span>
                  <strong>- {formatVND(bookingDetail.depositAmount)}</strong>
                </div>
              )}
              <hr className="hc-divider" style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px' }}>
                <span>Tổng chi phí:</span>
                <span style={{ color: 'var(--hc-primary)' }}>{formatVND(bookingDetail.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {!portal && <Footer />}
    </>
  );
}
