import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Modal from "../components/Modal";
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
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);

  // Folio state
  const [folio, setFolio] = useState(null);
  const [loadingFolio, setLoadingFolio] = useState(false);

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
        addToast("Vui lòng nhập Mã đơn đặt phòng!", "warning");
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

  useEffect(() => {
    async function loadServices() {
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
    }
    loadServices();

    if (queryCode) {
      loadFolio(queryCode);
    }
  }, [queryCode, loadFolio]);

  const categoryNames = Array.from(new Set(services.map((s) => getCategoryName(s.category)).filter(Boolean)));

  const normalizedSearch = normalizeText(searchTerm);
  const filteredServices = services.filter((s) => {
    if (selectedCategory !== "ALL" && getCategoryName(s.category) !== selectedCategory) return false;
    if (!normalizedSearch) return true;
    return normalizeText(`${s.serviceName || ""} ${getCategoryName(s.category) || ""} ${s.unit || ""}`).includes(normalizedSearch);
  });

  const handleOpenOrder = (s) => {
    if (!bookingCode.trim()) {
      addToast("Vui lòng nhập Mã đặt phòng trước khi gọi dịch vụ!", "warning");
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

  return (
    <>
      {!portal && <Navbar />}

      <PageShell portal={portal}>
        <div className="hc-page-title">
          <div>
            <h2>Dịch Vụ Lưu Trú &amp; Hóa Đơn</h2>
            <p>Gọi món ăn, nước uống, giặt ủi và theo dõi chi tiết hóa đơn phòng theo thời gian thực.</p>
          </div>
          {!portal && (
            <div className="guest-title-actions">
              <Link to="/" className="hc-btn hc-btn-outline">
                <i className="bi bi-house-door"></i> Trở về trang chủ
              </Link>
            </div>
          )}
        </div>

        {/* Booking code bar */}
        <div className="hc-card" style={{ marginBottom: "24px" }}>
          <div className="hc-card-body svc-code-bar">
            <div className="svc-code-field">
              <label className="hc-label" htmlFor="svc-booking-code">
                Mã đơn đặt phòng
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
            <button type="button" className="hc-btn hc-btn-primary" onClick={() => loadFolio()} disabled={loadingFolio} style={{ minHeight: "44px" }}>
              {loadingFolio ? "Đang tải..." : "Xem hóa đơn phòng"}
            </button>
          </div>
        </div>

        <div className="svc-layout">
          {/* Left: service menu */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-search">
                  <i className="bi bi-search"></i>
                  <input type="text" className="hc-input" placeholder="Tìm món, dịch vụ..." aria-label="Tìm trong menu dịch vụ" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="hc-select guest-select" aria-label="Lọc danh mục dịch vụ" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option value="ALL">Tất cả danh mục</option>
                  {categoryNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingServices ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="hc-empty-state">
                <i className="bi bi-cup-hot"></i>
                <p>{searchTerm.trim() ? `Không tìm thấy dịch vụ nào khớp với "${searchTerm.trim()}".` : "Chưa có dịch vụ nào trong danh mục này."}</p>
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
                      const categoryName = getCategoryName(s.category);
                      return (
                        <tr key={s.serviceId}>
                          <td>
                            <strong>{s.serviceName}</strong>
                          </td>
                          <td>{categoryName ? <span className="hc-badge hc-badge-info">{categoryName}</span> : "—"}</td>
                          <td>
                            <span className="svc-price">{formatVND(s.unitPrice)}</span>
                            <div className="guest-cell-sub">/ {s.unit || "Lần"}</div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => handleOpenOrder(s)}>
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

          {/* Right: folio */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="hc-card-title">
                <i className="bi bi-receipt text-primary" style={{ marginRight: "8px" }}></i>
                Bảng kê hóa đơn
              </div>
              {folio && (
                <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => loadFolio()} disabled={loadingFolio} title="Làm mới hóa đơn">
                  <i className="bi bi-arrow-clockwise"></i> Làm mới
                </button>
              )}
            </div>

            {loadingFolio && !folio ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : !folio ? (
              <div className="hc-empty-state">
                <i className="bi bi-receipt-cutoff"></i>
                <p style={{ maxWidth: "320px", margin: "0 auto" }}>Nhập mã đơn đặt phòng ở trên rồi bấm "Xem hóa đơn phòng" để tải bảng kê chi phí.</p>
              </div>
            ) : (
              <div className="hc-card-body">
                <div className="svc-folio-banner">
                  <div className="svc-folio-banner-head">
                    <span className="svc-folio-code">{folio.bookingCode}</span>
                    <span className={`hc-badge hc-badge-booking-${folio.bookingStatus || "CONFIRMED"}`}>{folio.bookingStatus || "LƯU TRÚ"}</span>
                  </div>
                  <div className="svc-folio-meta">
                    Khách hàng: <strong>{folio.customerName || "---"}</strong>
                    <span style={{ margin: "0 8px" }}>|</span>
                    Phòng: <strong>{folio.roomNumber || "---"}</strong>
                  </div>
                </div>

                <div className="svc-folio-section-title">Dịch vụ phát sinh</div>
                {!folio.serviceUsages || folio.serviceUsages.length === 0 ? (
                  <div className="svc-folio-empty">Chưa có dịch vụ phát sinh nào</div>
                ) : (
                  <div style={{ overflowX: "auto", margin: "0 calc(var(--hc-space-6) * -1)" }}>
                    <table className="hc-table">
                      <thead>
                        <tr>
                          <th>Dịch vụ</th>
                          <th style={{ textAlign: "center" }}>SL</th>
                          <th style={{ textAlign: "right" }}>Đơn giá</th>
                          <th style={{ textAlign: "right" }}>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {folio.serviceUsages.map((u, idx) => (
                          <tr key={u.usageId || idx}>
                            <td>
                              <strong>{u.serviceName}</strong>
                              <div className="guest-cell-sub">{formatDateTime(u.orderTime)}</div>
                            </td>
                            <td style={{ textAlign: "center" }}>{u.quantity}</td>
                            <td style={{ textAlign: "right" }}>{formatVND(u.unitPrice)}</td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(u.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="svc-sum">
                  <div className="svc-sum-row">
                    <span>Tiền phòng</span>
                    <strong>{formatVND(folio.roomCharge)}</strong>
                  </div>
                  <div className="svc-sum-row">
                    <span>Tiền dịch vụ</span>
                    <strong>{formatVND(folio.serviceCharge)}</strong>
                  </div>
                  {folio.discountAmount > 0 && (
                    <div className="svc-sum-row is-discount">
                      <span>Giảm giá voucher</span>
                      <strong>- {formatVND(folio.discountAmount)}</strong>
                    </div>
                  )}
                  <div className="svc-sum-row">
                    <span>Thuế GTGT (VAT 10%)</span>
                    <strong>{formatVND(folio.taxAmount)}</strong>
                  </div>
                  <hr className="hc-divider" style={{ margin: "10px 0" }} />
                  <div className="svc-sum-row is-total">
                    <span>Tổng chi phí</span>
                    <span>{formatVND(folio.totalAmount)}</span>
                  </div>
                  <div className="svc-sum-row is-deposit">
                    <span>Tiền cọc đã trả</span>
                    <strong>- {formatVND(folio.depositApplied)}</strong>
                  </div>

                  <div className="svc-balance">
                    <span>Số tiền còn lại</span>
                    <span className="svc-balance-amount">{formatVND(folio.finalBalance ?? folio.balanceDue ?? 0)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageShell>

      {/* Order Service Modal */}
      <Modal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title="Thêm Dịch Vụ Vào Phòng"
        maxWidth="440px"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
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
              <strong style={{ fontSize: "16px" }}>{selectedService.serviceName}</strong>
              <div className="svc-price" style={{ marginTop: "4px" }}>
                {formatVND(selectedService.unitPrice)} / {selectedService.unit || "Lần"}
              </div>
              <div className="guest-cell-sub" style={{ marginTop: "4px" }}>
                Mã đặt phòng: <strong>{bookingCode}</strong>
              </div>
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Số lượng</label>
              <input type="number" className="hc-input" min="1" max="50" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>

            <div className="hc-form-group">
              <label className="hc-label">Ghi chú hoặc yêu cầu đặc biệt</label>
              <input type="text" className="hc-input" placeholder="Ví dụ: Giao lên phòng lúc 19h30..." value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
            </div>
          </form>
        )}
      </Modal>

      {!portal && <Footer variant="resort" />}
    </>
  );
}
