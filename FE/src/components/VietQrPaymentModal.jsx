import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal";
import { apiCall, formatVND } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import "./VietQrPaymentModal.css";

export default function VietQrPaymentModal({
  isOpen,
  onClose,
  bookingCode = "",
  amount = 0,
  type = "DEPOSIT", // "DEPOSIT" | "SETTLEMENT"
  title,
  qrInfo,
  redirectUrl,
  onSuccess,
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [qrImageFailed, setQrImageFailed] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [countdown, setCountdown] = useState(3);

  const pollingRef = useRef(null);
  const countdownRef = useRef(null);

  // Bank & QR Info preparation
  const bankId = qrInfo?.bankId || "MB";
  const accountNo = qrInfo?.accountNo || "090123456789";
  const accountName = qrInfo?.accountName || "KHACH SAN PBL6";
  const cleanCode = (bookingCode || "").trim().toUpperCase();
  const transferContent =
    qrInfo?.transferContent || (type === "SETTLEMENT" ? `PBL6 SETTLE ${cleanCode}` : `PBL6 ${cleanCode}`);

  const qrImageUrl =
    qrInfo?.qrImageUrl ||
    `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${Math.round(amount || 0)}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;

  // Polling payment status
  useEffect(() => {
    if (!isOpen || paymentSuccess || !cleanCode) return;

    const checkStatus = async () => {
      try {
        if (type === "SETTLEMENT") {
          const res = await apiCall(`/api/public/bookings/${cleanCode}/folio`, { silentError: true });
          if (res && res.success && res.data) {
            const isSettled = res.data.isFullySettled || (res.data.remainingBalance != null && res.data.remainingBalance <= 0) || res.data.bookingStatus === "CHECKED_OUT";
            if (isSettled) {
              handlePaymentSuccess(res.data);
            }
          }
        } else {
          const res = await apiCall(`/api/public/bookings/${cleanCode}/payment-status`, { silentError: true });
          if (res && res.success && res.data) {
            const isPaid = res.data.isPaid || res.data.status === "CONFIRMED" || res.data.bookingStatus === "CONFIRMED";
            if (isPaid) {
              handlePaymentSuccess(res.data);
            }
          }
        }
      } catch {
        // silent polling failure
      }
    };

    // Immediate first check
    checkStatus();

    // Poll every 3 seconds
    pollingRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen, paymentSuccess, cleanCode, type]);

  const handlePaymentSuccess = (data) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPaymentSuccess(true);
    addToast(
      type === "SETTLEMENT"
        ? "Tất toán chi phí phòng thành công!"
        : "Thanh toán tiền cọc thành công! Đơn đặt phòng đã được xác nhận.",
      "success",
      5000
    );

    if (onSuccess) {
      onSuccess(data);
    }

    // Start 3s countdown for auto redirect
    let timer = 3;
    setCountdown(timer);
    countdownRef.current = setInterval(() => {
      timer -= 1;
      setCountdown(timer);
      if (timer <= 0) {
        clearInterval(countdownRef.current);
        if (redirectUrl) {
          navigate(redirectUrl);
          onClose();
        }
      }
    }, 1000);
  };

  // Cleanup on close
  const handleModalClose = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setPaymentSuccess(false);
    onClose();
  };

  // Simulate instant payment (for demo / testing)
  const handleSimulatePayment = async () => {
    if (!cleanCode) return;
    setSimulating(true);
    try {
      const endpoint =
        type === "SETTLEMENT"
          ? `/api/public/bookings/${cleanCode}/simulate-settlement`
          : `/api/public/bookings/${cleanCode}/simulate-deposit`;

      const res = await apiCall(endpoint, { method: "POST" });
      if (res && res.success) {
        handlePaymentSuccess(res.data);
      } else {
        addToast("Không thể giả lập thanh toán lúc này", "error");
      }
    } catch (err) {
      addToast(err.message || "Lỗi giả lập thanh toán", "error");
    } finally {
      setSimulating(false);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    addToast(`Đã sao chép: ${text}`, "info", 2000);
    setTimeout(() => {
      setCopiedKey("");
    }, 2000);
  };

  const modalTitle =
    title ||
    (type === "SETTLEMENT"
      ? "Thanh Toán Hóa Đơn Qua VietQR"
      : "Thanh Toán Tiền Cọc Qua VietQR");

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={modalTitle}
      maxWidth="500px"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={handleModalClose}>
            {paymentSuccess ? "Đóng" : "Hủy & Để sau"}
          </button>
          {!paymentSuccess && (
            <button
              type="button"
              className="hc-btn hc-btn-outline hc-btn-sm"
              onClick={handleSimulatePayment}
              disabled={simulating}
              title="Dành cho Demo / Thuyết trình đồ án kiểm thử nhanh"
              style={{ fontSize: "11px", borderColor: "var(--hc-primary-light)", color: "var(--hc-primary)" }}
            >
              <i className="bi bi-lightning-charge-fill text-warning"></i>{" "}
              {simulating ? "Đang xử lý..." : "Giả lập thanh toán (Demo)"}
            </button>
          )}
        </div>
      }
    >
      <div className="vq-modal-body">
        {!paymentSuccess ? (
          <>
            {/* Live Polling Status Badge */}
            <div className="vq-status-bar">
              <span className="vq-wait-badge">
                <span className="hc-pulse-dot"></span>
                Đang chờ chuyển khoản (tự động kiểm tra mỗi 3s)...
              </span>
            </div>

            {/* Dynamic VietQR Image Card */}
            <div className="vq-qr-card">
              {!qrImageFailed ? (
                <img
                  src={qrImageUrl}
                  alt={`Mã VietQR thanh toán ${formatVND(amount)}`}
                  className="vq-qr-img"
                  onError={() => setQrImageFailed(true)}
                />
              ) : (
                <div className="vq-qr-fallback">
                  <i className="bi bi-qr-code"></i>
                  <span>Không tải được ảnh VietQR trực tiếp. Vui lòng chuyển khoản theo thông tin bên dưới.</span>
                </div>
              )}
              <span className="vq-qr-hint">
                <i className="bi bi-shield-check text-success"></i> VietQR chuẩn Napas 24/7
              </span>
            </div>

            {/* Payment Details */}
            <div className="vq-info-card">
              <div className="vq-info-row">
                <span className="vq-info-label">Số tiền thanh toán:</span>
                <span className="vq-amount-highlight">{formatVND(amount)}</span>
              </div>

              <div className="vq-info-row">
                <span className="vq-info-label">Mã đặt phòng:</span>
                <div className="vq-info-value-wrap">
                  <strong style={{ color: "var(--hc-primary)" }}>{cleanCode}</strong>
                </div>
              </div>

              <div className="vq-info-row">
                <span className="vq-info-label">Nội dung chuyển khoản:</span>
                <div className="vq-info-value-wrap">
                  <span className="vq-content-highlight">{transferContent}</span>
                  <button
                    type="button"
                    className={`vq-copy-btn ${copiedKey === "content" ? "copied" : ""}`}
                    onClick={() => handleCopy(transferContent, "content")}
                    title="Sao chép nội dung"
                  >
                    <i className={`bi ${copiedKey === "content" ? "bi-check2" : "bi-copy"}`}></i>
                    {copiedKey === "content" ? "Đã chép" : "Sao chép"}
                  </button>
                </div>
              </div>

              <div className="vq-info-row">
                <span className="vq-info-label">Ngân hàng thụ hưởng:</span>
                <div className="vq-info-value-wrap">
                  <span>{bankId === "MB" ? "MB Bank (Ngân hàng Quân Đội)" : bankId}</span>
                </div>
              </div>

              <div className="vq-info-row">
                <span className="vq-info-label">Số tài khoản:</span>
                <div className="vq-info-value-wrap">
                  <strong>{accountNo}</strong>
                  <button
                    type="button"
                    className={`vq-copy-btn ${copiedKey === "account" ? "copied" : ""}`}
                    onClick={() => handleCopy(accountNo, "account")}
                    title="Sao chép số tài khoản"
                  >
                    <i className={`bi ${copiedKey === "account" ? "bi-check2" : "bi-copy"}`}></i>
                    {copiedKey === "account" ? "Đã chép" : "Sao chép"}
                  </button>
                </div>
              </div>

              <div className="vq-info-row">
                <span className="vq-info-label">Chủ tài khoản:</span>
                <div className="vq-info-value-wrap">
                  <strong>{accountName}</strong>
                </div>
              </div>
            </div>

            {/* Warning Note */}
            <div className="vq-note-box">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>
                <strong>Lưu ý:</strong> Vui lòng giữ nguyên nội dung chuyển khoản <code>{transferContent}</code> để hệ thống tự động nhận diện và kích hoạt phòng ngay lập tức.
              </span>
            </div>
          </>
        ) : (
          /* Payment Success State */
          <div className="vq-success-wrap">
            <div className="vq-success-icon">
              <i className="bi bi-check-lg"></i>
            </div>
            <h3 className="vq-success-title">Thanh Toán Thành Công!</h3>
            <p className="vq-success-desc">
              Hệ thống đã nhận được <strong>{formatVND(amount)}</strong> cho đơn đặt phòng <strong>{cleanCode}</strong>. Trạng thái thanh toán đã được cập nhật thành công!
            </p>

            {redirectUrl && (
              <div className="vq-countdown-badge">
                <i className="bi bi-arrow-repeat spin"></i>
                Tự động chuyển hướng sau <strong>{countdown}s</strong>...
              </div>
            )}

            <div className="vq-success-actions">
              {redirectUrl ? (
                <button
                  type="button"
                  className="hc-btn hc-btn-primary"
                  onClick={() => {
                    navigate(redirectUrl);
                    onClose();
                  }}
                >
                  <i className="bi bi-arrow-right-circle"></i> Chuyển tiếp ngay
                </button>
              ) : (
                <button type="button" className="hc-btn hc-btn-primary" onClick={handleModalClose}>
                  <i className="bi bi-check-circle"></i> Hoàn tất
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

