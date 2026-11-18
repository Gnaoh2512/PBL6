import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import Modal from "../../components/common/Modal";
import VietQrPaymentModal from "../../components/payment/VietQrPaymentModal";
import { apiCall, formatVND, formatDateTime, getCategoryName, getCategoryTone } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import "../../styles/GuestPages.css";
import "./ServicesPage.css";
import Paginated from "../../components/common/TablePagination";
import { renderServiceStatusBadge } from "../../components/common/ServiceStatusBadge";
import { bookingStatusLabel, benefitTypeLabel } from "../../utils/labels";

// "Cà phê" -> "ca phe", so searching works with or without Vietnamese accents.
const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

const isCheckedIn = (b) => String(b?.status || b?.bookingStatus || "").toUpperCase() === "CHECKED_IN";

function PageShell({ portal, children }) {
  return portal ? (
    <div className="ops-page guest-page">{children}</div>
  ) : (
    <main className="hc-page services-experience">
      <div className="hc-container guest-page">{children}</div>
    </main>
  );
}

export default function ServicesPage({ portal = false }) {
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  // Keep addToast in a ref so data-loading callbacks stay stable and effects don't re-run.
  const toastRef = useRef(addToast);
  toastRef.current = addToast;
  const notify = useCallback((message, type) => toastRef.current(message, type), []);

  const queryCode = (searchParams.get("bookingCode") || "").trim().toUpperCase();
  const [bookingCode, setBookingCode] = useState(queryCode);
  const [myBookings, setMyBookings] = useState([]); // only CHECKED_IN bookings
  const [loadingBookings, setLoadingBookings] = useState(portal);
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Folio state
  const [folio, setFolio] = useState(null);
  const [loadingFolio, setLoadingFolio] = useState(false);
  const [qrPaymentOpen, setQrPaymentOpen] = useState(false);
  const folioRequestId = useRef(0);

  // Loyalty state
  const [loyaltyBenefits, setLoyaltyBenefits] = useState([]);

  // Unified request modal (normal service OR loyalty benefit)
  const [requestItem, setRequestItem] = useState(null); // { kind: "SERVICE" | "BENEFIT", data }
  const [quantity, setQuantity] = useState(1);
  const [requestNote, setRequestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadFolio = useCallback(
    async (code) => {
      const trimmed = String(code || "")
        .trim()
        .toUpperCase();
      if (!trimmed) {
        setFolio(null);
        return;
      }

      const requestId = ++folioRequestId.current;
      setLoadingFolio(true);
      try {
        const res = await apiCall(`/api/public/bookings/${trimmed}/folio`);
        if (requestId !== folioRequestId.current) return; // a newer request replaced this one
        if (res && res.success) {
          setFolio(res.data);
        } else {
          setFolio(null);
          notify(res?.message || "Không tìm thấy hóa đơn lưu trú", "error");
        }
      } catch (err) {
        if (requestId !== folioRequestId.current) return;
        setFolio(null);
        notify(err.message || "Không tìm thấy hóa đơn", "error");
      } finally {
        if (requestId === folioRequestId.current) setLoadingFolio(false);
      }
    },
    [notify],
  );

  const reloadBenefits = useCallback(async () => {
    try {
      const res = await apiCall("/api/customer/loyalty/benefits", { silentError: true });
      if (res && res.success && res.data) {
        setLoyaltyBenefits(res.data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      try {
        const res = await apiCall("/api/public/services", { silentError: true });
        if (!cancelled && res && res.success) setServices(res.data || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    }

    async function loadBookings() {
      try {
        const bRes = await apiCall("/api/customer/bookings/history", { silentError: true });
        if (cancelled) return;
        // Only checked-in bookings can order services
        const checkedIn = bRes && bRes.success && Array.isArray(bRes.data) ? bRes.data.filter(isCheckedIn) : [];
        setMyBookings(checkedIn);

        const initial = queryCode || checkedIn[0]?.bookingCode || "";
        if (initial) {
          setBookingCode(initial);
          loadFolio(initial);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingBookings(false);
      }
    }

    loadServices();

    if (portal) {
      reloadBenefits();
      loadBookings();
    } else if (queryCode) {
      setBookingCode(queryCode);
      loadFolio(queryCode);
    }

    return () => {
      cancelled = true;
    };
  }, [portal, queryCode, loadFolio, reloadBenefits]);

  // ── Derived data ──────────────────────────────────────────────
  const categoryNames = Array.from(new Set(services.map((s) => getCategoryName(s.categoryName || s.category || s)).filter(Boolean)));

  const normalizedSearch = normalizeText(searchTerm);
  const filteredServices = services.filter((s) => {
    const cat = getCategoryName(s.categoryName || s.category || s);
    if (selectedCategory !== "ALL" && cat !== selectedCategory) return false;
    if (!normalizedSearch) return true;
    return normalizeText(`${s.serviceName || ""} ${cat || ""} ${s.unit || ""}`).includes(normalizedSearch);
  });

  const filteredBenefits = loyaltyBenefits.filter((b) => {
    if (!normalizedSearch) return true;
    return normalizeText(`${b.benefitName || ""} ${b.description || ""} ${b.tierName || ""}`).includes(normalizedSearch);
  });

  const remainingBalance = folio ? (folio.finalBalance ?? folio.balanceDue ?? folio.remainingBalance ?? 0) : 0;

  // Ordering is only allowed for a checked-in booking
  const folioCheckedIn = !!folio && String(folio.bookingStatus || "").toUpperCase() === "CHECKED_IN";
  let blockedReason = "";
  if (portal && !loadingBookings && myBookings.length === 0) {
    blockedReason = "Bạn cần có ít nhất 1 phòng đã check-in để gọi dịch vụ hoặc dùng đặc quyền.";
  } else if (!folio) {
    blockedReason = "Vui lòng chọn phòng đang lưu trú để gọi dịch vụ.";
  } else if (!folioCheckedIn) {
    blockedReason = "Phòng này chưa check-in nên chưa thể gọi dịch vụ.";
  }
  const canOrder = !blockedReason;
  const showBlockedNotice = !!blockedReason && !loadingBookings && !loadingFolio;

  // ── Handlers ──────────────────────────────────────────────────
  const handleSelectBooking = (code) => {
    if (code === bookingCode) return;
    setBookingCode(code);
    loadFolio(code);
  };

  const openRequest = (kind, data) => {
    if (!canOrder) {
      notify(blockedReason, "warning");
      return;
    }
    if (kind === "BENEFIT" && data.remainingQuota === 0) {
      notify("Ưu đãi này đã hết lượt sử dụng trong kỳ", "warning");
      return;
    }
    setRequestItem({
      kind,
      data,
      requestKey: kind === "BENEFIT" ? window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}` : null,
    });
    setQuantity(1);
    setRequestNote("");
  };

  const closeRequest = () => setRequestItem(null);

  const handleSubmitRequest = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!requestItem || !canOrder || submitting) return;

    const code = bookingCode.trim().toUpperCase();
    const note = requestNote.trim() || null;
    const { kind, data, requestKey } = requestItem;

    setSubmitting(true);
    try {
      let res;
      if (kind === "SERVICE") {
        const qty = Math.min(50, Math.max(1, parseInt(quantity, 10) || 1));
        res = await apiCall("/api/public/services/order", {
          method: "POST",
          body: { bookingCode: code, serviceId: data.serviceId, quantity: qty, note },
        });
      } else {
        res = await apiCall("/api/customer/loyalty/redeem", {
          method: "POST",
          body: {
            tierBenefitId: data.tierBenefitId,
            bookingCode: code,
            note,
            idempotencyKey: requestKey,
          },
        });
      }

      if (res && res.success) {
        notify(kind === "SERVICE" ? `Đã thêm dịch vụ "${data.serviceName}" vào phòng thành công!` : `Đã gửi yêu cầu đặc quyền "${data.benefitName}"!`, "success");
        closeRequest();
        if (kind === "BENEFIT") reloadBenefits();
        loadFolio(code);
      } else {
        notify(res?.message || "Không thể gửi yêu cầu này", "error");
      }
    } catch (err) {
      notify(err.message || (kind === "SERVICE" ? "Lỗi đặt dịch vụ" : "Lỗi khi áp dụng ưu đãi"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────
  const renderServicesTable = () => {
    if (loadingServices) {
      return (
        <div className="hc-loading-spinner">
          <div className="hc-spinner"></div>
        </div>
      );
    }
    if (filteredServices.length === 0) {
      return (
        <div className="hc-empty-state">
          <i className="bi bi-cup-hot"></i>
          <p>{searchTerm.trim() ? `Không tìm thấy dịch vụ nào khớp với "${searchTerm.trim()}".` : "Chưa có dịch vụ nào trong danh mục này."}</p>
        </div>
      );
    }
    return (
      <Paginated items={filteredServices}>
        {(pageRows, pager) => (
          <>
            <div className="hc-card-body flush u-scroll-x">
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Dịch vụ</th>
                    <th>Danh mục</th>
                    <th>Đơn giá</th>
                    <th className="col-actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s) => {
                    const categoryName = getCategoryName(s.categoryName || s.category || s);
                    return (
                      <tr
                        key={s.serviceId}
                        className={canOrder ? "row-clickable" : undefined}
                        tabIndex={0}
                        title="Thêm dịch vụ vào hóa đơn phòng"
                        onClick={() => canOrder && openRequest("SERVICE", s)}
                        onKeyDown={(e) => {
                          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            canOrder && openRequest("SERVICE", s);
                          }
                        }}
                      >
                        <td>
                          <strong>{s.serviceName}</strong>
                          {s.description && <div className="guest-cell-sub">{s.description}</div>}
                        </td>
                        <td>{categoryName ? <span className={`hc-badge hc-badge-${getCategoryTone(categoryName)}`}>{categoryName}</span> : "—"}</td>
                        <td>
                          <span className="svc-price">{formatVND(s.unitPrice)}</span>
                          <span className="guest-cell-sub svc-unit">/ {s.unit || "Lần"}</span>
                        </td>
                        <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            onClick={() => openRequest("SERVICE", s)}
                            disabled={!canOrder}
                            title={canOrder ? "Thêm dịch vụ vào hóa đơn phòng" : blockedReason}
                          >
                            <i className="bi bi-plus-lg"></i> Thêm vào phòng
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pager}
          </>
        )}
      </Paginated>
    );
  };

  const renderBenefitsTable = () => (
    <div>
      {filteredBenefits.length === 0 ? (
        <div className="hc-empty-state">
          <i className="bi bi-shield-lock"></i>
          <p style={{ maxWidth: "420px", margin: "0 auto" }}>
            {searchTerm.trim()
              ? `Không tìm thấy đặc quyền nào khớp với "${searchTerm.trim()}".`
              : `Hạng thẻ hiện tại chưa có đặc quyền sử dụng trực tiếp. Tích lũy thêm điểm lưu trú để nâng hạng và mở khóa ưu đãi.`}
          </p>
        </div>
      ) : (
        <Paginated items={filteredBenefits}>
          {(pageRows, pager) => (
            <>
              <div className="hc-card-body flush" style={{ overflowX: "auto", marginTop: "14px" }}>
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>Đặc quyền</th>
                      <th>Hạng</th>
                      <th>Lượt dùng</th>
                      <th className="col-actions">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((b) => {
                      const exhausted = b.remainingQuota === 0;
                      return (
                        <tr
                          key={b.tierBenefitId}
                          className={canOrder && !exhausted ? "row-clickable" : undefined}
                          tabIndex={0}
                          title="Gửi yêu cầu sử dụng đặc quyền"
                          onClick={() => canOrder && !exhausted && openRequest("BENEFIT", b)}
                          onKeyDown={(e) => {
                            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              canOrder && !exhausted && openRequest("BENEFIT", b);
                            }
                          }}
                        >
                          <td>
                            <strong>{b.benefitName}</strong>
                            <div className="guest-cell-sub">{b.description || (b.discountPercent ? `Ưu đãi giảm giá ${b.discountPercent}% chi phí dịch vụ tại resort.` : benefitTypeLabel(b.benefitType))}</div>
                          </td>
                          <td>
                            <span className="hc-badge hc-badge-primary">
                              <i className="bi bi-shield-check"></i> {b.tierName}
                            </span>
                            {b.discountPercent ? (
                              <div style={{ marginTop: "4px" }}>
                                <span className="hc-badge hc-badge-success">Giảm {b.discountPercent}%</span>
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <span className="svc-benefit-quota">{b.remainingQuota != null ? `Còn ${b.remainingQuota} lượt` : "Không giới hạn"}</span>
                          </td>
                          <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="hc-btn hc-btn-primary hc-btn-sm"
                              onClick={() => openRequest("BENEFIT", b)}
                              disabled={!canOrder || exhausted}
                              title={!canOrder ? blockedReason : exhausted ? "Đã hết lượt trong kỳ" : "Gửi yêu cầu sử dụng đặc quyền"}
                            >
                              <i className="bi bi-stars"></i> {exhausted ? "Hết lượt" : "Yêu cầu"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pager}
            </>
          )}
        </Paginated>
      )}
    </div>
  );

  const renderFolio = () => {
    if (loadingFolio && !folio) {
      return (
        <div className="hc-loading-spinner">
          <div className="hc-spinner"></div>
        </div>
      );
    }
    if (!folio) {
      return (
        <div className="hc-empty-state">
          <i className="bi bi-receipt-cutoff"></i>
          <p style={{ maxWidth: "320px", margin: "0 auto" }}>
            {portal && !loadingBookings && myBookings.length === 0 ? "Bạn chưa có phòng nào đang lưu trú. Hóa đơn sẽ hiển thị sau khi bạn check-in." : "Chọn phòng đang lưu trú để xem các khoản phí."}
          </p>
        </div>
      );
    }

    const usages = folio.services || folio.serviceUsages || [];

    return (
      <div className="hc-card-body">
        <div className="svc-folio-banner">
          <div className="svc-folio-banner-head">
            <span className="svc-folio-code">{folio.bookingCode}</span>
            <span className={`hc-badge hc-badge-booking-${folio.bookingStatus || "CONFIRMED"}`}>{folio.bookingStatus ? bookingStatusLabel(folio.bookingStatus) : "Đang lưu trú"}</span>
          </div>
          <div className="svc-folio-meta">
            Khách hàng: <strong>{folio.customerName || "—"}</strong>
            <span style={{ margin: "0 8px" }}>|</span>
            Phòng: <strong>{folio.roomNumber ? `Phòng ${folio.roomNumber}` : "—"}</strong>
          </div>
        </div>

        <div className="svc-folio-head-row">
          <div className="svc-folio-section-title" style={{ margin: 0 }}>
            Dịch vụ đã phát sinh
          </div>
        </div>

        {usages.length === 0 ? (
          <div className="svc-folio-empty">Chưa có dịch vụ nào được gọi thêm</div>
        ) : (
          <div style={{ overflowX: "auto", margin: "0 -22px" }}>
            <Paginated items={usages}>
              {(pageRows, pager) => (
                <>
                  <table className="hc-table">
                    <thead>
                      <tr>
                        <th>Dịch vụ</th>
                        <th className="u-text-center">Trạng thái</th>
                        <th className="u-text-center">SL</th>
                        <th className="u-text-right">Đơn giá</th>
                        <th className="u-text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((u, idx) => {
                        const canceled = u.status === "CANCELED" || u.status === "CANCELLED";
                        const isBenefit = Boolean(u.tierBenefitId || u.benefitName || u.source === "LOYALTY");
                        return (
                          <tr key={u.usageId || idx}>
                            <td>
                              <strong>{u.serviceName || u.benefitName}</strong>
                              {isBenefit && (
                                <span className="hc-badge hc-badge-primary" style={{ marginLeft: "6px" }}>
                                  <i className="bi bi-gem"></i> Đặc quyền
                                </span>
                              )}
                              <div className="guest-cell-sub">{formatDateTime(u.orderTime || u.usedAt)}</div>
                            </td>
                            <td className="u-text-center">{renderServiceStatusBadge(u.status)}</td>
                            <td className="u-text-center">{u.quantity}</td>
                            <td className="u-text-right">{formatVND(u.unitPrice || u.unitPriceApplied)}</td>
                            <td className="u-fw-600 u-text-right">
                              {canceled ? (
                                <span style={{ textDecoration: "line-through", color: "var(--hc-text-muted)" }} title="Dịch vụ đã hủy, không tính tiền">
                                  {formatVND(u.totalAmount || u.totalPrice)}
                                </span>
                              ) : (
                                formatVND(u.totalAmount || u.totalPrice)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {pager}
                </>
              )}
            </Paginated>
          </div>
        )}

        <div className="svc-sum">
          <div className="hc-sum-row">
            <span>Tiền phòng lưu trú</span>
            <strong>{formatVND(folio.roomCharge)}</strong>
          </div>
          <div className="hc-sum-row">
            <span>Tiền dịch vụ phát sinh</span>
            <strong>{formatVND(folio.serviceCharge)}</strong>
          </div>
          {folio.discountAmount > 0 && (
            <div className="hc-sum-row is-discount u-text-success">
              <span>Ưu đãi voucher</span>
              <strong>- {formatVND(folio.discountAmount)}</strong>
            </div>
          )}
          <div className="hc-sum-row">
            <span>Thuế giá trị gia tăng (10%)</span>
            <strong>{formatVND(folio.taxAmount)}</strong>
          </div>
          <hr className="hc-divider" style={{ margin: "10px 0" }} />
          <div className="hc-sum-row is-total" style={{ fontWeight: 700, fontSize: "15px" }}>
            <span>Tổng chi phí</span>
            <span>{formatVND(folio.totalAmount)}</span>
          </div>
          <div className="hc-sum-row is-deposit u-text-success">
            <span>Tiền cọc / Đã trả</span>
            <strong>- {formatVND(folio.depositPaid ?? folio.depositApplied ?? folio.depositAmount ?? 0)}</strong>
          </div>

          <div className="svc-balance" style={{ marginTop: "12px" }}>
            <span>Số tiền cần thanh toán</span>
            <span className="svc-balance-amount">{formatVND(remainingBalance)}</span>
          </div>

          {remainingBalance > 0 && !folio.isFullySettled && folio.bookingStatus !== "CANCELED" && (
            <div style={{ marginTop: "16px" }}>
              <button type="button" className="hc-btn hc-btn-primary" onClick={() => setQrPaymentOpen(true)} style={{ width: "100%", justifyContent: "center" }}>
                <i className="bi bi-qr-code-scan"></i> Thanh toán VietQR ({formatVND(remainingBalance)})
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isBenefitRequest = requestItem?.kind === "BENEFIT";

  return (
    <>
      {!portal && <Navbar />}

      <PageShell portal={portal}>
        {/* Page Title */}
        <div className="hc-page-title">
          <div>
            <h2>Dịch Vụ &amp; Hóa Đơn</h2>
            <p>Gọi món, dùng đặc quyền hội viên và theo dõi chi phí phòng theo thời gian thực.</p>
          </div>

          <div className="guest-title-actions">
            {portal && (
              <Link to="/guest/loyalty" className="hc-btn hc-btn-outline">
                <i className="bi bi-gem"></i> Đặc quyền hội viên
              </Link>
            )}
            {portal && (
              <Link to="/guest/bookings" className="hc-btn hc-btn-outline">
                <i className="bi bi-clock-history"></i> Lịch sử đặt phòng
              </Link>
            )}
            {!portal && (
              <Link to="/" className="hc-btn hc-btn-outline">
                <i className="bi bi-house-door"></i> Trở về trang chủ
              </Link>
            )}
          </div>
        </div>

        {/* Room picker: checked-in rooms only */}
        {portal && myBookings.length > 0 && (
          <div className="svc-room-bar" role="radiogroup" aria-label="Chọn phòng đang lưu trú">
            <span className="svc-room-bar-label">
              <i className="bi bi-door-open"></i> Phòng đang lưu trú
            </span>
            {myBookings.map((b) => (
              <button
                key={b.bookingCode}
                type="button"
                role="radio"
                aria-checked={bookingCode === b.bookingCode}
                className={`svc-room-chip ${bookingCode === b.bookingCode ? "active" : ""}`}
                onClick={() => handleSelectBooking(b.bookingCode)}
              >
                <strong>{b.roomNumber ? `Phòng ${b.roomNumber}` : b.roomTypeName || "Phòng"}</strong>
                <span>{b.bookingCode}</span>
              </button>
            ))}
          </div>
        )}

        {/* Ordering blocked notice */}
        {showBlockedNotice && (
          <div className="svc-notice" role="status">
            <i className="bi bi-info-circle-fill"></i>
            <div>{blockedReason}</div>
          </div>
        )}

        {/* Main 2-column layout */}
        <div className="svc-layout">
          {/* Left: Menu */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-menu-button-wide text-primary"></i> Menu dịch vụ
                </div>

                <div className="guest-toolbar-controls">
                  <div className="guest-search">
                    <i className="bi bi-search"></i>
                    <input
                      type="text"
                      className="hc-input"
                      placeholder="Tìm món, dịch vụ, ưu đãi..."
                      aria-label="Tìm trong menu dịch vụ"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="svc-cat-tabs">
              <button type="button" className={`svc-cat-tab ${selectedCategory === "ALL" ? "active" : ""}`} onClick={() => setSelectedCategory("ALL")}>
                <i className="bi bi-grid"></i> Tất cả ({services.length})
              </button>
              {portal && (
                <button type="button" className={`svc-cat-tab is-loyalty ${selectedCategory === "LOYALTY" ? "active" : ""}`} onClick={() => setSelectedCategory("LOYALTY")}>
                  <i className="bi bi-gem"></i> Đặc quyền hội viên ({loyaltyBenefits.length})
                </button>
              )}
              {categoryNames.map((c) => (
                <button key={c} type="button" className={`svc-cat-tab ${selectedCategory === c ? "active" : ""}`} onClick={() => setSelectedCategory(c)}>
                  {c}
                </button>
              ))}
            </div>

            {selectedCategory === "LOYALTY" && portal ? renderBenefitsTable() : renderServicesTable()}
          </div>

          {/* Right: Folio */}
          <div className="hc-card svc-folio-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-receipt text-primary"></i> Hóa đơn lưu trú
                </div>
                {folio && (
                  <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => loadFolio(bookingCode)} disabled={loadingFolio} title="Làm mới hóa đơn">
                    <i className="bi bi-arrow-clockwise"></i> Làm mới
                  </button>
                )}
              </div>
            </div>
            {renderFolio()}
          </div>
        </div>
      </PageShell>

      {/* Dynamic VietQR Payment Modal for Folio */}
      {folio && (
        <VietQrPaymentModal
          isOpen={qrPaymentOpen}
          onClose={() => setQrPaymentOpen(false)}
          bookingCode={folio.bookingCode}
          amount={remainingBalance}
          type="SETTLEMENT"
          title={`Thanh Toán Hóa Đơn #${folio.bookingCode}`}
          qrInfo={folio.settlementQr}
          onSuccess={() => loadFolio(folio.bookingCode)}
        />
      )}

      {/* Unified request modal: normal service or loyalty benefit */}
      <Modal
        isOpen={!!requestItem}
        onClose={closeRequest}
        title={isBenefitRequest ? "Yêu Cầu Đặc Quyền Hội Viên" : "Thêm Dịch Vụ Vào Phòng"}
        subtitle={isBenefitRequest ? "Sử dụng quyền lợi theo hạng hội viên của bạn" : "Dịch vụ sẽ được ghi vào hóa đơn lưu trú"}
        icon={isBenefitRequest ? "bi-gem" : "bi-cup-hot"}
        maxWidth="460px"
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={closeRequest}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSubmitRequest} disabled={submitting}>
              {isBenefitRequest && <i className="bi bi-stars"></i>} {submitting ? "Đang gửi..." : isBenefitRequest ? "Xác nhận dùng" : "Xác nhận đặt"}
            </button>
          </div>
        }
      >
        {requestItem && (
          <form onSubmit={handleSubmitRequest}>
            <div className="svc-order-summary">
              {isBenefitRequest ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span className="hc-badge hc-badge-primary">
                      <i className="bi bi-gem"></i> {requestItem.data.tierName}
                    </span>
                    <span className="guest-cell-sub">{requestItem.data.remainingQuota != null ? `Còn ${requestItem.data.remainingQuota} lượt` : "Không giới hạn"}</span>
                  </div>
                  <strong style={{ fontSize: "16px", color: "var(--hc-primary-dark)" }}>{requestItem.data.benefitName}</strong>
                  <div style={{ fontSize: "13px", color: "var(--hc-text-secondary)", marginTop: "4px" }}>
                    {requestItem.data.description || (requestItem.data.discountPercent ? `Ưu đãi giảm ${requestItem.data.discountPercent}% chi phí dịch vụ` : benefitTypeLabel(requestItem.data.benefitType))}
                  </div>
                </>
              ) : (
                <>
                  <strong style={{ fontSize: "16px", color: "var(--hc-primary-dark)" }}>{requestItem.data.serviceName}</strong>
                  <div className="svc-price" style={{ marginTop: "4px" }}>
                    {formatVND(requestItem.data.unitPrice)} / {requestItem.data.unit || "Lần"}
                  </div>
                </>
              )}
              <div className="guest-cell-sub" style={{ marginTop: "8px", borderTop: "1px dashed var(--hc-border)", paddingTop: "8px" }}>
                Áp dụng cho phòng:{" "}
                <strong className="u-text-primary">
                  {folio?.roomNumber ? `Phòng ${folio.roomNumber}` : bookingCode} ({bookingCode})
                </strong>
              </div>
            </div>

            {!isBenefitRequest && (
              <div className="hc-form-group">
                <label className="hc-label">Số lượng</label>
                <input type="number" className="hc-input" min="1" max="50" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </div>
            )}

            <div className="hc-form-group">
              <label className="hc-label">Ghi chú hoặc yêu cầu đặc biệt</label>
              <input
                type="text"
                className="hc-input"
                placeholder={isBenefitRequest ? "Ví dụ: Phục vụ lúc 16h00 tại ban công phòng..." : "Ví dụ: Giao lên phòng lúc 19h30, không cay..."}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>

      {!portal && <Footer variant="resort" />}
    </>
  );
}
