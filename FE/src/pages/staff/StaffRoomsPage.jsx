import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { apiCall, formatVND, formatDate, getRoomTypeName } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

export default function StaffRoomsPage() {
  const { addToast } = useToast();
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || (hasRole(['HOUSEKEEPING']) ? 'CLEANING' : 'ALL'));
  const [floorFilter, setFloorFilter] = useState('ALL');

  // Selected Room Modal
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('INFO'); // INFO | SERVICE | CHECKOUT | CANCEL

  // Action form states
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceQty, setServiceQty] = useState(1);
  const [serviceNote, setServiceNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [roomsRes, bookingsRes, servicesRes] = await Promise.all([
        apiCall('/api/admin/rooms', { silentError: true }),
        apiCall('/api/staff/bookings', { silentError: true }),
        apiCall('/api/public/services', { silentError: true })
      ]);

      if (roomsRes && roomsRes.success) setRooms(roomsRes.data || []);
      if (bookingsRes && bookingsRes.success) setBookings(bookingsRes.data || []);
      if (servicesRes && servicesRes.success) setServices(servicesRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const getRoomBooking = (roomId) => {
    return bookings.find(b => 
      String(b.roomId) === String(roomId) && 
      (b.status === 'CHECKED_IN' || b.status === 'CONFIRMED' || b.status === 'PENDING')
    );
  };

  const floors = ['ALL', ...Array.from(new Set(rooms.map(r => r.floor).filter(Boolean))).sort((a,b) => a-b)];

  const filteredRooms = rooms.filter(r => {
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchFloor = floorFilter === 'ALL' || String(r.floor) === String(floorFilter);
    return matchStatus && matchFloor;
  });

  const handleRoomClick = (room) => {
    setSelectedRoom(room);
    setActiveTab('INFO');
    setModalOpen(true);
  };

  // Quick Status Toggle (Clean, Maintenance, Available)
  const handleUpdateRoomStatus = async (newStatus) => {
    if (!selectedRoom) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/api/admin/rooms/${selectedRoom.roomId}/status?status=${newStatus}`, {
        method: 'PATCH'
      });
      if (res && res.success) {
        addToast(`Đã chuyển trạng thái phòng ${selectedRoom.roomNumber} sang ${newStatus}!`, 'success');
        setModalOpen(false);
        loadAllData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi cập nhật trạng thái phòng', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Check-in guest
  const handleCheckIn = async (bookingCode) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/api/staff/billing/bookings/${bookingCode}/check-in`, { method: 'POST' });
      if (res && res.success) {
        addToast(`Check-in phòng thành công cho đơn ${bookingCode}!`, 'success');
        setModalOpen(false);
        loadAllData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi check-in', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm deposit
  const handleConfirmDeposit = async (bookingCode) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/api/staff/bookings/${bookingCode}/confirm-deposit`, { method: 'POST' });
      if (res && res.success) {
        addToast(`Đã xác nhận tiền cọc thành công cho đơn ${bookingCode}!`, 'success');
        setModalOpen(false);
        loadAllData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi xác nhận tiền cọc', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Order service to room
  const handleOrderService = async (bookingCode) => {
    if (!selectedServiceId) {
      addToast('Vui lòng chọn dịch vụ cần thêm!', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(`/api/staff/billing/bookings/${bookingCode}/order-service`, {
        method: 'POST',
        body: {
          serviceId: parseInt(selectedServiceId),
          quantity: parseInt(serviceQty) || 1,
          note: serviceNote.trim() || null
        }
      });
      if (res && res.success) {
        addToast('Đã thêm dịch vụ vào hóa đơn phòng thành công!', 'success');
        setModalOpen(false);
        loadAllData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi ghi nhận dịch vụ', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Settle and checkout
  const handleSettleCheckout = async (bookingCode) => {
    if (!window.confirm(`Xác nhận thanh toán toàn bộ chi phí và làm thủ tục trả phòng cho đơn ${bookingCode}?`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(`/api/staff/billing/bookings/${bookingCode}/settle-and-checkout`, {
        method: 'POST'
      });
      if (res && res.success) {
        addToast(`Quyết toán và check-out thành công cho đơn ${bookingCode}!`, 'success');
        setModalOpen(false);
        loadAllData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi quyết toán trả phòng', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel with refund
  const handleCancelWithRefund = async (bookingCode) => {
    if (!cancelReason.trim()) {
      addToast('Vui lòng nhập lý do hủy phòng!', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiCall(`/api/staff/billing/bookings/${bookingCode}/cancel-with-refund?reason=${encodeURIComponent(cancelReason)}`, {
        method: 'POST'
      });
      if (res && res.success) {
        addToast('Đã hủy đơn và hoàn tiền cọc thành công!', 'success');
        setModalOpen(false);
        loadAllData();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi hủy đơn', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'available';
      case 'OCCUPIED': return 'occupied';
      case 'CLEANING': return 'cleaning';
      case 'MAINTENANCE': return 'maintenance';
      default: return 'available';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'Trống';
      case 'OCCUPIED': return 'Đang ở';
      case 'CLEANING': return 'Đang dọn';
      case 'MAINTENANCE': return 'Bảo trì';
      default: return status;
    }
  };

  const currentBooking = selectedRoom ? getRoomBooking(selectedRoom.roomId) : null;

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-grid-3x3-gap-fill"></i> LỄ TÂN & BUỒNG PHÒNG
          </div>
          <h2>Sơ Đồ Phòng Trực Quan & Quyết Toán (Room Matrix)</h2>
          <p>Bấm trực tiếp vào từng phòng để Check-in, gọi dịch vụ phát sinh hoặc quyết toán Check-out</p>
        </div>

        <button type="button" className="hc-btn hc-btn-outline" onClick={loadAllData}>
          <i className="bi bi-arrow-clockwise"></i> Làm mới sơ đồ
        </button>
      </div>

      {/* Legend & Filter Card */}
      <div className="hc-card" style={{ marginBottom: '24px' }}>
        <div className="hc-card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Status Color Legend */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#e8f5ef', border: '1.5px solid var(--hc-success)' }}></span>
              <span>Trống ({rooms.filter(r => r.status === 'AVAILABLE').length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#fdecea', border: '1.5px solid var(--hc-error)' }}></span>
              <span>Đang ở ({rooms.filter(r => r.status === 'OCCUPIED').length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'var(--hc-warning-bg)', border: '1.5px solid var(--hc-warning)' }}></span>
              <span>Đang dọn ({rooms.filter(r => r.status === 'CLEANING').length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'var(--hc-bg-alt)', border: '1.5px solid var(--hc-text-muted)' }}></span>
              <span>Bảo trì ({rooms.filter(r => r.status === 'MAINTENANCE').length})</span>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              className="hc-select"
              style={{ minWidth: '140px', padding: '6px 12px', fontSize: '13px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="AVAILABLE">Phòng trống</option>
              <option value="OCCUPIED">Đang có khách</option>
              <option value="CLEANING">Đang dọn dẹp</option>
              <option value="MAINTENANCE">Bảo trì</option>
            </select>

            <select
              className="hc-select"
              style={{ minWidth: '120px', padding: '6px 12px', fontSize: '13px' }}
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
            >
              <option value="ALL">Tất cả tầng</option>
              {floors.filter(f => f !== 'ALL').map(f => (
                <option key={f} value={f}>Tầng {f}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Room Matrix Grid */}
      {loading ? (
        <div className="hc-loading-spinner">
          <div className="hc-spinner"></div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="hc-card">
          <div className="hc-empty-state">
            <i className="bi bi-door-closed"></i>
            <p>Không có phòng nào phù hợp với bộ lọc.</p>
          </div>
        </div>
      ) : (
        <div className="hc-card" style={{ padding: '24px' }}>
          <div className="hc-room-matrix">
            {filteredRooms.map(room => {
              const booking = getRoomBooking(room.roomId);
              return (
                <div
                  key={room.roomId}
                  className={`hc-room-cell ${getStatusClass(room.status)}`}
                  onClick={() => handleRoomClick(room)}
                  title={`Phòng ${room.roomNumber} - ${getRoomTypeName(room)} (${getStatusText(room.status)})`}
                >
                  <div className="hc-room-cell-number">{room.roomNumber}</div>
                  <div className="hc-room-cell-status">{getStatusText(room.status)}</div>
                  {booking && (
                    <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95px' }}>
                      {booking.customerName || booking.fullName}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Room Action Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedRoom ? `Thao Tác Phòng #${selectedRoom.roomNumber} (${getRoomTypeName(selectedRoom)})` : 'Chi Tiết Phòng'}
        maxWidth="560px"
        footer={
          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setModalOpen(false)}>
            Đóng
          </button>
        }
      >
        {selectedRoom && (
          <div>
            {/* Quick Status Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'var(--hc-bg)', padding: '10px 14px', borderRadius: 'var(--hc-radius-md)', border: '1px solid var(--hc-border)' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--hc-text-secondary)' }}>Trạng thái hiện tại:</span>
                <div style={{ fontWeight: 700, color: 'var(--hc-primary)' }}>{getStatusText(selectedRoom.status)}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="hc-btn hc-btn-outline hc-btn-sm"
                  onClick={() => handleUpdateRoomStatus('AVAILABLE')}
                  disabled={actionLoading}
                >
                  Trống
                </button>
                <button
                  type="button"
                  className="hc-btn hc-btn-outline hc-btn-sm"
                  onClick={() => handleUpdateRoomStatus('CLEANING')}
                  disabled={actionLoading}
                >
                  Dọn dẹp
                </button>
                <button
                  type="button"
                  className="hc-btn hc-btn-outline hc-btn-sm"
                  onClick={() => handleUpdateRoomStatus('MAINTENANCE')}
                  disabled={actionLoading}
                >
                  Bảo trì
                </button>
              </div>
            </div>

            {/* If Room has Active Booking */}
            {currentBooking ? (
              <div>
                <div className="hc-tab-group" style={{ marginBottom: '16px' }}>
                  <button
                    className={`hc-tab-btn ${activeTab === 'INFO' ? 'active' : ''}`}
                    onClick={() => setActiveTab('INFO')}
                  >
                    <i className="bi bi-info-circle"></i> Thông tin đơn
                  </button>
                  <button
                    className={`hc-tab-btn ${activeTab === 'SERVICE' ? 'active' : ''}`}
                    onClick={() => setActiveTab('SERVICE')}
                  >
                    <i className="bi bi-cup-hot"></i> Thêm dịch vụ
                  </button>
                  <button
                    className={`hc-tab-btn ${activeTab === 'CHECKOUT' ? 'active' : ''}`}
                    onClick={() => setActiveTab('CHECKOUT')}
                  >
                    <i className="bi bi-box-arrow-right"></i> Quyết toán / Check-out
                  </button>
                  <button
                    className={`hc-tab-btn ${activeTab === 'CANCEL' ? 'active' : ''}`}
                    onClick={() => setActiveTab('CANCEL')}
                  >
                    <i className="bi bi-x-circle"></i> Hủy & Hoàn cọc
                  </button>
                </div>

                {activeTab === 'INFO' && (
                  <div>
                    <div style={{ background: 'var(--hc-primary-subtle)', padding: '14px', borderRadius: 'var(--hc-radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--hc-primary)', fontWeight: 700 }}>Mã đơn: {currentBooking.bookingCode}</span>
                        <span className={`hc-badge hc-badge-booking-${currentBooking.status}`}>{currentBooking.status}</span>
                      </div>
                      <div style={{ marginBottom: '4px' }}>Khách hàng: <strong>{currentBooking.customerName || currentBooking.fullName}</strong></div>
                      <div style={{ marginBottom: '4px' }}>Số điện thoại: <strong>{currentBooking.phone || '---'}</strong></div>
                      <div style={{ marginBottom: '4px' }}>Lưu trú: <strong>{formatDate(currentBooking.checkInDate)} → {formatDate(currentBooking.checkOutDate)}</strong></div>
                      <div>Tổng tiền: <strong>{formatVND(currentBooking.totalAmount)}</strong> (Cọc: {formatVND(currentBooking.depositAmount || 0)})</div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {currentBooking.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          className="hc-btn hc-btn-primary"
                          onClick={() => handleCheckIn(currentBooking.bookingCode)}
                          disabled={actionLoading}
                        >
                          <i className="bi bi-box-arrow-in-right"></i> Nhận phòng ngay (Check-in)
                        </button>
                      )}

                      {currentBooking.status === 'PENDING' && (
                        <button
                          type="button"
                          className="hc-btn hc-btn-secondary"
                          onClick={() => handleConfirmDeposit(currentBooking.bookingCode)}
                          disabled={actionLoading}
                        >
                          <i className="bi bi-check2-circle"></i> Xác nhận đã nhận tiền cọc
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'SERVICE' && (
                  <div>
                    <div className="hc-form-group">
                      <label className="hc-label">Chọn dịch vụ phát sinh</label>
                      <select
                        className="hc-select"
                        value={selectedServiceId}
                        onChange={(e) => setSelectedServiceId(e.target.value)}
                      >
                        <option value="">-- Chọn món / dịch vụ --</option>
                        {services.map(s => (
                          <option key={s.serviceId} value={s.serviceId}>
                            {s.serviceName} - {formatVND(s.unitPrice)}/{s.unit || 'Lần'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hc-form-group">
                      <label className="hc-label">Số lượng</label>
                      <input
                        type="number"
                        className="hc-input"
                        min="1"
                        max="20"
                        value={serviceQty}
                        onChange={(e) => setServiceQty(e.target.value)}
                      />
                    </div>

                    <div className="hc-form-group">
                      <label className="hc-label">Ghi chú phục vụ</label>
                      <input
                        type="text"
                        className="hc-input"
                        placeholder="Yêu cầu riêng của khách..."
                        value={serviceNote}
                        onChange={(e) => setServiceNote(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="hc-btn hc-btn-primary"
                      onClick={() => handleOrderService(currentBooking.bookingCode)}
                      disabled={actionLoading}
                      style={{ width: '100%' }}
                    >
                      {actionLoading ? 'Đang thêm...' : 'Ghi nhận vào Folio phòng →'}
                    </button>
                  </div>
                )}

                {activeTab === 'CHECKOUT' && (
                  <div>
                    <div className="hc-alert hc-alert-warning" style={{ fontSize: '13px' }}>
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      <div>
                        Thao tác này sẽ quyết toán toàn bộ số tiền còn lại (Balance Due) vào doanh thu ca trực hiện tại, hoàn tất thủ tục và chuyển phòng sang trạng thái <strong>ĐANG DỌN (CLEANING)</strong>.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="hc-btn hc-btn-danger hc-btn-lg"
                      onClick={() => handleSettleCheckout(currentBooking.bookingCode)}
                      disabled={actionLoading}
                      style={{ width: '100%' }}
                    >
                      <i className="bi bi-cash-stack"></i> Quyết Toán & Check-out Ngay
                    </button>
                  </div>
                )}

                {activeTab === 'CANCEL' && (
                  <div>
                    <div className="hc-form-group">
                      <label className="hc-label">Lý do hủy phòng</label>
                      <textarea
                        className="hc-textarea"
                        rows="3"
                        placeholder="Khách hủy do việc đột xuất..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                      ></textarea>
                    </div>

                    <button
                      type="button"
                      className="hc-btn hc-btn-danger"
                      onClick={() => handleCancelWithRefund(currentBooking.bookingCode)}
                      disabled={actionLoading}
                      style={{ width: '100%' }}
                    >
                      Xác Nhận Hủy & Hoàn Cọc
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--hc-text-muted)' }}>
                <i className="bi bi-door-open fs-1 d-block mb-2"></i>
                <p>Phòng hiện không có khách hoặc chưa có đơn đặt phòng nào đang kích hoạt.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
