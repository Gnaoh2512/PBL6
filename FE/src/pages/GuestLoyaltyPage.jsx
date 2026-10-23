import { useEffect, useState } from 'react';
import { apiCall, formatVND, formatDateTime } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './PortalPages.css';

export default function GuestLoyaltyPage() {
  const { addToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [benefits, setBenefits] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiCall('/api/customer/loyalty/profile', { silentError: true }),
      apiCall('/api/customer/loyalty/benefits', { silentError: true }),
      apiCall('/api/customer/loyalty/transactions', { silentError: true }),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === 'fulfilled' && results[0].value?.success) setProfile(results[0].value.data);
      if (results[1].status === 'fulfilled' && results[1].value?.success) setBenefits(results[1].value.data || []);
      if (results[2].status === 'fulfilled' && results[2].value?.success) setTransactions(results[2].value.data || []);
      const failed = results.find((result) => result.status === 'rejected');
      if (failed) addToast(failed.reason?.message || 'Một số thông tin hội viên chưa tải được.', 'warning');
      setLoading(false);
    });
    return () => { active = false; };
  }, [addToast]);

  return <main className="portal-page"><div className="portal-page-title"><div><span className="portal-eyebrow">AZURE BAY PRIVILEGE</span><h1>Đặc quyền hội viên</h1><p>Thông tin hạng thành viên, điểm thưởng và quyền lợi của bạn.</p></div></div>
    {loading ? <div className="portal-panel portal-loading">Đang tải thông tin hội viên…</div> : !profile ? <div className="portal-panel portal-empty">Chưa thể tải hồ sơ hội viên. Vui lòng thử lại sau.</div> : <>
      <section className="portal-loyalty-card"><span><i className="bi bi-gem"/></span><div><span className="portal-eyebrow">HẠNG THÀNH VIÊN</span><h2>{profile.tierName || profile.tierCode || 'Azure Bay Privilege'}</h2><p>{profile.nextTierName ? `Còn ${Number(profile.pointsToNextTier || 0).toLocaleString('vi-VN')} điểm để lên hạng ${profile.nextTierName}.` : 'Cảm ơn bạn đã đồng hành cùng Azure Bay.'}</p></div></section>
      <section className="portal-metrics" style={{ marginTop: 20 }}><article className="portal-metric"><span><i className="bi bi-stars"/></span><div><p>Điểm hiện có</p><b>{Number(profile.currentScore || 0).toLocaleString('vi-VN')}</b><small>Điểm thưởng hội viên</small></div></article><article className="portal-metric"><span><i className="bi bi-moon-stars"/></span><div><p>Đêm lưu trú</p><b>{profile.totalStayDays || 0}</b><small>Tổng thời gian tại Azure Bay</small></div></article><article className="portal-metric"><span><i className="bi bi-wallet2"/></span><div><p>Tổng chi tiêu</p><b>{formatVND(profile.totalSpent || 0)}</b><small>Chi tiêu đủ điều kiện tích điểm</small></div></article><article className="portal-metric"><span><i className="bi bi-calendar2-heart"/></span><div><p>Thành viên từ</p><b>{profile.memberSince ? new Date(profile.memberSince).toLocaleDateString('vi-VN') : '—'}</b><small>Azure Bay Privilege</small></div></article></section>
      <section className="portal-panel portal-data-panel"><div><span className="portal-eyebrow">DÀNH CHO BẠN</span><h2>Quyền lợi theo hạng</h2></div>{benefits.length ? <div className="portal-table-wrap"><table><thead><tr><th>QUYỀN LỢI</th><th>MÔ TẢ</th><th>CÒN LẠI</th></tr></thead><tbody>{benefits.map((benefit) => <tr key={benefit.tierBenefitId}><td>{benefit.benefitName}</td><td>{benefit.description || (benefit.discountPercent ? `Giảm ${benefit.discountPercent}%` : benefit.benefitType)}</td><td>{benefit.remainingQuota ?? 'Không giới hạn'}</td></tr>)}</tbody></table></div> : <p className="portal-empty">Chưa có quyền lợi khả dụng cho hạng hiện tại.</p>}</section>
      <section className="portal-panel portal-data-panel"><div><span className="portal-eyebrow">LỊCH SỬ ĐIỂM</span><h2>Giao dịch hội viên</h2></div>{transactions.length ? <div className="portal-table-wrap"><table><thead><tr><th>THỜI GIAN</th><th>LOẠI</th><th>ĐIỂM</th><th>GHI CHÚ</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.txnId}><td>{formatDateTime(item.createdAt)}</td><td>{item.txnType}</td><td>{Number(item.scoreEarned || 0).toLocaleString('vi-VN')}</td><td>{item.note || '—'}</td></tr>)}</tbody></table></div> : <p className="portal-empty">Chưa có giao dịch điểm thưởng.</p>}</section>
    </>}
  </main>;
}
