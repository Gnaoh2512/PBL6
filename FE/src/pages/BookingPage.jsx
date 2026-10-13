import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Modal from '../components/Modal';
import { apiCall, formatVND, getAuthUser } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const queryRoomId = searchParams.get('roomId') || '';
  const queryCheckIn = searchParams.get('checkIn') || '';
  const queryCheckOut = searchParams.get('checkOut') || '';
  const queryGuests = searchParams.get('guests') || '2';

  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(queryRoomId);
  const [checkInDate, setCheckInDate] = useState(() => queryCheckIn || getTodayStr());
  const [checkOutDate, setCheckOutDate] = useState(() => queryCheckOut || getTomorrowStr());
  const [guestCount, setGuestCount] = useState(queryGuests);

  const authUser = getAuthUser();
  const [fullName, setFullName] = useState(authUser?.fullName || '');
  const [phone, setPhone] = useState(authUser?.phone || '');
  const [email, setEmail] = useState(authUser?.email || '');
  const [nationality, setNationality] = useState('Việt Nam');
  const [idType, setIdType] = useState('CCCD');
  const [idNumber, setIdNumber] = useState('');
  const [note, setNote] = useState('');

  // Voucher
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Form submit & QR modal
  const [submitting, setSubmitting] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const pollingRef = useRef(null);

  const loadRooms = useCallback(async () => {
    try {
      const res = await apiCall('/api/public/rooms/available', {
        method: 'POST',
        body: { checkInDate, checkOutDate },
        silentError: true
      });
      if (res && res.success && res.data) {
        setAvailableRooms(res.data);
        if (queryRoomId && res.data.some(r => String(r.roomId) === String(queryRoomId))) {
          setSelectedRoomId(queryRoomId);
        } else if (res.data.length > 0 && !selectedRoomId) {
          setSelectedRoomId(String(res.data[0].roomId));
        }
      }
    } catch {
      // silent fallback
    }
  }, [checkInDate, checkOutDate, queryRoomId, selectedRoomId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const nights = Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)) || 1);
  const currentRoom = availableRooms.find(r => String(r.roomId) === String(selectedRoomId));
  const pricePerNight = currentRoom ? (currentRoom.basePrice || 500000) : 500000;
  const subtotal = pricePerNight * nights;
  const discountAmount = appliedVoucher ? (appliedVoucher.discountAmount || 0) : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const depositRequired = Math.round(finalTotal * 0.3);

  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim()) {
      addToast('Vui lòng nhập mã voucher', 'warning');
      return;
    }
    setVoucherLoading(true);
    try {
      const res = await apiCall('/api/public/vouchers/apply', {
        method: 'POST',
        body: {
          voucherCode: voucherCodeInput.trim().toUpperCase(),
          orderAmount: subtotal
        }
      });
      if (res && res.success) {
        setAppliedVoucher(res.data);
        addToast(`Áp dụng thành công voucher ${res.data.voucherCode}! Giảm ${formatVND(res.data.discountAmount)}`, 'success');
      }
    } catch (err) {
      setAppliedVoucher(null);
      addToast(err.message || 'Mã voucher không hợp lệ', 'error');
    } finally {
      setVoucherLoading(false);
    }
  };

  const startPollingPayment = (code) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiCall(`/api/public/bookings/${code}/payment-status`, { silentError: true });
        if (res && res.success && res.data && res.data.isPaid) {
          clearInterval(pollingRef.current);
          setPaymentSuccess(true);
          addToast('Thanh toán tiền cọc thành công! Đơn đặt phòng đã được xác nhận giữ chỗ!', 'success', 5000);
        }
      } catch {
        // silent polling
      }
    }, 3000);
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!selectedRoomId) {
      addToast('Vui lòng chọn phòng lưu trú!', 'warning');
      return;
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      addToast('Ngày trả phòng phải sau ngày nhận phòng!', 'error');
      return;
    }
    if (!fullName.trim() || !phone.trim()) {
      addToast('Vui lòng điền họ tên và số điện thoại liên hệ!', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      roomId: parseInt(selectedRoomId),
      checkInDate,
      checkOutDate,
      guestCount: parseInt(guestCount),
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      nationality: nationality || 'Việt Nam',
      idType,
      idNumber: idNumber.trim() || null,
      voucherCode: appliedVoucher ? appliedVoucher.voucherCode : (voucherCodeInput.trim() || null),
      note: note.trim() || null
    };

    try {
      const res = await apiCall('/api/public/bookings', {
        method: 'POST',
        body: payload
      });

      if (res && res.success) {
        setBookingData(res.data);
        setPaymentSuccess(false);
        setQrModalOpen(true);
        addToast('Tạo đơn đặt phòng thành công! Vui lòng quét mã VietQR để cọc giữ chỗ.', 'success');
        startPollingPayment(res.data.bookingCode);
      }
    } catch (err) {
      addToast(err.message || 'Lỗi tạo đơn đặt phòng', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseQrModal = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setQrModalOpen(false);
  };

  const todayStr = getTodayStr();

  return (
    <>
      <Navbar />

      <main className="hc-page">
        <div className="hc-container">
          <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
                <i className="bi bi-shield-check"></i> XÁC NHẬN TỨC THÌ QUA VIETQR
              </div>
              <h2>Đặt Phòng Trực Tuyến</h2>
              <p>Điền thông tin lưu trú và quét mã QR thanh toán tiền cọc 30% để xác nhận giữ chỗ an toàn</p>
            </div>
            <Link to="/" className="hc-btn hc-btn-outline hc-btn-sm">
              <i className="bi bi-arrow-left"></i> Chọn phòng khác
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: '32px' }}>
            {/* Left: Customer & Stay Form */}
            <div className="hc-card">
              <div className="hc-card-header">
                <div className="hc-card-title">
                  <i className="bi bi-person-lines-fill text-primary" style={{ marginRight: '8px' }}></i>
                  Thông Tin Khách Lưu Trú
                </div>
              </div>
              <div className="hc-card-body">
                <form onSubmit={handleSubmitBooking}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                    <div className="hc-form-group">
                      <label className="hc-label">Phòng nghỉ <span style={{ color: 'var(--hc-error)' }}>*</span></label>
                      <select
                        className="hc-select"
                        value={selectedRoomId}
                        onChange={(e) => setSelectedRoomId(e.target.value)}
                        required
                      >
                        <option value="">-- Chọn phòng trống --</option>
                        {availableRooms.map(r => (
                          <option key={r.roomId} value={r.roomId}>
                            Phòng {r.roomNumber} - {r.roomTypeName} ({formatVND(r.basePrice)}/đêm)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="hc-form-group">
                      <label className="hc-label">Số khách</label>
                      <input
                        type="number"
                        className="hc-input"
                        min="1"
                        max="10"
                        value={guestCount}
                        onChange={(e) => setGuestCount(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="hc-form-group">
                      <label className="hc-label">Ngày nhận phòng <span style={{ color: 'var(--hc-error)' }}>*</span></label>
                      <input
                        type="date"
                        className="hc-input"
                        value={checkInDate}
                        min={todayStr}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="hc-form-group">
                      <label className="hc-label">Ngày trả phòng <span style={{ color: 'var(--hc-error)' }}>*</span></label>
                      <input
                        type="date"
                        className="hc-input"
                        value={checkOutDate}
                        min={checkInDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="hc-form-group">
                      <label className="hc-label">Họ và tên khách <span style={{ color: 'var(--hc-error)' }}>*</span></label>
                      <input
                        type="text"
                        className="hc-input"
                        placeholder="Nguyễn Văn A"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="hc-form-group">
                      <label className="hc-label">Số điện thoại liên hệ <span style={{ color: 'var(--hc-error)' }}>*</span></label>
                      <input
                        type="tel"
                        className="hc-input"
                        placeholder="0912345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="hc-form-group">
                      <label className="hc-label">Email nhận biên lai</label>
                      <input
                        type="email"
                        className="hc-input"
                        placeholder="khachhang@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="hc-form-group">
                      <label className="hc-label">Quốc tịch</label>
                      <input
                        type="text"
                        className="hc-input"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                    <div className="hc-form-group">
                      <label className="hc-label">Loại giấy tờ</label>
                      <select className="hc-select" value={idType} onChange={(e) => setIdType(e.target.value)}>
                        <option value="CCCD">CCCD / Căn cước</option>
                        <option value="PASSPORT">Hộ chiếu (Passport)</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </div>
                    <div className="hc-form-group">
                      <label className="hc-label">Số CCCD / Hộ chiếu</label>
                      <input
                        type="text"
                        className="hc-input"
                        placeholder="048201009988"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="hc-form-group">
                    <label className="hc-label">Yêu cầu đặc biệt (Ghi chú)</label>
                    <textarea
                      className="hc-textarea"
                      rows="2"
                      placeholder="Ví dụ: Cần phòng tầng cao, giường đôi, nhận phòng muộn sau 18h..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="hc-btn hc-btn-primary hc-btn-lg"
                    style={{ width: '100%', marginTop: '12px' }}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <div className="hc-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderColor: '#fff', borderTopColor: 'transparent' }}></div>
                        <span>Đang tạo đơn đặt phòng...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-qr-code-scan"></i>
                        <span>Xác nhận Đặt phòng & Nhận mã VietQR →</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Voucher & Bill Summary */}
            <div>
              {/* Voucher Card */}
              <div className="hc-card" style={{ marginBottom: '24px' }}>
                <div className="hc-card-header">
                  <div className="hc-card-title">
                    <i className="bi bi-ticket-perforated text-warning" style={{ marginRight: '8px' }}></i>
                    Mã Ưu Đãi (Voucher)
                  </div>
                </div>
                <div className="hc-card-body">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="hc-input"
                      placeholder="Nhập mã voucher (VD: WELCOME10)"
                      value={voucherCodeInput}
                      onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                    />
                    <button
                      type="button"
                      className="hc-btn hc-btn-outline"
                      onClick={handleApplyVoucher}
                      disabled={voucherLoading}
                    >
                      {voucherLoading ? 'Đang kiểm tra...' : 'Áp dụng'}
                    </button>
                  </div>
                  {appliedVoucher && (
                    <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--hc-success)', fontWeight: 600 }}>
                      <i className="bi bi-check-circle-fill"></i> {appliedVoucher.voucherName} (-{formatVND(appliedVoucher.discountAmount)})
                    </div>
                  )}
                </div>
              </div>

              {/* Bill Summary */}
              <div className="hc-card">
                <div className="hc-card-header">
                  <div className="hc-card-title">
                    <i className="bi bi-receipt text-primary" style={{ marginRight: '8px' }}></i>
                    Tạm Tính Chi Phí
                  </div>
                </div>
                <div className="hc-card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Phòng đã chọn:</span>
                    <strong>{currentRoom ? `Phòng ${currentRoom.roomNumber} (${currentRoom.roomTypeName})` : 'Chưa chọn'}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Đơn giá phòng:</span>
                    <span>{formatVND(pricePerNight)} / đêm</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Thời gian lưu trú:</span>
                    <strong>{nights} đêm</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Tiền phòng gốc:</span>
                    <strong>{formatVND(subtotal)}</strong>
                  </div>

                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', color: 'var(--hc-success)' }}>
                      <span>Giảm giá Voucher:</span>
                      <strong>- {formatVND(discountAmount)}</strong>
                    </div>
                  )}

                  <hr className="hc-divider" />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>Tổng tiền phòng:</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--hc-primary)' }}>
                      {formatVND(finalTotal)}
                    </span>
                  </div>

                  <div style={{ background: 'var(--hc-warning-bg)', border: '1px solid #fde68a', borderRadius: 'var(--hc-radius-md)', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, color: '#92400e', fontSize: '14px' }}>
                        Tiền cọc yêu cầu (30%):
                      </span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--hc-error)' }}>
                        {formatVND(depositRequired)}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--hc-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      * Quý khách chỉ cần cọc trước 30%. Số tiền còn lại sẽ được thanh toán khi hoàn tất thủ tục check-out tại quầy lễ tân.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* VietQR Payment Modal with Polling */}
      <Modal
        isOpen={qrModalOpen}
        onClose={handleCloseQrModal}
        title="Thanh Toán Tiền Cọc Qua VietQR"
        maxWidth="500px"
        footer={
          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={handleCloseQrModal}>
            Đóng
          </button>
        }
      >
        {bookingData && (
          <div style={{ textAlign: 'center' }}>
            {!paymentSuccess ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <span className="hc-badge hc-badge-warning" style={{ padding: '8px 16px', fontSize: '13px' }}>
                    <span className="hc-pulse-dot" style={{ marginRight: '8px' }}></span>
                    Đang chờ chuyển khoản (Tự động xác nhận sau 3s)...
                  </span>
                </div>

                <div className="hc-qr-box" style={{ marginBottom: '16px' }}>
                  {bookingData.qrInfo?.qrDataUrl ? (
                    <img src={bookingData.qrInfo.qrDataUrl} alt="VietQR" />
                  ) : (
                    <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: '8px' }}>
                      <div className="hc-spinner"></div>
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--hc-bg)', padding: '16px', borderRadius: 'var(--hc-radius-md)', textAlign: 'left', fontSize: '13px', border: '1px solid var(--hc-border)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Mã đặt phòng:</span>
                    <strong style={{ color: 'var(--hc-primary)' }}>{bookingData.bookingCode}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Ngân hàng thụ hưởng:</span>
                    <strong>{bookingData.qrInfo?.bankId || 'MB Bank'} - {bookingData.qrInfo?.accountNo || '090123456789'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Chủ tài khoản:</span>
                    <strong>{bookingData.qrInfo?.accountName || 'HOTEL CALIFORNIA'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Số tiền cọc:</span>
                    <strong style={{ color: 'var(--hc-error)', fontSize: '16px' }}>{formatVND(bookingData.depositRequired)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--hc-text-secondary)' }}>Nội dung chuyển khoản:</span>
                    <strong style={{ color: 'var(--hc-text)' }}>{bookingData.qrInfo?.transferContent || bookingData.bookingCode}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '20px 0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--hc-success-bg)', color: 'var(--hc-success)', fontSize: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <i className="bi bi-check-lg"></i>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--hc-success)', marginBottom: '8px' }}>
                  Thanh Toán Cọc Thành Công!
                </h3>
                <p style={{ color: 'var(--hc-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                  Đơn đặt phòng mã <strong>{bookingData.bookingCode}</strong> của quý khách đã được chuyển sang trạng thái <strong>XÁC NHẬN (CONFIRMED)</strong>.
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <Link
                    to={`/services?bookingCode=${bookingData.bookingCode}`}
                    className="hc-btn hc-btn-primary"
                    onClick={handleCloseQrModal}
                  >
                    <i className="bi bi-receipt"></i> Xem Hóa Đơn & Gọi Dịch Vụ
                  </Link>
                  <Link
                    to="/history"
                    className="hc-btn hc-btn-outline"
                    onClick={handleCloseQrModal}
                  >
                    Tra Cứu Lịch Sử
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Footer />
    </>
  );
}
