import { useCallback, useEffect, useState } from "react";
import { apiCall, formatVND, formatDateTime } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import "./GuestPages.css";

const fmtNumber = (value) => Number(value || 0).toLocaleString("vi-VN");

const TONE = {
  primary: { background: "var(--hc-primary-subtle)", color: "var(--hc-primary)" },
  info: { background: "var(--hc-info-bg)", color: "var(--hc-info)" },
  success: { background: "var(--hc-success-bg)", color: "var(--hc-success)" },
  warning: { background: "var(--hc-warning-bg)", color: "var(--hc-warning)" },
};

export default function GuestLoyaltyPage() {
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

  const stats = profile
    ? [
        { icon: "bi-stars", label: "Điểm hiện có", value: fmtNumber(profile.currentScore), tone: "primary" },
        { icon: "bi-moon-stars", label: "Đêm lưu trú", value: profile.totalStayDays || 0, tone: "info" },
        { icon: "bi-wallet2", label: "Tổng chi tiêu", value: formatVND(profile.totalSpent || 0), tone: "success" },
        { icon: "bi-calendar2-heart", label: "Thành viên từ", value: profile.memberSince ? new Date(profile.memberSince).toLocaleDateString("vi-VN") : "—", tone: "warning" },
      ]
    : [];

  return (
    <div className="ops-page guest-page">
      <div className="hc-page-title">
        <div>
          <h2>Đặc Quyền Hội Viên</h2>
          <p>Thông tin hạng thành viên, điểm thưởng và quyền lợi của bạn.</p>
        </div>

        <div className="guest-title-actions">
          <button type="button" className="hc-btn hc-btn-outline" onClick={loadData} disabled={loading}>
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
            <p>Chưa thể tải hồ sơ hội viên. Bấm "Làm mới" để thử lại.</p>
          </div>
        </div>
      ) : (
        <div className="guest-stack">
          {/* Tier + key numbers */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div>
                  <div className="guest-cell-sub">Hạng thành viên</div>
                  <div className="guest-toolbar-title" style={{ fontSize: "var(--hc-text-xl)" }}>
                    <i className="bi bi-gem text-primary"></i>
                    {profile.tierName || profile.tierCode || "Azure Bay Privilege"}
                  </div>
                </div>
                <span className="hc-badge hc-badge-primary">
                  {profile.nextTierName ? `Còn ${fmtNumber(profile.pointsToNextTier)} điểm để lên hạng ${profile.nextTierName}` : "Cảm ơn bạn đã đồng hành cùng Azure Bay"}
                </span>
              </div>
            </div>
            <div className="hc-card-body">
              <div className="guest-stats">
                {stats.map((item) => (
                  <div className="hc-stat-card" key={item.label} style={{ padding: "16px" }}>
                    <div className="hc-stat-icon" style={TONE[item.tone]}>
                      <i className={`bi ${item.icon}`}></i>
                    </div>
                    <div>
                      <div className="hc-stat-value">{item.value}</div>
                      <div className="hc-stat-label">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-toolbar-title">
                  <i className="bi bi-gift text-primary"></i> Quyền lợi theo hạng
                </div>
                <span className="hc-badge hc-badge-primary">{benefits.length} quyền lợi</span>
              </div>
            </div>
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              {benefits.length === 0 ? (
                <div className="hc-empty-state">
                  <i className="bi bi-gift"></i>
                  <p>Chưa có quyền lợi khả dụng cho hạng hiện tại.</p>
                </div>
              ) : (
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>Quyền lợi</th>
                      <th>Mô tả</th>
                      <th style={{ textAlign: "right" }}>Còn lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benefits.map((benefit) => (
                      <tr key={benefit.tierBenefitId}>
                        <td>
                          <strong>{benefit.benefitName}</strong>
                        </td>
                        <td>{benefit.description || (benefit.discountPercent ? `Giảm ${benefit.discountPercent}%` : benefit.benefitType)}</td>
                        <td style={{ textAlign: "right" }}>{benefit.remainingQuota ?? <span className="hc-badge hc-badge-success">Không giới hạn</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Points history */}
          <div className="hc-card">
            <div className="hc-card-header">
              <div className="guest-toolbar">
                <div className="guest-search">
                  <i className="bi bi-search"></i>
                  <input type="text" className="hc-input" placeholder="Tìm theo loại, ghi chú..." aria-label="Tìm giao dịch điểm" value={txnSearch} onChange={(e) => setTxnSearch(e.target.value)} />
                </div>
                <select className="hc-select guest-select" aria-label="Lọc loại giao dịch" value={txnType} onChange={(e) => setTxnType(e.target.value)}>
                  <option value="ALL">Tất cả loại giao dịch</option>
                  {txnTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
              {filteredTransactions.length === 0 ? (
                <div className="hc-empty-state">
                  <i className="bi bi-clock-history"></i>
                  <p>{transactions.length === 0 ? "Chưa có giao dịch điểm thưởng." : "Không có giao dịch nào khớp với bộ lọc."}</p>
                </div>
              ) : (
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Loại</th>
                      <th style={{ textAlign: "right" }}>Điểm</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((item) => {
                      const score = Number(item.scoreEarned || 0);
                      const color = score > 0 ? "var(--hc-success)" : score < 0 ? "var(--hc-error)" : "inherit";
                      return (
                        <tr key={item.txnId}>
                          <td>{formatDateTime(item.createdAt)}</td>
                          <td>
                            <span className="hc-badge hc-badge-primary">{item.txnType}</span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600, color }}>
                            {score > 0 ? "+" : ""}
                            {fmtNumber(score)}
                          </td>
                          <td>{item.note || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
