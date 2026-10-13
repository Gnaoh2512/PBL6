import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import StaffSidebar from '../../components/StaffSidebar';
import { apiCall } from '../../services/api';

export default function StaffLayout() {
  const [shift, setShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function checkShift() {
      try {
        const res = await apiCall('/api/staff/cashier-shifts/me', { silentError: true });
        if (mounted && res && res.success) {
          setShift(res.data);
        }
      } catch {
        // no active shift or error
      } finally {
        if (mounted) setLoadingShift(false);
      }
    }
    checkShift();
    return () => { mounted = false; };
  }, []);

  const isShiftOpen = shift && shift.status === 'OPEN';

  return (
    <>
      <Navbar />
      <div className="hc-layout-admin">
        <StaffSidebar />
        <main className="hc-admin-main">
          {!loadingShift && !isShiftOpen && (
            <div className="hc-alert hc-alert-warning" style={{ alignItems: 'center' }}>
              <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '1.25rem' }}></i>
              <div style={{ flex: 1 }}>
                <strong>Chưa Mở Ca Thu Ngân:</strong> Nghiệp vụ thanh toán hoặc nhận phòng Walk-in yêu cầu ca trực đang mở.
              </div>
              <Link to="/staff/shifts" className="hc-btn hc-btn-secondary hc-btn-sm">
                <i className="bi bi-cash-coin"></i> Mở Ca Ngay
              </Link>
            </div>
          )}

          {!loadingShift && isShiftOpen && (
            <div className="hc-alert hc-alert-success" style={{ alignItems: 'center', marginBottom: '20px' }}>
              <i className="bi bi-check-circle-fill" style={{ fontSize: '1.2rem' }}></i>
              <div style={{ flex: 1 }}>
                Ca trực <strong>#{shift.cashierShiftId}</strong> đang hoạt động (Bắt đầu lúc {new Date(shift.startTime).toLocaleTimeString('vi-VN')})
              </div>
              <Link to="/staff/shifts" className="hc-btn hc-btn-outline hc-btn-sm">
                Chi tiết ca
              </Link>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </>
  );
}
