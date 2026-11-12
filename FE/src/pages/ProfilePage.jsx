import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiCall, getPrimaryRole } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "./GuestPages.css";

const ROLE_LABEL = {
  ROLE_ADMIN: "Quản trị viên",
  ROLE_MANAGER: "Quản lý",
  ROLE_RECEPTIONIST: "Lễ tân",
  ROLE_HOUSEKEEPING: "Buồng phòng",
  ROLE_MAINTENANCE: "Kỹ thuật",
  ROLE_SERVICE_STAFF: "Nhân viên dịch vụ",
  ROLE_CUSTOMER: "Khách hàng",
};

const roleLabel = (value) =>
  ROLE_LABEL[value] ||
  String(value || "")
    .replace(/^ROLE_/, "")
    .replaceAll("_", " ");

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
  const portalHref = role === "ROLE_CUSTOMER" ? "/guest" : ["ROLE_ADMIN", "ROLE_MANAGER"].includes(role) ? "/admin/overview" : "/staff";
  const initials = (user?.fullName || user?.username || "U")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = String(user?.status || "ACTIVE").toUpperCase() === "ACTIVE";
  const fields = [
    ["Tên đăng nhập", user?.username],
    ["Email", user?.email],
    ["Số điện thoại", user?.phone],
    ["Vai trò", roleLabel(role)],
  ];

  return (
    <main className="ops-page guest-page">
      <div className="hc-page-title">
        <div>
          <h2>Hồ Sơ Của Tôi</h2>
          <p>Thông tin tài khoản và quyền truy cập hiện tại.</p>
        </div>

        <div className="guest-title-actions">
          <Link className="hc-btn hc-btn-outline" to={portalHref}>
            <i className="bi bi-arrow-left"></i> Quay lại
          </Link>
        </div>
      </div>

      {error && (
        <div className="hc-alert hc-alert-error" role="alert" style={{ marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {loading && !user ? (
        <div className="hc-card">
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        </div>
      ) : (
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="guest-toolbar">
              <div className="guest-toolbar-title">
                <i className="bi bi-person-circle text-primary"></i> Thông tin tài khoản
              </div>
              <span className={`hc-badge ${isActive ? "hc-badge-success" : "hc-badge-muted"}`}>
                {isActive ? (
                  <>
                    <i className="bi bi-check-circle-fill"></i> Hoạt động
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
                <span className="hc-badge hc-badge-primary">{roleLabel(role)}</span>
              </div>
            </div>

            <div className="guest-fields">
              {fields.map(([label, value]) => (
                <div className="guest-field" key={label}>
                  <span>{label}</span>
                  <strong>{value || "—"}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="hc-card-body" style={{ borderTop: "1px solid var(--hc-border-light)", fontSize: "13px", color: "var(--hc-text-muted)" }}>
            <i className="bi bi-info-circle"></i> Để thay đổi thông tin tài khoản, vui lòng liên hệ quản trị viên hệ thống.
          </div>
        </div>
      )}
    </main>
  );
}
