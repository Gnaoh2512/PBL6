import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiCall, formatVND, formatDateTime } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import "../../styles/GuestPages.css";
import SelectMenu from "../../components/common/SelectMenu";
import Paginated from "../../components/common/TablePagination";
import { loyaltyTxnLabel, benefitTypeLabel } from "../../utils/labels";

const fmtNumber = (value) => Number(value || 0).toLocaleString("vi-VN");

export default function GuestLoyaltyPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [benefits, setBenefits] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for the points history
  const [txnSearch, setTxnSearch] = useState("");
  const [txnType, setTxnType] = useState("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      apiCall("/api/customer/loyalty/profile", { silentError: true }),
      apiCall("/api/customer/loyalty/benefits", { silentError: true }),
      apiCall("/api/customer/loyalty/transactions", { silentError: true }),
    ]);

    if (results[0].status === "fulfilled" && results[0].value?.success) setProfile(results[0].value.data);
    if (results[1].status === "fulfilled" && results[1].value?.success) setBenefits(results[1].value.data || []);
    if (results[2].status === "fulfilled" && results[2].value?.success) setTransactions(results[2].value.data || []);

    const failed = results.find((result) => result.status === "rejected");
    if (failed) addToast(failed.reason?.message || "Một số thông tin hội viên chưa tải được.", "warning");
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const txnTypes = Array.from(new Set(transactions.map((t) => t.txnType).filter(Boolean)));
  const filteredTransactions = transactions.filter((t) => {
    const matchType = txnType === "ALL" || t.txnType === txnType;
    const query = txnSearch.trim().toLowerCase();
    const matchSearch = !query || `${t.txnType || ""} ${t.note || ""}`.toLowerCase().includes(query);
    return matchType && matchSearch;
  });

  const nextTierPoints = profile?.pointsToNextTier || 0;
  const currentScore = profile?.currentScore || 0;
  const progressPercent = profile?.nextTierName
    ? Math.min(100, Math.max(5, Math.round((currentScore / (currentScore + nextTierPoints)) * 100)))
    : 100;

  return (
    <div className="ops-page guest-page">
      {/* Page Title */}
      <div className="hc-page-title">
        <div>
          <h2>Đặc Quyền Hội Viên</h2>
          <p>Chương trình tri ân khách hàng — Theo dõi điểm tích lũy, các bậc quyền lợi và nâng tầm trải nghiệm nghỉ dưỡng.</p>
        </div>

        <div className="guest-title-actions">
          <Link to="/guest/bookings" className="hc-btn hc-btn-outline">
            <i className="bi bi-clock-history"></i> Lịch sử đặt phòng
          </Link>
          <button type="button" className="hc-btn hc-btn-primary" onClick={loadData} disabled={loading}>
            <i className="bi bi-arrow-clockwise"></i> Làm mới
          </button>
        </div>
      </div>

      {loading && !profile ? (
        <div className="hc-card">
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        </div>
      ) : !profile ? (
        <div className="hc-card">
          <div className="hc-empty-state">
            <i className="bi bi-gem"></i>
            <p>Chưa thể tải dữ liệu hội viên. Vui lòng bấm "Làm mới" để thử lại.</p>
            <button type="button" className="hc-btn hc-btn-primary" onClick={loadData} style={{ marginTop: "14px" }}>
              <i className="bi bi-arrow-clockwise"></i> Tải lại
            </button>
          </div>
        </div>
      ) : (
        <div className="guest-stack">
          {/* VIP Membership Card */}
          <div className="guest-vip-card">
            <div className="guest-vip-top">
              <div className="guest-vip-brand">
                <i className="bi bi-gem"></i>
                <div>
                  <strong>AZURE BAY</strong>
                  <small>ĐẶC QUYỀN HỘI VIÊN</small>
                </div>
              </div>
              <span className="guest-vip-tier-badge">
                <i className="bi bi-shield-check"></i>
                {profile.tierName || profile.tierCode || "HỘI VIÊN"}
              </span>
            </div>

            <div className="guest-vip-chip"></div>

            <div className="guest-vip-holder">
              <div>
                <div className="guest-vip-holder-name">
                  {user?.fullName || profile.customerName || user?.username || "Thành viên quý"}
                </div>
                <div className="guest-vip-member-since">
                  Thành viên từ: {profile.memberSince ? new Date(profile.memberSince).toLocaleDateString("vi-VN") : "Hôm nay"}
                </div>
              </div>

              <div className="guest-vip-points">
                <div className="guest-vip-points-label">Điểm tích lũy</div>
                <div className="guest-vip-points-value">{fmtNumber(currentScore)}</div>
              </div>
            </div>

            <div className="guest-vip-progress-box">
              <div className="guest-vip-progress-head">
                <span>
                  {profile.nextTierName ? (
                    <>Cần tích lũy thêm <strong>{fmtNumber(nextTierPoints)} điểm</strong> để đạt hạng <strong>{profile.nextTierName}</strong></>
                  ) : (
                    "Bạn đang ở hạng thẻ cao cấp nhất. Trân trọng cảm ơn sự gắn bó của quý khách!"
                  )}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="guest-vip-progress-bar">
                <div className="guest-vip-progress-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>

          {/* Benefits Table */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-gift text-primary"></i> Quyền lợi theo hạng của bạn
                  <span className="hc-badge hc-badge-primary" style={{ marginLeft: "6px", fontSize: "11px" }}>
                    {benefits.length} quyền lợi
                  </span>
                </div>
              </div>
            </div>
            <div className="hc-card-body flush u-scroll-x">
              {benefits.length === 0 ? (
                <div className="svc-empty-loyalty-box" style={{ margin: "24px 20px" }}>
                  <div className="svc-empty-loyalty-icon">
                    <i className="bi bi-shield-lock"></i>
                  </div>
                  <h5>Hạng {profile.tierName || "Sò Biển"} — Hạng thành viên khởi đầu</h5>
                  <p>
                    Quý khách đang ở hạng thẻ khởi đầu (0 điểm). Hạng này chưa tích hợp sẵn các đặc quyền trực tiếp. Hãy tích lũy điểm qua các lần đặt phòng và sử dụng dịch vụ tại resort để mở khóa các đặc quyền cao cấp bên dưới!
                  </p>
                  <div className="svc-tier-unlock-preview">
                    <div className="svc-tier-unlock-item">
                      <span className="hc-badge hc-badge-info">Hạng Sao Biển (10 điểm)</span>
                      <span>Giảm 5% giá phòng đặt trực tiếp</span>
                    </div>
                    <div className="svc-tier-unlock-item">
                      <span className="hc-badge hc-badge-warning">Hạng San Hô (30 điểm)</span>
                      <span>Giảm 10% phòng &amp; Miễn phí giặt ủi 2 lần/năm</span>
                    </div>
                    <div className="svc-tier-unlock-item">
                      <span className="hc-badge hc-badge-primary">Hạng Ngọc Trai (80 điểm)</span>
                      <span>Giảm 15% phòng VIP &amp; Tặng 1 đêm nghỉ miễn phí</span>
                    </div>
                  </div>
                </div>
              ) : (
                <Paginated items={benefits}>
                  {(pageRows, pager) => (
                    <>
                      <table className="hc-table">
                        <thead>
                          <tr>
                            <th>Tên quyền lợi</th>
                            <th>Chi tiết ưu đãi</th>
                            <th className="u-text-right">Số lượt áp dụng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((benefit) => (
                            <tr key={benefit.tierBenefitId}>
                              <td>
                                <strong>{benefit.benefitName}</strong>
                              </td>
                              <td>{benefit.description || (benefit.discountPercent ? `Giảm ${benefit.discountPercent}% chi phí dịch vụ` : benefitTypeLabel(benefit.benefitType))}</td>
                              <td className="u-text-right">
                                {benefit.remainingQuota ?? <span className="hc-badge hc-badge-success">Không giới hạn</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {pager}
                    </>
                  )}
                </Paginated>
              )}
            </div>
          </div>

          {/* Points Transactions History */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-clock-history text-primary"></i> Lịch sử biến động điểm
                  {filteredTransactions.length > 0 && (
                    <span className="hc-badge hc-badge-primary" style={{ marginLeft: "6px", fontSize: "11px" }}>
                      {filteredTransactions.length} giao dịch
                    </span>
                  )}
                </div>

                <div className="guest-toolbar-controls">
                  <div className="guest-search">
                    <i className="bi bi-search"></i>
                    <input
                      type="text"
                      className="hc-input"
                      placeholder="Tìm theo loại, nội dung ghi chú..."
                      aria-label="Tìm giao dịch điểm"
                      value={txnSearch}
                      onChange={(e) => setTxnSearch(e.target.value)}
                    />
                  </div>
                  <div className="guest-select-wrap">
                    <SelectMenu
                      ariaLabel="Lọc loại giao dịch"
                      icon="bi-funnel"
                      value={txnType}
                      onChange={setTxnType}
                      options={[{ value: "ALL", label: "Tất cả loại giao dịch" }, ...txnTypes.map((t) => ({ value: t, label: loyaltyTxnLabel(t) }))]}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="hc-card-body flush u-scroll-x">
              {filteredTransactions.length === 0 ? (
                <div className="hc-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>{transactions.length === 0 ? "Chưa có giao dịch tích lũy điểm thưởng nào." : "Không tìm thấy giao dịch nào khớp với bộ lọc."}</p>
                </div>
              ) : (
                <Paginated items={filteredTransactions}>
                  {(pageRows, pager) => (
                    <>
                      <table className="hc-table">
                        <thead>
                          <tr>
                            <th>Thời gian</th>
                            <th>Loại giao dịch</th>
                            <th className="u-text-right">Biến động điểm</th>
                            <th>Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((item) => {
                            const score = Number(item.scoreEarned || 0);
                            const color = score > 0 ? "var(--hc-success)" : score < 0 ? "var(--hc-error)" : "inherit";
                            return (
                              <tr key={item.txnId}>
                                <td>{formatDateTime(item.createdAt)}</td>
                                <td>
                                  <span className="hc-badge hc-badge-primary">{loyaltyTxnLabel(item.txnType)}</span>
                                </td>
                                <td style={{ textAlign: "right", fontWeight: 700, color, fontSize: "14px" }}>
                                  {score > 0 ? "+" : ""}
                                  {fmtNumber(score)}
                                </td>
                                <td>{item.note || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {pager}
                    </>
                  )}
                </Paginated>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
