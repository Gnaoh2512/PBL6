import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Modal from "../components/Modal";
import { apiCall, formatVND, getAuthUser } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import DatePicker from "../components/DatePicker";
import SelectMenu from "../components/SelectMenu";
import { addDaysISO, todayISO } from "../components/dateUtils";
import "./BookingPage.css";

const getTodayStr = todayISO;
const getTomorrowStr = () => addDaysISO(todayISO(), 1);

const ID_TYPE_OPTIONS = [
  { value: "CCCD", label: "CCCD / Căn cước" },
  { value: "PASSPORT", label: "Hộ chiếu (Passport)" },
  { value: "OTHER", label: "Khác" },
];

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6].map((count) => ({ value: String(count), label: `${count} khách` }));

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
  const containerRef = useRef(null);

  // Make the page content exactly as wide (and aligned) as the navbar content.
  useLayoutEffect(() => {
    const el = containerRef.current;
    const navInner = document.querySelector("header.hc-navbar .hc-container");
    if (!el || !navInner) return undefined;
    const sync = () => {
      const style = getComputedStyle(navInner);
      const rect = navInner.getBoundingClientRect();
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const padRight = parseFloat(style.paddingRight) || 0;
      const parentLeft = el.parentElement.getBoundingClientRect().left;
      el.style.setProperty("--bk-content-width", `${rect.width - padLeft - padRight}px`);
      el.style.setProperty("--bk-content-offset", `${rect.left + padLeft - parentLeft}px`);
    };
    sync();
    window.addEventListener("resize", sync);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(navInner);
    return () => {
      window.removeEventListener("resize", sync);
      observer?.disconnect();
    };
  }, []);

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
    if (!voucherCodeInput.trim()) {
      addToast("Vui lòng nhập mã voucher", "warning");
      return;
    }
    setVoucherLoading(true);
    try {
      const res = await apiCall("/api/public/vouchers/apply", {
        method: "POST",
        body: {
          voucherCode: voucherCodeInput.trim().toUpperCase(),
          orderAmount: subtotal,
        },
      });
      if (res && res.success) {
        setAppliedVoucher(res.data);
        addToast(`Áp dụng thành công voucher ${res.data.voucherCode}! Giảm ${formatVND(res.data.discountAmount)}`, "success");
      }
    } catch (err) {
      setAppliedVoucher(null);
      addToast(err.message || "Mã voucher không hợp lệ", "error");
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
      voucherCode: appliedVoucher ? appliedVoucher.voucherCode : voucherCodeInput.trim() || null,
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

  const handleCheckInChange = (value) => {
    setSelectedRoomId("");
    setCheckInDate(value);
    if (!checkOutDate || checkOutDate <= value) setCheckOutDate(addDaysISO(value, 1));
  };

  return (
    <>
      <Navbar hideLinks />

      <main className="hc-page booking-experience">
        <div className="hc-container" ref={containerRef}>
          <div className="hc-page-title bk-title-row">
            <div>
              <h2>Đặt Phòng Trực Tuyến</h2>
              <p>Điền thông tin lưu trú và quét mã QR thanh toán tiền cọc 30% để xác nhận giữ chỗ an toàn</p>
            </div>
            <div className="bk-title-actions">
              {currentRoom && (
                <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setSelectedRoomId("")}>
                  <i className="bi bi-arrow-left"></i> Chọn phòng khác
                </button>
              )}
              <Link to="/" className="hc-btn hc-btn-outline hc-btn-sm">
                <i className="bi bi-house-door"></i> Trở về trang chủ
              </Link>
            </div>
          </div>

          <section className="hc-card booking-search-card">
            <div className="hc-card-body booking-search-fields">
              <div className="hc-form-group">
                <span className="hc-label">Ngày nhận phòng</span>
                <DatePicker ariaLabel="Ngày nhận phòng" min={todayStr} value={checkInDate} onChange={handleCheckInChange} />
              </div>
              <div className="hc-form-group">
                <span className="hc-label">Ngày trả phòng</span>
                <DatePicker
                  ariaLabel="Ngày trả phòng"
                  min={addDaysISO(checkInDate, 1)}
                  value={checkOutDate}
                  onChange={(value) => {
                    setSelectedRoomId("");
                    setCheckOutDate(value);
                  }}
                />
              </div>
              <div className="hc-form-group">
                <span className="hc-label">Số khách</span>
                <SelectMenu ariaLabel="Số khách" icon="bi-people" value={guestCount} onChange={setGuestCount} options={GUEST_OPTIONS} />
              </div>
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
                          {room.roomNumber ? (
                            <span className="bk-room-number">
                              Phòng <b>{room.roomNumber}</b>
                            </span>
                          ) : (
                            <span className="hc-hero-badge">AZURE BAY</span>
                          )}
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
                    <i className="bi bi-person-lines-fill text-primary bk-icon-gap"></i>
                    Thông Tin Khách Lưu Trú
                  </div>
                </div>
                <div className="hc-card-body">
                  <form onSubmit={handleSubmitBooking}>
                    <div className="bk-grid-2">
                      <div className="hc-form-group">
                        <label className="hc-label">
                          Họ và tên khách <span className="bk-required">*</span>
                        </label>
                        <input type="text" className="hc-input" placeholder="Nguyễn Văn A" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                      </div>
                      <div className="hc-form-group">
                        <label className="hc-label">
                          Số điện thoại liên hệ <span className="bk-required">*</span>
                        </label>
                        <input type="tel" className="hc-input" placeholder="0912345678" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                      </div>
                    </div>

                    <div className="bk-grid-2">
                      <div className="hc-form-group">
                        <label className="hc-label">Email nhận biên lai</label>
                        <input type="email" className="hc-input" placeholder="khachhang@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="hc-form-group">
                        <label className="hc-label">Quốc tịch</label>
                        <input type="text" className="hc-input" value={nationality} onChange={(e) => setNationality(e.target.value)} />
                      </div>
                    </div>

                    <div className="bk-grid-1-2">
                      <div className="hc-form-group">
                        <label className="hc-label">Loại giấy tờ</label>
                        <SelectMenu ariaLabel="Loại giấy tờ" icon="bi-person-vcard" value={idType} onChange={setIdType} options={ID_TYPE_OPTIONS} />
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

                    <button type="submit" className="hc-btn hc-btn-primary hc-btn-lg bk-submit-btn" disabled={submitting}>
                      {submitting ? (
                        <>
                          <div className="hc-spinner bk-spinner-light"></div>
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
                    <div className="bk-selected-tags">
                      <span className="hc-hero-badge">LỰA CHỌN CỦA BẠN</span>
                      {currentRoom.roomNumber && (
                        <span className="bk-room-number">
                          Phòng <b>{currentRoom.roomNumber}</b>
                        </span>
                      )}
                    </div>
                    <h2>{currentRoom.roomType?.typeName || currentRoom.roomTypeName || `Phòng ${currentRoom.roomNumber}`}</h2>
                    <p>{currentRoom.roomType?.description || currentRoom.description || "Không gian nghỉ dưỡng được chuẩn bị cho kỳ lưu trú thoải mái."}</p>
                    <div className="booking-room-facts">
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
                <div className="hc-card bk-voucher-card">
                  <div className="hc-card-header">
                    <div className="hc-card-title">
                      <i className="bi bi-ticket-perforated text-primary bk-icon-gap"></i>
                      Mã Ưu Đãi (Voucher)
                    </div>
                  </div>
                  <div className="hc-card-body">
                    <div className="bk-voucher-row">
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
                      <div className="bk-voucher-applied">
                        <i className="bi bi-check-circle-fill"></i> {appliedVoucher.voucherName} (-{formatVND(appliedVoucher.discountAmount)})
                      </div>
                    )}
                  </div>
                </div>

                {/* Bill Summary */}
                <div className="hc-card">
                  <div className="hc-card-header">
                    <div className="hc-card-title">
                      <i className="bi bi-receipt text-primary bk-icon-gap"></i>
                      Tạm Tính Chi Phí
                    </div>
                  </div>
                  <div className="hc-card-body">
                    <div className="bk-bill-row">
                      <span className="bk-muted">Đơn giá phòng:</span>
                      <span>{formatVND(pricePerNight)} / đêm</span>
                    </div>

                    <div className="bk-bill-row">
                      <span className="bk-muted">Thời gian lưu trú:</span>
                      <strong>{nights} đêm</strong>
                    </div>

                    <div className="bk-bill-row">
                      <span className="bk-muted">Tiền phòng gốc:</span>
                      <strong>{formatVND(subtotal)}</strong>
                    </div>

                    {discountAmount > 0 && (
                      <div className="bk-bill-row bk-bill-row-discount">
                        <span>Giảm giá Voucher:</span>
                        <strong>- {formatVND(discountAmount)}</strong>
                      </div>
                    )}

                    <hr className="hc-divider" />

                    <div className="bk-total-row">
                      <span className="bk-total-label">Tổng tiền phòng:</span>
                      <span className="bk-total-value">{formatVND(finalTotal)}</span>
                    </div>

                    <div className="bk-deposit-box">
                      <div className="bk-deposit-head">
                        <span className="bk-deposit-label">Tiền cọc yêu cầu (30%):</span>
                        <span className="bk-deposit-value">{formatVND(depositRequired)}</span>
                      </div>
                      <p className="bk-deposit-note">* Quý khách chỉ cần cọc trước 30%. Số tiền còn lại sẽ được thanh toán khi hoàn tất thủ tục check-out tại quầy lễ tân.</p>
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
          <div className="bk-center">
            {!paymentSuccess ? (
              <>
                <div className="bk-mb-16">
                  <span className="hc-badge hc-badge-warning bk-wait-badge">
                    <span className="hc-pulse-dot bk-icon-gap"></span>
                    Đang chờ chuyển khoản (kiểm tra trạng thái mỗi 3 giây)...
                  </span>
                </div>

                <div className="hc-qr-box bk-mb-16">
                  {bookingData.qrInfo?.qrImageUrl && !qrImageFailed ? (
                    <img src={bookingData.qrInfo.qrImageUrl} alt="Mã VietQR thanh toán tiền cọc" onError={() => setQrImageFailed(true)} />
                  ) : (
                    <div className="bk-qr-fallback">
                      <i className="bi bi-qr-code bk-qr-fallback-icon" />
                      <span>{qrImageFailed ? "Không tải được ảnh QR. Vui lòng kiểm tra cấu hình VietQR." : "Đơn đặt phòng chưa có mã QR."}</span>
                    </div>
                  )}
                </div>

                <div className="bk-transfer-info">
                  <div className="bk-info-row">
                    <span className="bk-muted">Mã đặt phòng:</span>
                    <strong className="bk-strong-primary">{bookingData.bookingCode}</strong>
                  </div>
                  <div className="bk-info-row">
                    <span className="bk-muted">Ngân hàng thụ hưởng:</span>
                    <strong>
                      {bookingData.qrInfo?.bankId || "MB Bank"} - {bookingData.qrInfo?.accountNo || "090123456789"}
                    </strong>
                  </div>
                  <div className="bk-info-row">
                    <span className="bk-muted">Chủ tài khoản:</span>
                    <strong>{bookingData.qrInfo?.accountName || "HOTEL CALIFORNIA"}</strong>
                  </div>
                  <div className="bk-info-row">
                    <span className="bk-muted">Số tiền cọc:</span>
                    <strong className="bk-strong-error">{formatVND(bookingData.depositRequired)}</strong>
                  </div>
                  <div className="bk-info-row bk-info-row-flush">
                    <span className="bk-muted">Nội dung chuyển khoản:</span>
                    <strong className="bk-strong-text">{bookingData.qrInfo?.transferContent || bookingData.bookingCode}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="bk-success-wrap">
                <div className="bk-success-icon">
                  <i className="bi bi-check-lg"></i>
                </div>
                <h3 className="bk-success-title">Thanh Toán Cọc Thành Công!</h3>
                <p className="bk-success-text">
                  Đơn đặt phòng mã <strong>{bookingData.bookingCode}</strong> của quý khách đã được chuyển sang trạng thái <strong>XÁC NHẬN (CONFIRMED)</strong>.
                </p>

                <div className="bk-success-actions">
                  <Link to={authUser ? `/guest/services?bookingCode=${bookingData.bookingCode}` : "/login"} className="hc-btn hc-btn-primary" onClick={handleCloseQrModal}>
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
