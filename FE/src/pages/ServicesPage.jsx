import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Modal from "../components/Modal";
import VietQrPaymentModal from "../components/VietQrPaymentModal";
import { apiCall, formatVND, formatDateTime, getCategoryName } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import "./GuestPages.css";
import "./ServicesPage.css";

// "Cà phê" -> "ca phe", so searching works with or without Vietnamese accents.
const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

const TONE = {
  primary: { background: "var(--hc-primary-subtle)", color: "var(--hc-primary)" },
  info: { background: "var(--hc-info-bg)", color: "var(--hc-info)" },
  success: { background: "var(--hc-success-bg)", color: "var(--hc-success)" },
  warning: { background: "var(--hc-warning-bg)", color: "var(--hc-warning)" },
};

export const renderServiceStatusBadge = (status) => {
  const norm = (status || "PENDING").toUpperCase();
  if (norm === "DELIVERING" || norm === "IN_PROGRESS" || norm === "DANG_GIAO") {
    return (
      <span className="hc-badge-service-delivering" title="Nhân viên đang giao dịch vụ lên phòng">
        <i className="bi bi-bicycle"></i> DELIVERING
      </span>
    );
  }
  if (norm === "COMPLETED" || norm === "SETTLED" || norm === "HOAN_THANH" || norm === "DONE") {
    return (
      <span className="hc-badge-service-completed" title="Dịch vụ đã hoàn tất phục vụ">
        <i className="bi bi-check-circle-fill"></i> COMPLETED
      </span>
    );
  }
  if (norm === "CANCELED" || norm === "CANCELLED") {
    return (
      <span className="hc-badge-service-canceled" title="Yêu cầu dịch vụ đã bị hủy">
        <i className="bi bi-x-circle"></i> CANCELED
      </span>
    );
  }
  // Mặc định cho đơn mới đặt, chờ phục vụ, hoặc CHARGED_TO_ROOM:
  return (
    <span className="hc-badge-service-pending" title="Đã tiếp nhận yêu cầu, nhân viên đang chuẩn bị">
      <i className="bi bi-clock-history"></i> PENDING
    </span>
  );
};

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

  const queryCode = searchParams.get("bookingCode") || "";
  const [bookingCode, setBookingCode] = useState(queryCode);
  const [myBookings, setMyBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);

  // Folio state
  const [folio, setFolio] = useState(null);
  const [loadingFolio, setLoadingFolio] = useState(false);
  const [qrPaymentOpen, setQrPaymentOpen] = useState(false);

  // Loyalty Benefits state
  const [loyaltyProfile, setLoyaltyProfile] = useState(null);
  const [loyaltyBenefits, setLoyaltyBenefits] = useState([]);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState(null);
  const [redeemNote, setRedeemNote] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  // Order modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [orderNote, setOrderNote] = useState("");
  const [ordering, setOrdering] = useState(false);

  const loadFolio = useCallback(
    async (code = bookingCode) => {
      const trimmed = (code || "").trim().toUpperCase();
      if (!trimmed) {
        addToast("Vui lòng chọn hoặc nhập Mã đơn đặt phòng!", "warning");
        return;
      }

      setLoadingFolio(true);
      try {
        const res = await apiCall(`/api/public/bookings/${trimmed}/folio`);
        if (res && res.success) {
          setFolio(res.data);
        } else {
          setFolio(null);
          addToast(res ? res.message : "Không tìm thấy hóa đơn lưu trú", "error");
        }
      } catch (err) {
        setFolio(null);
        addToast(err.message || "Không tìm thấy hóa đơn", "error");
      } finally {
        setLoadingFolio(false);
      }
    },
    [bookingCode, addToast],
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
    async function loadInitial() {
      // 1. Load services menu
      try {
        const res = await apiCall("/api/public/services", { silentError: true });
        if (res && res.success) {
          setServices(res.data || []);
        }
      } catch {
        // silent
      } finally {
        setLoadingServices(false);
      }

      // 2. If in portal, load user's booking history and loyalty perks
      if (portal) {
        apiCall("/api/customer/loyalty/profile", { silentError: true }).then((res) => {
          if (res?.success && res.data) setLoyaltyProfile(res.data);
        });
        reloadBenefits();

        try {
          const bRes = await apiCall("/api/customer/bookings/history", { silentError: true });
          if (bRes && bRes.success && bRes.data?.length > 0) {
            setMyBookings(bRes.data);
            if (!queryCode) {
              const active = bRes.data.find((b) => ["CHECKED_IN", "CONFIRMED"].includes(b.status || b.bookingStatus)) || bRes.data[0];
              if (active) {
                const code = active.bookingCode;
                setBookingCode(code);
                loadFolio(code);
                return;
              }
            }
          }
        } catch {
          // silent
        }
      }

      // 3. If query param provided, load folio
      if (queryCode) {
        loadFolio(queryCode);
      }
    }

    loadInitial();
  }, [portal, queryCode, loadFolio, reloadBenefits]);

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

  const handleOpenOrder = (s) => {
    if (!bookingCode.trim()) {
      addToast("Vui lòng chọn hoặc nhập Mã đặt phòng trước khi gọi dịch vụ!", "warning");
      return;
    }
    setSelectedService(s);
    setQuantity(1);
    setOrderNote("");
    setOrderModalOpen(true);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!selectedService || !bookingCode.trim()) return;

    setOrdering(true);
    try {
      const res = await apiCall("/api/public/services/order", {
        method: "POST",
        body: {
          bookingCode: bookingCode.trim().toUpperCase(),
          serviceId: selectedService.serviceId,
          quantity: parseInt(quantity) || 1,
          note: orderNote.trim() || null,
        },
      });

      if (res && res.success) {
        addToast(`Đã thêm dịch vụ "${selectedService.serviceName}" vào phòng thành công!`, "success");
        setOrderModalOpen(false);
        loadFolio(bookingCode);
      }
    } catch (err) {
      addToast(err.message || "Lỗi đặt dịch vụ", "error");
    } finally {
      setOrdering(false);
    }
  };

  const handleOpenRedeem = (b) => {
    if (b.remainingQuota === 0) {
      addToast("Ưu đãi này đã hết lượt sử dụng trong kỳ", "warning");
      return;
    }
    setSelectedBenefit(b);
    setRedeemNote("");
    setRedeemModalOpen(true);
  };

  const handleSubmitRedeem = async (e) => {
    e.preventDefault();
    if (!selectedBenefit) return;

    setRedeeming(true);
    try {
      const payload = {
        tierBenefitId: selectedBenefit.tierBenefitId,
        bookingCode: bookingCode.trim() || null,
        note: redeemNote.trim() || null,
      };

      const res = await apiCall("/api/customer/loyalty/redeem", {
        method: "POST",
        body: payload,
      });

      if (res && res.success) {
        addToast(`Áp dụng thành công ưu đãi "${selectedBenefit.benefitName}"!`, "success");
        setRedeemModalOpen(false);
        reloadBenefits();
        if (bookingCode) {
          loadFolio(bookingCode);
        }
      } else {
        addToast(res?.message || "Không thể áp dụng ưu đãi này", "error");
      }
    } catch (err) {
      addToast(err.message || "Lỗi khi áp dụng ưu đãi", "error");
    } finally {
      setRedeeming(false);
    }
  };

  const handleSelectBooking = (code) => {
    setBookingCode(code);
    if (code) {
      loadFolio(code);
    } else {
      setFolio(null);
    }
  };

  const remainingBalance = folio ? (folio.finalBalance ?? folio.balanceDue ?? folio.remainingBalance ?? 0) : 0;

  return (
    <>
      {!portal && <Navbar />}

      <PageShell portal={portal}>
        {/* Page Title */}
        <div className="hc-page-title">
          <div>
            <h2>Dịch Vụ Khách Sạn &amp; Hóa Đơn</h2>
            <p>Khám phá thực đơn ẩm thực, các đặc quyền hội viên và theo dõi bảng kê chi phí phòng theo thời gian thực.</p>
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

        {/* Stats Strip */}
        <div className="guest-stats-grid">
          <div className="guest-stat-card">
            <div className="guest-stat-icon" style={TONE.primary}>
              <i className="bi bi-cup-hot"></i>
            </div>
            <div className="guest-stat-content">
              <div className="guest-stat-val">{services.length}</div>
              <div className="guest-stat-lbl">Món &amp; Dịch vụ</div>
            </div>
          </div>

          {portal && (
            <div
              className="guest-stat-card"
              onClick={() => setSelectedCategory("LOYALTY")}
              style={{ cursor: "pointer" }}
              title="Nhấn để xem các đặc quyền hội viên"
            >
              <div className="guest-stat-icon" style={TONE.warning}>
                <i className="bi bi-gem"></i>
              </div>
              <div className="guest-stat-content">
                <div className="guest-stat-val">{loyaltyBenefits.length}</div>
                <div className="guest-stat-lbl">Đặc quyền hội viên</div>
              </div>
            </div>
          )}

          <div className="guest-stat-card">
            <div className="guest-stat-icon" style={TONE.info}>
              <i className="bi bi-door-closed"></i>
            </div>
            <div className="guest-stat-content">
              <div className="guest-stat-val">
                {folio ? (folio.roomNumber ? `Phòng ${folio.roomNumber}` : folio.bookingCode) : "Chưa chọn"}
              </div>
              <div className="guest-stat-lbl">Phòng áp dụng</div>
            </div>
          </div>

          <div className="guest-stat-card">
            <div className="guest-stat-icon" style={TONE.success}>
              <i className="bi bi-wallet2"></i>
            </div>
            <div className="guest-stat-content">
              <div className="guest-stat-val">
                {formatVND(remainingBalance)}
              </div>
              <div className="guest-stat-lbl">Số dư còn lại</div>
            </div>
          </div>
        </div>

        {/* Booking selector bar */}
        <div className="hc-card" style={{ marginBottom: "24px" }}>
          <div className="hc-card-body svc-code-bar">
            {myBookings.length > 0 ? (
              <div className="svc-code-field">
                <label className="hc-label" htmlFor="svc-select-booking">
                  Chọn phòng nghỉ của bạn
                </label>
                <select
                  id="svc-select-booking"
                  className="hc-select"
                  value={bookingCode}
                  onChange={(e) => handleSelectBooking(e.target.value)}
                  style={{ width: "100%", height: "42px" }}
                >
                  <option value="">-- Chọn phòng lưu trú --</option>
                  {myBookings.map((b) => (
                    <option key={b.bookingCode} value={b.bookingCode}>
                      {b.bookingCode} — {b.roomNumber ? `Phòng ${b.roomNumber}` : b.roomTypeName || "Đơn đặt phòng"} ({b.status || b.bookingStatus})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="svc-code-field">
              <label className="hc-label" htmlFor="svc-booking-code">
                {myBookings.length > 0 ? "Hoặc nhập mã đơn khác" : "Mã đơn đặt phòng"}
              </label>
              <div className="svc-input-icon">
                <i className="bi bi-search"></i>
                <input
                  id="svc-booking-code"
                  type="text"
                  className="hc-input svc-code-input"
                  placeholder="Ví dụ: BK-20261012-ABCD"
                  value={bookingCode}
                  onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadFolio();
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              className="hc-btn hc-btn-primary"
              onClick={() => loadFolio()}
              disabled={loadingFolio || !bookingCode.trim()}
              style={{ minHeight: "42px" }}
            >
              <i className="bi bi-receipt"></i> {loadingFolio ? "Đang tải..." : "Xem hóa đơn"}
            </button>
          </div>
        </div>

        {/* Main 2-column layout */}
        <div className="svc-layout">
          {/* Left: Service Menu & Loyalty Perks */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-menu-button-wide text-primary"></i> Danh mục menu &amp; Đặc quyền
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
                  <select
                    className="hc-select guest-select"
                    aria-label="Lọc danh mục dịch vụ"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="ALL">Tất cả món ({services.length})</option>
                    {portal && (
                      <option value="LOYALTY">
                        ⭐ Đặc quyền hội viên {loyaltyBenefits.length > 0 ? `(${loyaltyBenefits.length})` : "(0)"}
                      </option>
                    )}
                    {categoryNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Category Navigation Tabs */}
            {portal && (
              <div className="svc-cat-tabs">
                <button
                  type="button"
                  className={`svc-cat-tab ${selectedCategory === "ALL" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("ALL")}
                >
                  <i className="bi bi-grid"></i> Tất cả dịch vụ ({services.length})
                </button>
                <button
                  type="button"
                  className={`svc-cat-tab is-loyalty ${selectedCategory === "LOYALTY" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("LOYALTY")}
                >
                  <i className="bi bi-gem"></i> ⭐ Đặc quyền hội viên {loyaltyBenefits.length > 0 ? `(${loyaltyBenefits.length})` : "(0)"}
                </button>
                {categoryNames.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`svc-cat-tab ${selectedCategory === c ? "active" : ""}`}
                    onClick={() => setSelectedCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* VIEW 1: LOYALTY PRIVILEGES CATEGORY */}
            {selectedCategory === "LOYALTY" ? (
              <div>
                <div className="svc-loyalty-banner">
                  <div className="svc-loyalty-banner-info">
                    <div className="svc-loyalty-icon">
                      <i className="bi bi-gem"></i>
                    </div>
                    <div>
                      <h4 className="svc-loyalty-title">
                        Đặc Quyền Hội Viên — Hạng {loyaltyProfile?.tierName || "Thành viên"}
                      </h4>
                      <div className="svc-loyalty-sub">
                        Điểm thưởng: <strong>{(loyaltyProfile?.currentScore || 0).toLocaleString("vi-VN")} điểm</strong> · Chọn ưu đãi bên dưới để áp dụng trực tiếp cho phòng lưu trú của bạn
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/guest/loyalty"
                    className="svc-loyalty-btn"
                  >
                    <i className="bi bi-award-fill"></i> Quản lý thẻ hội viên
                  </Link>
                </div>

                {filteredBenefits.length === 0 ? (
                  <div className="svc-empty-loyalty-box">
                    <div className="svc-empty-loyalty-icon">
                      <i className="bi bi-shield-lock"></i>
                    </div>
                    <h5>
                      {searchTerm.trim()
                        ? `Không tìm thấy đặc quyền nào khớp với "${searchTerm.trim()}"`
                        : `Bạn đang ở Hạng ${loyaltyProfile?.tierName || "Sò Biển (Seashell)"}`}
                    </h5>
                    <p>
                      {searchTerm.trim()
                        ? "Vui lòng thử tìm kiếm bằng từ khóa khác."
                        : `Hạng thẻ hiện tại chưa có đặc quyền sử dụng trực tiếp. Bạn đang tích lũy ${(loyaltyProfile?.currentScore || 0).toLocaleString("vi-VN")} điểm. Hãy tích lũy thêm điểm lưu trú để nâng hạng và mở khóa các ưu đãi hấp dẫn.`}
                    </p>
                    {!searchTerm.trim() && (
                      <div className="svc-tier-unlock-preview">
                        <div className="svc-tier-unlock-item">
                          <span className="hc-badge hc-badge-info">Hạng Sao Biển (10đ)</span>
                          <span>Giảm 5% giá phòng đặt trực tiếp</span>
                        </div>
                        <div className="svc-tier-unlock-item">
                          <span className="hc-badge hc-badge-warning">Hạng San Hô (30đ)</span>
                          <span>Giảm 10% phòng &amp; Miễn phí giặt ủi 2 lần/năm</span>
                        </div>
                        <div className="svc-tier-unlock-item">
                          <span className="hc-badge hc-badge-primary">Hạng Ngọc Trai (80đ)</span>
                          <span>Giảm 15% phòng VIP &amp; Tặng 1 đêm nghỉ miễn phí</span>
                        </div>
                      </div>
                    )}
                    <Link to="/guest/loyalty" className="svc-loyalty-btn" style={{ marginTop: "14px", display: "inline-flex" }}>
                      <i className="bi bi-award-fill"></i> Xem chi tiết cấp bậc &amp; chính sách hội viên
                    </Link>
                  </div>
                ) : (
                  <div className="svc-benefits-grid">
                    {filteredBenefits.map((b) => (
                      <div className="svc-benefit-card" key={b.tierBenefitId}>
                        <div>
                          <div className="svc-benefit-head">
                            <span className="hc-badge hc-badge-primary">
                              <i className="bi bi-shield-check"></i> {b.tierName}
                            </span>
                            {b.discountPercent ? (
                              <span className="hc-badge hc-badge-success">Giảm {b.discountPercent}%</span>
                            ) : null}
                          </div>
                          <div className="svc-benefit-name" style={{ marginTop: "10px" }}>
                            {b.benefitName}
                          </div>
                          <div className="svc-benefit-desc">
                            {b.description ||
                              (b.discountPercent
                                ? `Ưu đãi giảm giá ${b.discountPercent}% chi phí dịch vụ tại resort.`
                                : b.benefitType)}
                          </div>
                        </div>

                        <div className="svc-benefit-foot">
                          <span className="svc-benefit-quota">
                            <i className="bi bi-clock-history"></i>{" "}
                            {b.remainingQuota != null ? `Còn ${b.remainingQuota} lượt` : "Không giới hạn"}
                          </span>
                          <button
                            type="button"
                            className="hc-btn hc-btn-primary hc-btn-sm"
                            disabled={b.remainingQuota === 0}
                            onClick={() => handleOpenRedeem(b)}
                          >
                            <i className="bi bi-stars"></i> {b.remainingQuota === 0 ? "Hết lượt" : "Dùng ưu đãi"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* VIEW 2: STANDARD SERVICES MENU */
              <div>
                {/* Optional VIP Banner when viewing All Services */}
                {portal && loyaltyBenefits.length > 0 && selectedCategory === "ALL" && (
                  <div className="svc-loyalty-banner" style={{ margin: "16px 22px 0" }}>
                    <div className="svc-loyalty-banner-info">
                      <div className="svc-loyalty-icon">
                        <i className="bi bi-stars"></i>
                      </div>
                      <div>
                        <h4 className="svc-loyalty-title">
                          Bạn có {loyaltyBenefits.length} đặc quyền hội viên khả dụng
                        </h4>
                        <div className="svc-loyalty-sub">
                          Nâng tầm kỳ nghỉ với các ưu đãi ẩm thực, spa và tiện ích theo hạng thẻ
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="svc-loyalty-btn"
                      onClick={() => setSelectedCategory("LOYALTY")}
                    >
                      <i className="bi bi-stars"></i> Xem ưu đãi &amp; dùng ngay →
                    </button>
                  </div>
                )}

                {loadingServices ? (
                  <div className="hc-loading-spinner">
                    <div className="hc-spinner"></div>
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className="hc-empty-state">
                    <i className="bi bi-cup-hot"></i>
                    <p>
                      {searchTerm.trim()
                        ? `Không tìm thấy dịch vụ nào khớp với "${searchTerm.trim()}".`
                        : "Chưa có dịch vụ nào trong danh mục này."}
                    </p>
                  </div>
                ) : (
                  <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
                    <table className="hc-table">
                      <thead>
                        <tr>
                          <th>Dịch vụ</th>
                          <th>Danh mục</th>
                          <th>Đơn giá</th>
                          <th style={{ textAlign: "right" }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredServices.map((s) => {
                          const categoryName = getCategoryName(s.categoryName || s.category || s);
                          return (
                            <tr key={s.serviceId}>
                              <td>
                                <strong>{s.serviceName}</strong>
                                {s.description && <div className="guest-cell-sub">{s.description}</div>}
                              </td>
                              <td>{categoryName ? <span className="hc-badge hc-badge-info">{categoryName}</span> : "—"}</td>
                              <td>
                                <span className="svc-price">{formatVND(s.unitPrice)}</span>
                                <div className="guest-cell-sub">/ {s.unit || "Lần"}</div>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  className="hc-btn hc-btn-outline hc-btn-sm"
                                  onClick={() => handleOpenOrder(s)}
                                  title="Thêm dịch vụ vào hóa đơn phòng"
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
                )}
              </div>
            )}
          </div>

          {/* Right: Folio Bill Summary */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-receipt text-primary"></i> Hóa đơn lưu trú
                </div>
                {folio && (
                  <button
                    type="button"
                    className="hc-btn hc-btn-outline hc-btn-sm"
                    onClick={() => loadFolio()}
                    disabled={loadingFolio}
                    title="Làm mới hóa đơn"
                  >
                    <i className="bi bi-arrow-clockwise"></i> Làm mới
                  </button>
                )}
              </div>
            </div>

            {loadingFolio && !folio ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : !folio ? (
              <div className="hc-empty-state">
                <i className="bi bi-receipt-cutoff"></i>
                <p style={{ maxWidth: "320px", margin: "0 auto" }}>
                  Chọn phòng nghỉ ở trên hoặc nhập mã đặt phòng rồi bấm "Xem hóa đơn" để kiểm tra các khoản phí.
                </p>
              </div>
            ) : (
              <div className="hc-card-body">
                <div className="svc-folio-banner">
                  <div className="svc-folio-banner-head">
                    <span className="svc-folio-code">{folio.bookingCode}</span>
                    <span className={`hc-badge hc-badge-booking-${folio.bookingStatus || "CONFIRMED"}`}>{folio.bookingStatus || "LƯU TRÚ"}</span>
                  </div>
                  <div className="svc-folio-meta">
                    Khách hàng: <strong>{folio.customerName || "—"}</strong>
                    <span style={{ margin: "0 8px" }}>|</span>
                    Phòng: <strong>{folio.roomNumber ? `Phòng ${folio.roomNumber}` : "—"}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div className="svc-folio-section-title" style={{ margin: 0 }}>Dịch vụ đã phát sinh</div>
                  <div className="svc-lifecycle-stepper" style={{ margin: 0, padding: "3px 8px" }}>
                    <span className="svc-step-node is-pending" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      <i className="bi bi-clock-history"></i> PENDING
                    </span>
                    <i className="bi bi-arrow-right svc-step-arrow"></i>
                    <span className="svc-step-node is-delivering" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      <i className="bi bi-bicycle"></i> DELIVERING
                    </span>
                    <i className="bi bi-arrow-right svc-step-arrow"></i>
                    <span className="svc-step-node is-completed" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      <i className="bi bi-check2-circle"></i> COMPLETED
                    </span>
                  </div>
                </div>

                {!folio.services?.length && !folio.serviceUsages?.length ? (
                  <div className="svc-folio-empty">Chưa có dịch vụ nào được gọi thêm</div>
                ) : (
                  <div style={{ overflowX: "auto", margin: "0 -22px" }}>
                    <table className="hc-table">
                      <thead>
                        <tr>
                          <th>Dịch vụ</th>
                          <th style={{ textAlign: "center" }}>Trạng thái</th>
                          <th style={{ textAlign: "center" }}>SL</th>
                          <th style={{ textAlign: "right" }}>Đơn giá</th>
                          <th style={{ textAlign: "right" }}>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(folio.services || folio.serviceUsages || []).map((u, idx) => (
                          <tr key={u.usageId || idx}>
                            <td>
                              <strong>{u.serviceName}</strong>
                              <div className="guest-cell-sub">{formatDateTime(u.orderTime || u.usedAt)}</div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {renderServiceStatusBadge(u.status)}
                            </td>
                            <td style={{ textAlign: "center" }}>{u.quantity}</td>
                            <td style={{ textAlign: "right" }}>{formatVND(u.unitPrice || u.unitPriceApplied)}</td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                              {u.status === "CANCELED" || u.status === "CANCELLED" ? (
                                <span style={{ textDecoration: "line-through", color: "var(--hc-text-muted)" }} title="Dịch vụ đã hủy, không tính tiền">
                                  {formatVND(u.totalAmount || u.totalPrice)}
                                </span>
                              ) : (
                                formatVND(u.totalAmount || u.totalPrice)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="svc-sum">
                  <div className="svc-sum-row">
                    <span>Tiền phòng lưu trú</span>
                    <strong>{formatVND(folio.roomCharge)}</strong>
                  </div>
                  <div className="svc-sum-row">
                    <span>Tiền dịch vụ phát sinh</span>
                    <strong>{formatVND(folio.serviceCharge)}</strong>
                  </div>
                  {folio.discountAmount > 0 && (
                    <div className="svc-sum-row is-discount" style={{ color: "var(--hc-success)" }}>
                      <span>Ưu đãi voucher</span>
                      <strong>- {formatVND(folio.discountAmount)}</strong>
                    </div>
                  )}
                  <div className="svc-sum-row">
                    <span>Thuế GTGT (VAT 10%)</span>
                    <strong>{formatVND(folio.taxAmount)}</strong>
                  </div>
                  <hr className="hc-divider" style={{ margin: "10px 0" }} />
                  <div className="svc-sum-row is-total" style={{ fontWeight: 700, fontSize: "15px" }}>
                    <span>Tổng chi phí</span>
                    <span>{formatVND(folio.totalAmount)}</span>
                  </div>
                  <div className="svc-sum-row is-deposit" style={{ color: "var(--hc-success)" }}>
                    <span>Tiền cọc / Đã trả</span>
                    <strong>- {formatVND(folio.depositPaid ?? folio.depositApplied ?? folio.depositAmount ?? 0)}</strong>
                  </div>

                  <div className="svc-balance" style={{ marginTop: "12px" }}>
                    <span>Số tiền còn lại</span>
                    <span className="svc-balance-amount">{formatVND(remainingBalance)}</span>
                  </div>

                  {remainingBalance > 0 && !folio.isFullySettled && folio.bookingStatus !== "CANCELED" && (
                    <div style={{ marginTop: "16px" }}>
                      <button
                        type="button"
                        className="hc-btn hc-btn-primary"
                        onClick={() => setQrPaymentOpen(true)}
                        style={{ width: "100%", justifyContent: "center" }}
                      >
                        <i className="bi bi-qr-code-scan"></i> Thanh toán VietQR ({formatVND(remainingBalance)})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
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

      {/* Order Service Modal */}
      <Modal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title="Thêm Dịch Vụ Vào Phòng"
        maxWidth="440px"
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setOrderModalOpen(false)}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={handleSubmitOrder} disabled={ordering}>
              {ordering ? "Đang gửi..." : "Xác nhận đặt"}
            </button>
          </div>
        }
      >
        {selectedService && (
          <form onSubmit={handleSubmitOrder}>
            <div className="svc-order-summary">
              <strong style={{ fontSize: "16px", color: "var(--hc-primary-dark)" }}>{selectedService.serviceName}</strong>
              <div className="svc-price" style={{ marginTop: "4px" }}>
                {formatVND(selectedService.unitPrice)} / {selectedService.unit || "Lần"}
              </div>
              <div className="guest-cell-sub" style={{ marginTop: "6px" }}>
                Áp dụng cho phòng: <strong style={{ color: "var(--hc-primary)" }}>{bookingCode}</strong>
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
                placeholder="Ví dụ: Giao lên phòng lúc 19h30, không cay..."
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Redeem Loyalty Benefit Modal */}
      <Modal
        isOpen={redeemModalOpen}
        onClose={() => setRedeemModalOpen(false)}
        title="Sử Dụng Đặc Quyền Hội Viên"
        maxWidth="460px"
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setRedeemModalOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={handleSubmitRedeem}
              disabled={redeeming}
            >
              <i className="bi bi-stars"></i> {redeeming ? "Đang áp dụng..." : "Xác nhận dùng"}
            </button>
          </div>
        }
      >
        {selectedBenefit && (
          <form onSubmit={handleSubmitRedeem}>
            <div className="svc-order-summary" style={{ background: "linear-gradient(135deg, var(--hc-primary-subtle) 0%, #ffffff 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span className="hc-badge hc-badge-primary">
                  <i className="bi bi-gem"></i> {selectedBenefit.tierName}
                </span>
                <span className="guest-cell-sub">
                  {selectedBenefit.remainingQuota != null ? `Còn ${selectedBenefit.remainingQuota} lượt` : "Không giới hạn"}
                </span>
              </div>
              <strong style={{ fontSize: "16px", color: "var(--hc-primary-dark)" }}>{selectedBenefit.benefitName}</strong>
              <div style={{ fontSize: "13px", color: "var(--hc-text-secondary)", marginTop: "4px" }}>
                {selectedBenefit.description ||
                  (selectedBenefit.discountPercent
                    ? `Ưu đãi giảm ${selectedBenefit.discountPercent}% chi phí dịch vụ`
                    : selectedBenefit.benefitType)}
              </div>
              <div className="guest-cell-sub" style={{ marginTop: "8px", borderTop: "1px dashed var(--hc-border)", paddingTop: "8px" }}>
                Áp dụng cho phòng: <strong style={{ color: "var(--hc-primary)" }}>{bookingCode || "Chưa chọn phòng"}</strong>
              </div>
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Ghi chú hoặc thời gian phục vụ (nếu có)</label>
              <textarea
                className="hc-input"
                rows="3"
                placeholder="Ví dụ: Phục vụ vào lúc 16h00 chiều nay tại ban công phòng..."
                value={redeemNote}
                onChange={(e) => setRedeemNote(e.target.value)}
                style={{ resize: "vertical", height: "auto" }}
              />
            </div>
          </form>
        )}
      </Modal>

      {!portal && <Footer variant="resort" />}
    </>
  );
}
