import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiCall, formatVND } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import DatePicker from "../../components/DatePicker";
import SelectMenu from "../../components/SelectMenu";
import { parseISODate, toISODate, todayISO } from "../../components/dateUtils";

export default function StaffWalkInPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();

  const today = todayISO();
  const addDays = (iso, days) => {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + days);
    return toISODate(d);
  };
  const tomorrowStr = addDays(today, 1);

  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Form states
  const [roomId, setRoomId] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrowStr);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("Việt Nam");
  const [idType, setIdType] = useState("CCCD");
  const [idNumber, setIdNumber] = useState("");
  const [checkInImmediately, setCheckInImmediately] = useState(true);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAvailableRooms();
  }, [checkInDate, checkOutDate]);

  const loadAvailableRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await apiCall("/api/public/rooms/available", {
        method: "POST",
        body: { checkInDate, checkOutDate },
        silentError: true,
      });
      if (res && res.success) {
        setAvailableRooms(res.data || []);
        if (res.data.length > 0 && !roomId) {
          setRoomId(String(res.data[0].roomId));
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleCheckInChange = (iso) => {
    setCheckInDate(iso);
    if (checkOutDate <= iso) setCheckOutDate(addDays(iso, 1));
  };

  const roomOptions = availableRooms.length
    ? availableRooms.map((r) => ({
        value: String(r.roomId),
        label: `Phòng ${r.roomNumber} - ${r.roomTypeName} (${formatVND(r.basePrice)}/đêm)`,
      }))
    : [{ value: "", label: loadingRooms ? "Đang tải..." : "Không có phòng trống" }];

  const guestOptions = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} khách` }));

  const idTypeOptions = [
    { value: "CCCD", label: "CCCD / Căn cước" },
    { value: "PASSPORT", label: "Hộ chiếu" },
    { value: "OTHER", label: "Khác" },
  ];

  const paymentMethodOptions = [
    { value: "CASH", label: "Tiền mặt (CASH)" },
    { value: "TRANSFER", label: "Chuyển khoản (TRANSFER)" },
    { value: "CARD", label: "Thẻ ngân hàng (CARD)" },
  ];

  const selectedRoom = availableRooms.find((r) => String(r.roomId) === String(roomId));
  const nights = Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)) || 1);
  const roomPrice = selectedRoom ? selectedRoom.basePrice || 500000 : 500000;
  const totalAmount = roomPrice * nights;

  const handleSubmitWalkIn = async (e) => {
    e.preventDefault();
    if (!roomId) {
      addToast("Vui lòng chọn phòng trống cho khách!", "warning");
      return;
    }
    if (!fullName.trim() || !phone.trim()) {
      addToast("Vui lòng điền họ tên và số điện thoại khách hàng!", "warning");
      return;
    }

    setSubmitting(true);
    const payload = {
      roomId: parseInt(roomId),
      checkInDate,
      checkOutDate,
      guestCount: parseInt(guestCount),
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      nationality: nationality || "Việt Nam",
      idType,
      idNumber: idNumber.trim() || null,
      checkInImmediately,
      amountPaid: amountPaid ? parseFloat(amountPaid) : 0,
      paymentMethod: amountPaid && parseFloat(amountPaid) > 0 ? paymentMethod : "CASH",
      note: note.trim() || null,
    };

    try {
      const res = await apiCall("/api/staff/bookings/walk-in", {
        method: "POST",
        body: payload,
      });

      if (res && res.success) {
        addToast(`Đặt phòng Walk-in thành công cho khách ${fullName} (Mã: ${res.data.bookingCode})!`, "success");
        navigate("/staff/rooms");
      }
    } catch (err) {
      addToast(err.message || "Lỗi đặt phòng tại quầy", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ textAlign: "left" }}>
        <h2 style={{ textAlign: "left" }}>Đặt Phòng Tại Quầy (Walk-in Booking)</h2>
        <p>Xử lý khách vãng lai nhận phòng ngay tại sảnh lễ tân với tùy chọn check-in tức thì</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 1fr)", gap: "32px" }}>
        {/* Left Form */}
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-pencil-square text-primary" style={{ marginRight: "8px" }}></i>
              Phiếu Đăng Ký Lưu Trú Walk-in
            </div>
          </div>
          <div className="hc-card-body">
            <form onSubmit={handleSubmitWalkIn}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                <div className="hc-form-group">
                  <label className="hc-label">
                    Chọn phòng trống <span style={{ color: "var(--hc-error)" }}>*</span>
                  </label>
                  <SelectMenu value={roomId} onChange={setRoomId} options={roomOptions} ariaLabel="Chọn phòng trống" icon="bi-door-open" />
                </div>
                <div className="hc-form-group">
                  <label className="hc-label">Số khách</label>
                  <SelectMenu value={guestCount} onChange={setGuestCount} options={guestOptions} ariaLabel="Số khách" icon="bi-people" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="hc-form-group">
                  <label className="hc-label">Ngày nhận phòng</label>
                  <DatePicker value={checkInDate} onChange={handleCheckInChange} min={today} ariaLabel="Ngày nhận phòng" />
                </div>
                <div className="hc-form-group">
                  <label className="hc-label">Ngày trả phòng</label>
                  <DatePicker value={checkOutDate} onChange={setCheckOutDate} min={addDays(checkInDate, 1)} ariaLabel="Ngày trả phòng" />
                </div>
              </div>

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
                  <label className="hc-label">Email</label>
                  <input type="email" className="hc-input" placeholder="khach@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="hc-form-group">
                  <label className="hc-label">Quốc tịch</label>
                  <input type="text" className="hc-input" value={nationality} onChange={(e) => setNationality(e.target.value)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
                <div className="hc-form-group">
                  <label className="hc-label">Giấy tờ tùy thân</label>
                  <SelectMenu value={idType} onChange={setIdType} options={idTypeOptions} ariaLabel="Giấy tờ tùy thân" icon="bi-person-vcard" />
                </div>
                <div className="hc-form-group">
                  <label className="hc-label">Số CCCD / Hộ chiếu</label>
                  <input type="text" className="hc-input" placeholder="048201009988" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
                </div>
              </div>

              {/* Immediate Check-In Switch */}
              <div style={{ background: "var(--hc-bg)", padding: "14px 18px", borderRadius: "var(--hc-radius-md)", marginBottom: "20px", border: "1px solid var(--hc-border)" }}>
                <label className="hc-switch">
                  <input type="checkbox" checked={checkInImmediately} onChange={(e) => setCheckInImmediately(e.target.checked)} />
                  <div>
                    <strong>Nhận phòng ngay (Check-in tức thì)</strong>
                    <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)" }}>Tự động chuyển trạng thái phòng sang ĐANG Ở (OCCUPIED) ngay khi lưu đơn.</div>
                  </div>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="hc-form-group">
                  <label className="hc-label">Số tiền khách đã trả / cọc tại quầy (VNĐ)</label>
                  <input type="number" className="hc-input" placeholder="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
                  <div className="hc-help-text">Được hạch toán vào ca thu ngân hiện tại.</div>
                </div>
                <div className="hc-form-group">
                  <label className="hc-label">Phương thức thanh toán</label>
                  <SelectMenu value={paymentMethod} onChange={setPaymentMethod} options={paymentMethodOptions} ariaLabel="Phương thức thanh toán" icon="bi-credit-card" />
                </div>
              </div>

              <div className="hc-form-group">
                <label className="hc-label">Ghi chú lễ tân</label>
                <textarea className="hc-textarea" rows="2" placeholder="Khách nhận phòng trực tiếp..." value={note} onChange={(e) => setNote(e.target.value)}></textarea>
              </div>

              <button type="submit" className="hc-btn hc-btn-primary hc-btn-lg" style={{ width: "100%", marginTop: "8px" }} disabled={submitting}>
                {submitting ? "Đang xử lý..." : "Xác Nhận Đặt Phòng & Nhận Khách →"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Summary */}
        <div>
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="hc-card-title">
                <i className="bi bi-calculator text-primary" style={{ marginRight: "8px" }}></i>
                Tóm Tắt Dự Toán
              </div>
            </div>
            <div className="hc-card-body">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
                <span style={{ color: "var(--hc-text-secondary)" }}>Phòng:</span>
                <strong>{selectedRoom ? `Phòng ${selectedRoom.roomNumber} (${selectedRoom.roomTypeName})` : "Chưa chọn"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
                <span style={{ color: "var(--hc-text-secondary)" }}>Đơn giá:</span>
                <span>{formatVND(roomPrice)} / đêm</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
                <span style={{ color: "var(--hc-text-secondary)" }}>Thời gian:</span>
                <span>{nights} đêm</span>
              </div>

              <hr className="hc-divider" />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontWeight: 700, fontSize: "16px" }}>Tổng tiền phòng:</span>
                <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--hc-primary)" }}>{formatVND(totalAmount)}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", color: "var(--hc-success)" }}>
                <span>Tiền nhận trước ({paymentMethod}):</span>
                <strong style={{ fontSize: "16px" }}>{formatVND(amountPaid || 0)}</strong>
              </div>

              <div
                style={{
                  background: "var(--hc-bg)",
                  padding: "14px",
                  borderRadius: "var(--hc-radius-md)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px solid var(--hc-border)",
                }}
              >
                <span style={{ fontWeight: 600 }}>Còn nợ lại (Balance):</span>
                <strong style={{ color: "var(--hc-error)", fontSize: "16px" }}>{formatVND(Math.max(0, totalAmount - (parseFloat(amountPaid) || 0)))}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
