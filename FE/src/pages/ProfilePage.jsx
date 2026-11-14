import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiCall, getPrimaryRole } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "./GuestPages.css";

const ROLE_LABEL = {
  ROLE_ADMIN: "Quản trị viên",
  ROLE_MANAGER: "Quản lý khách sạn",
  ROLE_RECEPTIONIST: "Nhân viên Lễ tân",
  ROLE_HOUSEKEEPING: "Nhân viên Buồng phòng",
  ROLE_MAINTENANCE: "Kỹ thuật & Bảo trì",
  ROLE_SERVICE_STAFF: "Nhân viên Phục vụ",
  ROLE_CUSTOMER: "Khách hàng thành viên",
};

const roleLabel = (value) =>
  ROLE_LABEL[value] ||
  String(value || "")
    .replace(/^ROLE_/, "")
    .replaceAll("_", " ");

const TONE = {
  primary: { background: "var(--hc-primary-subtle)", color: "var(--hc-primary)" },
  info: { background: "var(--hc-info-bg)", color: "var(--hc-info)" },
  success: { background: "var(--hc-success-bg)", color: "var(--hc-success)" },
  warning: { background: "var(--hc-warning-bg)", color: "var(--hc-warning)" },
};

export default function ProfilePage() {
  const { user: cachedUser } = useAuth();
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiCall("/api/auth/me", { silentError: true })
      .then((result) => {
        if (!active) return;
        if (result?.success && result.data) setUser(result.data);
        else setError("Không thể làm mới thông tin tài khoản.");
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Không thể tải thông tin tài khoản.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const role = getPrimaryRole(user);
  const isCustomer = role === "ROLE_CUSTOMER";
  const portalHref = isCustomer ? "/guest" : ["ROLE_ADMIN", "ROLE_MANAGER"].includes(role) ? "/admin/overview" : "/staff";
  
  const initials = (user?.fullName || user?.username || "U")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = String(user?.status || "ACTIVE").toUpperCase() === "ACTIVE";

  const fields = [
    ["Họ và tên", user?.fullName || "Chưa cập nhật"],
    ["Tên đăng nhập", user?.username],
    ["Địa chỉ Email", user?.email || "Chưa thiết lập"],
    ["Số điện thoại", user?.phone || "Chưa thiết lập"],
    ["Vai trò hệ thống", roleLabel(role)],
    ["Trạng thái tài khoản", isActive ? "Đang hoạt động" : (user?.status || "Đã khóa")],
  ];

  return (
    <main className="ops-page guest-page">
      {/* Page Title */}
      <div className="hc-page-title">
        <div>
          <h2>Hồ Sơ Của Tôi</h2>
          <p>Quản lý thông tin cá nhân, chi tiết liên hệ và trạng thái bảo mật tài khoản tại Azure Bay.</p>
        </div>

        <div className="guest-title-actions">
          <Link className="hc-btn hc-btn-outline" to={portalHref}>
            <i className="bi bi-arrow-left"></i> Quay lại Tổng quan
          </Link>
        </div>
      </div>

      {error && (
        <div className="hc-alert hc-alert-error" role="alert" style={{ marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {/* Stats Summary Strip */}
      <div className="guest-stats-grid">
        <div className="guest-stat-card">
          <div className="guest-stat-icon" style={TONE.primary}>
            <i className="bi bi-person-badge"></i>
          </div>
          <div className="guest-stat-content">
            <div className="guest-stat-val" style={{ fontSize: "1.2rem" }}>{roleLabel(role)}</div>
            <div className="guest-stat-lbl">Loại tài khoản</div>
          </div>
        </div>

        <div className="guest-stat-card">
          <div className="guest-stat-icon" style={TONE.success}>
            <i className="bi bi-shield-check"></i>
          </div>
          <div className="guest-stat-content">
            <div className="guest-stat-val" style={{ fontSize: "1.2rem" }}>
              {isActive ? "Hoạt động" : "Tạm khóa"}
            </div>
            <div className="guest-stat-lbl">Trạng thái xác thực</div>
          </div>
        </div>

        <div className="guest-stat-card">
          <div className="guest-stat-icon" style={TONE.info}>
            <i className="bi bi-envelope"></i>
          </div>
          <div className="guest-stat-content">
            <div className="guest-stat-val" style={{ fontSize: "1.1rem" }}>{user?.email || "Chưa có email"}</div>
            <div className="guest-stat-lbl">Email xác nhận</div>
          </div>
        </div>

        <div className="guest-stat-card">
          <div className="guest-stat-icon" style={TONE.warning}>
            <i className="bi bi-telephone"></i>
          </div>
          <div className="guest-stat-content">
            <div className="guest-stat-val" style={{ fontSize: "1.2rem" }}>{user?.phone || "Chưa có SĐT"}</div>
            <div className="guest-stat-lbl">Số điện thoại</div>
          </div>
        </div>
      </div>

      {loading && !user ? (
        <div className="hc-card">
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        </div>
      ) : (
        <div className="guest-stack">
          {/* Main Profile Info Card */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-person-circle text-primary"></i> Thông tin cá nhân
                </div>
                <span className={`hc-badge ${isActive ? "hc-badge-success" : "hc-badge-muted"}`}>
                  {isActive ? (
                    <>
                      <i className="bi bi-check-circle-fill"></i> Đang hoạt động
                    </>
                  ) : (
                    user?.status
                  )}
                </span>
              </div>
            </div>

            <div className="hc-card-body">
              <div className="guest-profile-hero">
                <div className="guest-avatar">{initials}</div>
                <div>
                  <h3>{user?.fullName || user?.username}</h3>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "4px" }}>
                    <span className="hc-badge hc-badge-primary">{roleLabel(role)}</span>
                    <span className="guest-cell-sub">ID: #{user?.userId || user?.id || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="guest-fields">
                {fields.map(([label, value]) => (
                  <div className="guest-field" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="hc-card-body" style={{ borderTop: "1px solid var(--hc-border-light)", fontSize: "13px", color: "var(--hc-text-muted)" }}>
              <i className="bi bi-info-circle text-primary u-mr-6"></i>
              Để bảo mật tài khoản, việc thay đổi số điện thoại hoặc email liên kết cần được đối soát bởi Quầy lễ tân hoặc Quản trị viên hệ thống.
            </div>
          </div>

          {/* Quick Portal Navigation for Customers */}
          {isCustomer && (
            <div className="hc-card">
              <div className="hc-card-header">
                <div className="guest-toolbar">
                  <div className="guest-toolbar-title">
                    <i className="bi bi-grid text-primary"></i> Dịch vụ &amp; Tiện ích liên kết
                  </div>
                </div>
              </div>
              <div className="hc-card-body flush">
                <Link className="guest-link-row" to="/guest/loyalty">
                  <div className="guest-stat-icon" style={TONE.warning}>
                    <i className="bi bi-gem"></i>
                  </div>
                  <div>
                    <b>Đặc quyền hội viên</b>
                    <small>Xem hạng thẻ, quyền lợi độc quyền và điểm tích lũy</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>

                <Link className="guest-link-row" to="/guest/bookings">
                  <div className="guest-stat-icon" style={TONE.info}>
                    <i className="bi bi-calendar2-check"></i>
                  </div>
                  <div>
                    <b>Lịch sử đặt phòng</b>
                    <small>Tra cứu các kỳ nghỉ đã và đang diễn ra tại Azure Bay</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>

                <Link className="guest-link-row" to="/guest/services">
                  <div className="guest-stat-icon" style={TONE.primary}>
                    <i className="bi bi-stars"></i>
                  </div>
                  <div>
                    <b>Dịch vụ khách sạn &amp; Hóa đơn</b>
                    <small>Gọi món ăn tại phòng, dịch vụ giặt ủi và theo dõi chi phí</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </Link>
              </div>
            </div>
          )}

          {/* Security & Support Note */}
          <div className="hc-card">
            <div className="hc-card-body guest-note">
              <div className="guest-stat-icon" style={TONE.info}>
                <i className="bi bi-shield-lock"></i>
              </div>
              <div>
                <b>Bảo mật tài khoản</b>
                <p>
                  Tài khoản của bạn được mã hóa và bảo vệ theo tiêu chuẩn bảo mật của Azure Bay. Hãy đăng xuất sau khi sử dụng trên các thiết bị công cộng.
                </p>
              </div>
              <div>
                <a href="tel:19006868" className="hc-btn hc-btn-outline hc-btn-sm">
                  <i className="bi bi-telephone"></i> Hotline CSKH: 1900 6868
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
