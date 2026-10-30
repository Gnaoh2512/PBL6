import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Modal from "../components/Modal";
import { apiCall, formatVND, getAuthUser } from "../services/api";
import { useToast } from "../contexts/ToastContext";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const queryRoomId = searchParams.get("roomId") || "";
  const queryCheckIn = searchParams.get("checkIn") || "";
  const queryCheckOut = searchParams.get("checkOut") || "";
  const queryGuests = searchParams.get("guests") || "2";

  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState(queryRoomId);
  const [checkInDate, setCheckInDate] = useState(() => queryCheckIn || getTodayStr());
  const [checkOutDate, setCheckOutDate] = useState(() => queryCheckOut || getTomorrowStr());
  const [guestCount, setGuestCount] = useState(queryGuests);

  const authUser = getAuthUser();
  const [fullName, setFullName] = useState(authUser?.fullName || "");
  const [phone, setPhone] = useState(authUser?.phone || "");
  const [email, setEmail] = useState(authUser?.email || "");
  const [nationality, setNationality] = useState("Việt Nam");
  const [idType, setIdType] = useState("CCCD");
  const [idNumber, setIdNumber] = useState("");
  const [note, setNote] = useState("");

  // Voucher
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Form submit & QR modal
  const [submitting, setSubmitting] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [qrImageFailed, setQrImageFailed] = useState(false);

  const pollingRef = useRef(null);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await apiCall("/api/public/rooms/available", {
        method: "POST",
        body: { checkInDate, checkOutDate },
        silentError: true,
      });
      if (res && res.success && res.data) {
        setAvailableRooms(res.data);
        setSelectedRoomId((current) => {
          if (queryRoomId && res.data.some((room) => String(room.roomId) === String(queryRoomId))) return queryRoomId;
          return res.data.some((room) => String(room.roomId) === String(current)) ? current : "";
        });
      }
    } catch {
      // silent fallback
    } finally {
      setRoomsLoading(false);
    }
  }, [checkInDate, checkOutDate, queryRoomId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const nights = Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)) || 1);
  const roomsForGuests = availableRooms.filter((room) => Number(room.roomType?.capacity || room.capacity || 10) >= Number(guestCount));
  const currentRoom = roomsForGuests.find((r) => String(r.roomId) === String(selectedRoomId));
  const pricePerNight = currentRoom ? currentRoom.pricePerNight || currentRoom.roomType?.basePrice || currentRoom.basePrice || 500000 : 500000;
  const subtotal = pricePerNight * nights;
  const discountAmount = appliedVoucher ? appliedVoucher.discountAmount || 0 : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const depositRequired = Math.round(finalTotal * 0.3);

  const handleApplyVoucher = async () => {
    const cleanCode = voucherCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      addToast("Vui lòng nhập mã voucher", "warning");
      return;
    }
    setVoucherLoading(true);
    try {
      const res = await apiCall("/api/public/vouchers/apply", {
        method: "POST",
        body: {
          code: cleanCode,
          voucherCode: cleanCode,
          orderAmount: subtotal,
        },
      });
      if (res && res.success && res.data && res.data.isValid !== false) {
        setAppliedVoucher(res.data);
        const codeDisplay = res.data.voucherCode || res.data.code || cleanCode;
        addToast(`Áp dụng thành công voucher ${codeDisplay}! Giảm ${formatVND(res.data.discountAmount || 0)}`, "success");
      } else {
        setAppliedVoucher(null);
        addToast(res?.data?.message || res?.message || "Mã voucher không hợp lệ hoặc không đủ điều kiện", "error");
      }
    } catch (err) {
      setAppliedVoucher(null);
      addToast(err.message || "Mã voucher không hợp lệ hoặc không đủ điều kiện áp dụng", "error");
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
          addToast("Thanh toán tiền cọc thành công! Đơn đặt phòng đã được xác nhận giữ chỗ!", "success", 5000);
        }
      } catch {
        // silent polling
      }
    }, 3000);
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!selectedRoomId) {
      addToast("Vui lòng chọn phòng lưu trú!", "warning");
      return;
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      addToast("Ngày trả phòng phải sau ngày nhận phòng!", "error");
      return;
    }
    if (!fullName.trim() || !phone.trim()) {
      addToast("Vui lòng điền họ tên và số điện thoại liên hệ!", "warning");
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
      nationality: nationality || "Việt Nam",
      idType,
      idNumber: idNumber.trim() || null,
      voucherCode: appliedVoucher ? (appliedVoucher.voucherCode || appliedVoucher.code) : (voucherCodeInput.trim().toUpperCase() || null),
      note: note.trim() || null,
    };

    try {
      const res = await apiCall("/api/public/bookings", {
        method: "POST",
        body: payload,
      });

      if (res && res.success) {
        setBookingData(res.data);
        setPaymentSuccess(false);
        setQrImageFailed(false);
        setQrModalOpen(true);
        addToast("Tạo đơn đặt phòng thành công! Vui lòng quét mã VietQR để cọc giữ chỗ.", "success");
        startPollingPayment(res.data.bookingCode);
      }
    } catch (err) {
      addToast(err.message || "Lỗi tạo đơn đặt phòng", "error");
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

      <main className="hc-page booking-experience">
        <div className="hc-container">
          <div className="hc-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h2>Đặt Phòng Trực Tuyến</h2>
              <p>Điền thông tin lưu trú và quét mã QR thanh toán tiền cọc 30% để xác nhận giữ chỗ an toàn</p>
            </div>
            <Link to="/" className="hc-btn hc-btn-outline hc-btn-sm">
              <i className="bi bi-arrow-left"></i> Chọn phòng khác
            </Link>
          </div>

          <section className="hc-card booking-search-card">
            <div className="hc-card-body booking-search-fields">
              <label className="hc-form-group">
                <span className="hc-label">Ngày nhận phòng</span>
                <input
                  className="hc-input"
                  type="date"
                  min={todayStr}
                  value={checkInDate}
                  onChange={(event) => {
                    setSelectedRoomId("");
                    setCheckInDate(event.target.value);
                  }}
                />
              </label>
              <label className="hc-form-group">
                <span className="hc-label">Ngày trả phòng</span>
                <input
                  className="hc-input"
                  type="date"
                  min={checkInDate}
                  value={checkOutDate}
                  onChange={(event) => {
                    setSelectedRoomId("");
                    setCheckOutDate(event.target.value);
                  }}
                />
              </label>
              <label className="hc-form-group">
                <span className="hc-label">Số khách</span>
                <select className="hc-select" value={guestCount} onChange={(event) => setGuestCount(event.target.value)}>
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count} khách
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="hc-btn hc-btn-primary" onClick={loadRooms} disabled={roomsLoading || new Date(checkOutDate) <= new Date(checkInDate)}>
                <i className="bi bi-search" /> Tìm phòng trống
              </button>
            </div>
          </section>

          {!currentRoom ? (
            <section className="booking-room-results">
              <div className="booking-results-heading">
                <div>
                  <h2>Chọn không gian lưu trú</h2>
                  <p>{roomsForGuests.length} phòng phù hợp với ngày ở và số khách đã chọn.</p>
                </div>
              </div>
              {roomsLoading ? (
                <div className="hc-card hc-empty-state">Đang kiểm tra phòng trống…</div>
              ) : roomsForGuests.length === 0 ? (
                <div className="hc-card hc-empty-state">
                  <i className="bi bi-door-closed" />
                  <p>Không tìm thấy phòng phù hợp. Hãy đổi ngày hoặc số khách.</p>
                </div>
              ) : (
                <div className="booking-room-grid">
                  {roomsForGuests.map((room) => {
                    const roomName = room.roomType?.typeName || room.roomTypeName || `Phòng ${room.roomNumber}`;
                    const roomImage = room.imageUrl || room.roomType?.imageUrl || "https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85";
                    const roomPrice = room.pricePerNight || room.roomType?.basePrice || room.basePrice || 0;
                    return (
                      <article className="booking-room-card" key={room.roomId}>
                        <img src={roomImage} alt={roomName} loading="lazy" />
                        <div className="booking-room-card-copy">
                          <span className="hc-hero-badge">{room.roomNumber ? `PHÒNG ${room.roomNumber}` : "AZURE BAY"}</span>
                          <h3>{roomName}</h3>
                          <p>{room.roomType?.description || room.description || "Không gian nghỉ dưỡng được chuẩn bị cho kỳ lưu trú thoải mái."}</p>
                          <div className="booking-room-facts">
                            <span>
                              <i className="bi bi-people" /> Tối đa {room.roomType?.capacity || room.capacity || "—"} khách
                            </span>
                            <span>
                              <i className="bi bi-geo-alt" /> Tầng {room.floor || "—"}
                            </span>
                          </div>
                          <div className="booking-room-card-footer">
                            <strong>
                              {formatVND(roomPrice)} <small>/ đêm</small>
                            </strong>
                            <button className="hc-btn hc-btn-primary" onClick={() => setSelectedRoomId(String(room.roomId))}>
                              Chọn phòng <i className="bi bi-arrow-right" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            <div className="booking-details-layout">
              {/* Left: Customer & Stay Form */}
              <div className="hc-card booking-customer-card">
                <div className="hc-card-header">
                  <div className="hc-card-title">
                    <i className="bi bi-person-lines-fill text-primary" style={{ marginRight: "8px" }}></i>
                    Thông Tin Khách Lưu Trú
                  </div>
                </div>
                <div className="hc-card-body">
                  <form onSubmit={handleSubmitBooking}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div className="hc-form-group">
                        <label className="hc-label">
                          Họ và tên khách <span style={{ color: "var(--hc-error)" }}>*</span>
                        </label>
                        <input type="text" className="hc-input" placeholder="Nguyễn Văn A" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                      </div>
                      <div className="hc-form-group">
                        <label className="hc-label">
                          Số điện thoại liên hệ <span style={{ color: "var(--hc-error)" }}>*</span>
                        </label>
                        <input type="tel" className="hc-input" placeholder="0912345678" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div className="hc-form-group">
                        <label className="hc-label">Email nhận biên lai</label>
                        <input type="email" className="hc-input" placeholder="khachhang@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="hc-form-group">
                        <label className="hc-label">Quốc tịch</label>
                        <input type="text" className="hc-input" value={nationality} onChange={(e) => setNationality(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
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
                        <input type="text" className="hc-input" placeholder="048201009988" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
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

                    <button type="submit" className="hc-btn hc-btn-primary hc-btn-lg" style={{ width: "100%", marginTop: "12px" }} disabled={submitting}>
                      {submitting ? (
                        <>
                          <div className="hc-spinner" style={{ width: "18px", height: "18px", borderWidth: "2px", borderColor: "#fff", borderTopColor: "transparent" }}></div>
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
              <div className="booking-order-summary">
                <article className="booking-selected-room">
                  <img
                    src={currentRoom.imageUrl || currentRoom.roomType?.imageUrl || "https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85"}
                    alt={currentRoom.roomType?.typeName || currentRoom.roomTypeName || "Phòng nghỉ Azure Bay"}
                  />
                  <div className="booking-selected-room-copy">
                    <button type="button" className="booking-change-room" onClick={() => setSelectedRoomId("")}>
                      <i className="bi bi-arrow-left" /> Đổi phòng
                    </button>
                    <span className="hc-hero-badge">LỰA CHỌN CỦA BẠN</span>
                    <h2>{currentRoom.roomType?.typeName || currentRoom.roomTypeName || `Phòng ${currentRoom.roomNumber}`}</h2>
                    <p>{currentRoom.roomType?.description || currentRoom.description || "Không gian nghỉ dưỡng được chuẩn bị cho kỳ lưu trú thoải mái."}</p>
                    <div className="booking-room-facts">
                      <span>
                        <i className="bi bi-door-open" /> Phòng {currentRoom.roomNumber}
                      </span>
                      <span>
                        <i className="bi bi-people" /> {guestCount} khách
                      </span>
                      <span>
                        <i className="bi bi-moon-stars" /> {nights} đêm
                      </span>
                    </div>
                    <strong className="booking-selected-price">
                      {formatVND(pricePerNight)} <small>/ đêm</small>
                    </strong>
                  </div>
                </article>
                {/* Voucher Card */}
                <div className="hc-card" style={{ marginBottom: "24px" }}>
                  <div className="hc-card-header">
                    <div className="hc-card-title">
                      <i className="bi bi-ticket-perforated text-warning" style={{ marginRight: "8px" }}></i>
                      Mã Ưu Đãi (Voucher)
                    </div>
                  </div>
                  <div className="hc-card-body">
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        className="hc-input"
                        placeholder="Nhập mã voucher (VD: WELCOME10)"
                        value={voucherCodeInput}
                        onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                      />
                      <button type="button" className="hc-btn hc-btn-outline" onClick={handleApplyVoucher} disabled={voucherLoading}>
                        {voucherLoading ? "Đang kiểm tra..." : "Áp dụng"}
                      </button>
                    </div>
                    {appliedVoucher && (
                      <div style={{ marginTop: "10px", fontSize: "13px", color: "var(--hc-success)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>
                          <i className="bi bi-check-circle-fill"></i> {appliedVoucher.voucherName} (-{formatVND(appliedVoucher.discountAmount)})
                        </span>
                        <button
                          type="button"
                          className="hc-btn hc-btn-outline hc-btn-sm"
                          style={{ padding: "2px 8px", fontSize: "11px", color: "var(--hc-error)", borderColor: "var(--hc-error)" }}
                          onClick={() => { setAppliedVoucher(null); setVoucherCodeInput(""); }}
                          title="Hủy mã ưu đãi"
                        >
                          Hủy dùng
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bill Summary */}
                <div className="hc-card">
                  <div className="hc-card-header">
                    <div className="hc-card-title">
                      <i className="bi bi-receipt text-primary" style={{ marginRight: "8px" }}></i>
                      Tạm Tính Chi Phí
                    </div>
                  </div>
                  <div className="hc-card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
                      <span style={{ color: "var(--hc-text-secondary)" }}>Đơn giá phòng:</span>
                      <span>{formatVND(pricePerNight)} / đêm</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
                      <span style={{ color: "var(--hc-text-secondary)" }}>Thời gian lưu trú:</span>
                      <strong>{nights} đêm</strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
                      <span style={{ color: "var(--hc-text-secondary)" }}>Tiền phòng gốc:</span>
                      <strong>{formatVND(subtotal)}</strong>
                    </div>

                    {discountAmount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px", color: "var(--hc-success)" }}>
                        <span>Giảm giá Voucher:</span>
                        <strong>- {formatVND(discountAmount)}</strong>
                      </div>
                    )}

                    <hr className="hc-divider" />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <span style={{ fontWeight: 700, fontSize: "16px" }}>Tổng tiền phòng:</span>
                      <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--hc-primary)" }}>{formatVND(finalTotal)}</span>
                    </div>

                    <div style={{ background: "var(--hc-warning-bg)", border: "1px solid #fde68a", borderRadius: "var(--hc-radius-md)", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontWeight: 700, color: "#92400e", fontSize: "14px" }}>Tiền cọc yêu cầu (30%):</span>
                        <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--hc-error)" }}>{formatVND(depositRequired)}</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--hc-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                        * Quý khách chỉ cần cọc trước 30%. Số tiền còn lại sẽ được thanh toán khi hoàn tất thủ tục check-out tại quầy lễ tân.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
          <div style={{ textAlign: "center" }}>
            {!paymentSuccess ? (
              <>
                <div style={{ marginBottom: "16px" }}>
                  <span className="hc-badge hc-badge-warning" style={{ padding: "8px 16px", fontSize: "13px" }}>
                    <span className="hc-pulse-dot" style={{ marginRight: "8px" }}></span>
                    Đang chờ chuyển khoản (kiểm tra trạng thái mỗi 3 giây)...
                  </span>
                </div>

                <div className="hc-qr-box" style={{ marginBottom: "16px" }}>
                  {bookingData.qrInfo?.qrImageUrl && !qrImageFailed ? (
                    <img src={bookingData.qrInfo.qrImageUrl} alt="Mã VietQR thanh toán tiền cọc" onError={() => setQrImageFailed(true)} />
                  ) : (
                    <div
                      style={{
                        width: "240px",
                        minHeight: "180px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                        background: "#f5f5f5",
                        borderRadius: "8px",
                        color: "#6c757d",
                      }}
                    >
                      <i className="bi bi-qr-code" style={{ fontSize: 36 }} />
                      <span>{qrImageFailed ? "Không tải được ảnh QR. Vui lòng kiểm tra cấu hình VietQR." : "Đơn đặt phòng chưa có mã QR."}</span>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: "var(--hc-bg)",
                    padding: "16px",
                    borderRadius: "var(--hc-radius-md)",
                    textAlign: "left",
                    fontSize: "13px",
                    border: "1px solid var(--hc-border)",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "var(--hc-text-secondary)" }}>Mã đặt phòng:</span>
                    <strong style={{ color: "var(--hc-primary)" }}>{bookingData.bookingCode}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "var(--hc-text-secondary)" }}>Ngân hàng thụ hưởng:</span>
                    <strong>
                      {bookingData.qrInfo?.bankId || "MB Bank"} - {bookingData.qrInfo?.accountNo || "090123456789"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "var(--hc-text-secondary)" }}>Chủ tài khoản:</span>
                    <strong>{bookingData.qrInfo?.accountName || "HOTEL CALIFORNIA"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "var(--hc-text-secondary)" }}>Số tiền cọc:</span>
                    <strong style={{ color: "var(--hc-error)", fontSize: "16px" }}>{formatVND(bookingData.depositRequired)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--hc-text-secondary)" }}>Nội dung chuyển khoản:</span>
                    <strong style={{ color: "var(--hc-text)" }}>{bookingData.qrInfo?.transferContent || bookingData.bookingCode}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "20px 0" }}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "var(--hc-success-bg)",
                    color: "var(--hc-success)",
                    fontSize: "32px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}
                >
                  <i className="bi bi-check-lg"></i>
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--hc-success)", marginBottom: "8px" }}>Thanh Toán Cọc Thành Công!</h3>
                <p style={{ color: "var(--hc-text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
                  Đơn đặt phòng mã <strong>{bookingData.bookingCode}</strong> của quý khách đã được chuyển sang trạng thái <strong>XÁC NHẬN (CONFIRMED)</strong>.
                </p>

                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <Link to={`/services?bookingCode=${bookingData.bookingCode}`} className="hc-btn hc-btn-primary" onClick={handleCloseQrModal}>
                    <i className="bi bi-receipt"></i> Xem Hóa Đơn & Gọi Dịch Vụ
                  </Link>
                  <Link to={authUser ? "/guest/bookings" : "/login"} className="hc-btn hc-btn-outline" onClick={handleCloseQrModal}>
                    Tra Cứu Lịch Sử
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Footer variant="resort" />
    </>
  );
}
