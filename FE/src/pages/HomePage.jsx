import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { apiCall, formatVND } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function HomePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [checkInDate, setCheckInDate] = useState(() => getTodayStr());
  const [checkOutDate, setCheckOutDate] = useState(() => getTomorrowStr());
  const [guestCount, setGuestCount] = useState(2);
  const [selectedRoomType, setSelectedRoomType] = useState('ALL');

  const [roomTypes, setRoomTypes] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Ensure checkout date is always after check-in date
  useEffect(() => {
    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);
    if (outDate <= inDate) {
      const nextDay = new Date(inDate);
      nextDay.setDate(inDate.getDate() + 1);
      setCheckOutDate(nextDay.toISOString().split('T')[0]);
    }
  }, [checkInDate]);

  const searchRooms = useCallback(async () => {
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      addToast('Ngày trả phòng phải sau ngày nhận phòng!', 'error');
      return;
    }

    setLoadingRooms(true);
    try {
      const res = await apiCall('/api/public/rooms/available', {
        method: 'POST',
        body: {
          checkInDate,
          checkOutDate
        }
      });

      if (res && res.success) {
        setAvailableRooms(res.data || []);
      } else {
        setAvailableRooms([]);
      }
    } catch {
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, [checkInDate, checkOutDate, addToast]);

  useEffect(() => {
    async function initData() {
      try {
        const [typesRes, vouchersRes] = await Promise.all([
          apiCall('/api/public/rooms/room-types', { silentError: true }),
          apiCall('/api/public/vouchers', { silentError: true })
        ]);

        if (typesRes && typesRes.success) {
          setRoomTypes(typesRes.data || []);
        }
        if (vouchersRes && vouchersRes.success) {
          setVouchers(vouchersRes.data || []);
        }
      } catch (e) {
        console.warn('Init error:', e);
      }
    }
    initData();
    searchRooms();
  }, [searchRooms]);

  const filteredRooms = availableRooms.filter(r => {
    if (selectedRoomType === 'ALL') return true;
    const typeId = r.roomType?.roomTypeId;
    const typeName = r.roomType?.typeName;
    return String(typeId) === String(selectedRoomType) || typeName === selectedRoomType;
  });

  const handleBookRoom = (roomId) => {
    navigate(`/booking?roomId=${roomId}&checkIn=${checkInDate}&checkOut=${checkOutDate}&guests=${guestCount}`);
  };

  const todayStr = getTodayStr();

  return (
    <>
      <Navbar />

      {/* Hero Section */}
      <section className="hc-hero">
        <div className="hc-container">
          <div className="hc-hero-content">
            <div className="hc-hero-badge">
              <i className="bi bi-star-fill"></i> HOTEL CALIFORNIA RESORT & SUITES
            </div>
            <h1>
              Kỳ Nghỉ Thượng Lưu <br />
              <span className="hc-gold-gradient">Đẳng Cấp & Đậm Chất Thơ</span>
            </h1>
            <p>
              Tận hưởng không gian lưu trú sang trọng với tầm nhìn hướng biển tuyệt mỹ, dịch vụ ẩm thực tinh hoa và hệ thống phòng ốc hiện đại bậc nhất.
            </p>
          </div>

          {/* Search Box */}
          <div className="hc-search-box">
            <div className="hc-form-group">
              <label className="hc-label">
                <i className="bi bi-calendar-event text-primary"></i> Nhận phòng
              </label>
              <input
                type="date"
                className="hc-input"
                value={checkInDate}
                min={todayStr}
                onChange={(e) => setCheckInDate(e.target.value)}
              />
            </div>

            <div className="hc-form-group">
              <label className="hc-label">
                <i className="bi bi-calendar-check text-primary"></i> Trả phòng
              </label>
              <input
                type="date"
                className="hc-input"
                value={checkOutDate}
                min={checkInDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
              />
            </div>

            <div className="hc-form-group" style={{ maxWidth: '140px' }}>
              <label className="hc-label">
                <i className="bi bi-people text-primary"></i> Số khách
              </label>
              <input
                type="number"
                className="hc-input"
                min="1"
                max="10"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
              />
            </div>

            <div className="hc-form-group" style={{ minWidth: '180px' }}>
              <label className="hc-label">
                <i className="bi bi-door-open text-primary"></i> Hạng phòng
              </label>
              <select
                className="hc-select"
                value={selectedRoomType}
                onChange={(e) => setSelectedRoomType(e.target.value)}
              >
                <option value="ALL">Tất cả các hạng</option>
                {roomTypes.map(t => (
                  <option key={t.roomTypeId} value={t.roomTypeId}>
                    {t.typeName} ({formatVND(t.basePrice)}/đêm)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="hc-btn hc-btn-secondary hc-btn-lg"
              onClick={searchRooms}
              style={{ minHeight: '44px' }}
            >
              <i className="bi bi-search"></i> Tìm phòng trống
            </button>
          </div>
        </div>
      </section>

      {/* Active Vouchers Marquee / Chips */}
      {vouchers.length > 0 && (
        <section style={{ background: 'var(--hc-bg-alt)', padding: '14px 0', borderBottom: '1px solid var(--hc-border)' }}>
          <div className="hc-container" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--hc-secondary-dark)' }}>
              <i className="bi bi-ticket-perforated-fill fs-5"></i> ƯU ĐÃI ĐANG MỞ:
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
              {vouchers.filter(v => v.active !== false).map(v => (
                <div key={v.voucherId} className="hc-badge hc-badge-warning" style={{ padding: '6px 14px', fontSize: '12px' }}>
                  <strong style={{ letterSpacing: '0.04em' }}>{v.voucherCode}</strong> — {v.voucherName} ({v.discountType === 'PERCENT' ? `-${v.discountValue}%` : `-${formatVND(v.discountValue)}`})
                </div>
              ))}
            </div>
            <Link to="/booking" className="hc-btn hc-btn-outline hc-btn-sm">
              Sử dụng mã ngay →
            </Link>
          </div>
        </section>
      )}

      {/* Main Room Listings */}
      <main className="hc-page">
        <div className="hc-container">
          <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2>Danh Sách Phòng Trống</h2>
              <p>
                Tìm thấy <strong>{filteredRooms.length}</strong> phòng sẵn sàng đón tiếp quý khách từ {new Date(checkInDate).toLocaleDateString('vi-VN')} đến {new Date(checkOutDate).toLocaleDateString('vi-VN')}
              </p>
            </div>

            {/* Room Type Pills Filter */}
            <div className="hc-tab-group" style={{ marginBottom: 0 }}>
              <button
                className={`hc-tab-btn ${selectedRoomType === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedRoomType('ALL')}
              >
                Tất cả ({availableRooms.length})
              </button>
              {roomTypes.map(t => {
                const count = availableRooms.filter(r => String(r.roomType?.roomTypeId) === String(t.roomTypeId)).length;
                return (
                  <button
                    key={t.roomTypeId}
                    className={`hc-tab-btn ${String(selectedRoomType) === String(t.roomTypeId) ? 'active' : ''}`}
                    onClick={() => setSelectedRoomType(String(t.roomTypeId))}
                  >
                    {t.typeName} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {loadingRooms ? (
            <div className="hc-loading-spinner">
              <div className="hc-spinner"></div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="hc-card">
              <div className="hc-empty-state">
                <i className="bi bi-calendar-x"></i>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Không có phòng trống phù hợp</h3>
                <p style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
                  Các phòng trong khoảng thời gian đã chọn hiện đang kín lịch. Quý khách vui lòng đổi ngày nhận/trả phòng hoặc liên hệ hotline để được hỗ trợ.
                </p>
                <button type="button" className="hc-btn hc-btn-outline" onClick={() => { setSelectedRoomType('ALL'); searchRooms(); }}>
                  Thử lại tìm kiếm
                </button>
              </div>
            </div>
          ) : (
            <div className="hc-room-grid">
              {filteredRooms.map(room => (
                <div key={room.roomId} className="hc-room-card">
                  <div style={{ position: 'relative', overflow: 'hidden', height: '210px', background: 'var(--hc-bg-alt)' }}>
                    <img
                      src={room.imageUrl || `https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=700&q=80`}
                      alt={`Phòng ${room.roomNumber}`}
                      className="hc-room-card-image"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=700&q=80';
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(15, 38, 64, 0.85)',
                      backdropFilter: 'blur(4px)',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: 'var(--hc-radius-sm)',
                      fontSize: '12px',
                      fontWeight: 700
                    }}>
                      Phòng #{room.roomNumber}
                    </div>

                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px'
                    }}>
                      <span className="hc-badge hc-badge-success">
                        <i className="bi bi-check-circle-fill"></i> Còn trống
                      </span>
                    </div>
                  </div>

                  <div className="hc-room-card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 className="hc-room-card-name" style={{ margin: 0 }}>
                        {room.roomType?.typeName || 'Hạng phòng cao cấp'}
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--hc-text-muted)' }}>
                        Tầng {room.floor || 1}
                      </span>
                    </div>

                    <div className="hc-room-card-amenities">
                      <span className="hc-badge hc-badge-primary">
                        <i className="bi bi-people"></i> Tối đa {room.roomType?.capacity || 2} khách
                      </span>
                      <span className="hc-badge hc-badge-muted">
                        <i className="bi bi-wifi"></i> Wifi 6
                      </span>
                      <span className="hc-badge hc-badge-muted">
                        <i className="bi bi-tv"></i> Smart TV
                      </span>
                      <span className="hc-badge hc-badge-muted">
                        <i className="bi bi-cup"></i> Mini Bar
                      </span>
                    </div>

                    <hr className="hc-divider" style={{ margin: '14px 0' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="hc-room-card-price">
                        {formatVND(room.pricePerNight || room.roomType?.basePrice)} <span>/ đêm</span>
                      </div>
                      <button
                        type="button"
                        className="hc-btn hc-btn-primary"
                        onClick={() => handleBookRoom(room.roomId)}
                      >
                        Đặt phòng ngay <i className="bi bi-arrow-right"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Luxury Facilities Feature Grid */}
          <section style={{ marginTop: '64px', paddingTop: '48px', borderTop: '1px solid var(--hc-border)' }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 40px' }}>
              <div className="hc-hero-badge">DỊCH VỤ & TIỆN ÍCH TIÊU CHUẨN</div>
              <h2 style={{ fontSize: '28px', marginBottom: '12px' }}>Trải Nghiệm Nghỉ Dưỡng Hoàn Hảo</h2>
              <p style={{ color: 'var(--hc-text-secondary)', fontSize: '15px' }}>
                Khách sạn sở hữu đầy đủ tiện nghi hàng đầu phục vụ mọi nhu cầu thư giãn, thưởng thức ẩm thực và hội nghị.
              </p>
            </div>

            <div className="hc-grid-4">
              <div className="hc-card" style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--hc-primary-subtle)', color: 'var(--hc-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
                  <i className="bi bi-water"></i>
                </div>
                <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>Hồ Bơi Vô Cực</h4>
                <p style={{ fontSize: '13px', color: 'var(--hc-text-secondary)', margin: 0 }}>
                  Thư giãn ngắm hoàng hôn với hồ bơi nước ấm tầng thượng mở cửa 24/7.
                </p>
              </div>

              <div className="hc-card" style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--hc-secondary-light)', color: 'var(--hc-primary-dark)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
                  <i className="bi bi-cup-hot"></i>
                </div>
                <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>Ẩm Thực Michelin</h4>
                <p style={{ fontSize: '13px', color: 'var(--hc-text-secondary)', margin: 0 }}>
                  Thực đơn Á - Âu tinh tế được chế biến bởi các bếp trưởng trứ danh.
                </p>
              </div>

              <div className="hc-card" style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--hc-success-bg)', color: 'var(--hc-success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
                  <i className="bi bi-flower1"></i>
                </div>
                <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>Spa & Trị Liệu</h4>
                <p style={{ fontSize: '13px', color: 'var(--hc-text-secondary)', margin: 0 }}>
                  Phương pháp massage thảo mộc truyền thống phục hồi năng lượng tối đa.
                </p>
              </div>

              <div className="hc-card" style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--hc-info-bg)', color: 'var(--hc-info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
                  <i className="bi bi-car-front"></i>
                </div>
                <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>Đưa Đón Sân Bay</h4>
                <p style={{ fontSize: '13px', color: 'var(--hc-text-secondary)', margin: 0 }}>
                  Xe limousine đưa đón tận nơi chu đáo, chuyên nghiệp và đúng giờ.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
