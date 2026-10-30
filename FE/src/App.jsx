import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Public Pages
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import ServicesPage from './pages/ServicesPage';
import GuestBookingsPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GuestLayout from './pages/GuestLayout';
import GuestDashboardPage from './pages/GuestDashboardPage';
import GuestLoyaltyPage from './pages/GuestLoyaltyPage';
import PortalOverviewPage from './pages/PortalOverviewPage';
import StaffBookingsPage from './pages/staff/StaffBookingsPage';
import StaffRequestsPage from './pages/staff/StaffRequestsPage';
import StaffMaintenancePage from './pages/staff/StaffMaintenancePage';
import ProfilePage from './pages/ProfilePage';
import './pages/operations-redesign.css';
import './pages/commerce-redesign.css';

// Staff Section
import StaffLayout from './pages/staff/StaffLayout';
import StaffShiftsPage from './pages/staff/StaffShiftsPage';
import StaffRoomsPage from './pages/staff/StaffRoomsPage';
import StaffWalkInPage from './pages/staff/StaffWalkInPage';

// Admin Section
import AdminLayout from './pages/admin/AdminLayout';
import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import AdminActivityLogPage from './pages/admin/AdminActivityLogPage';
import AdminRoomsPage from './pages/admin/AdminRoomsPage';
import AdminServicesPage from './pages/admin/AdminServicesPage';
import AdminSchedulesPage from './pages/admin/AdminSchedulesPage';
import AdminVouchersPage from './pages/admin/AdminVouchersPage';
import AdminEquipmentPage from './pages/admin/AdminEquipmentPage';
import AdminLoyaltyPage from './pages/admin/AdminLoyaltyPage';

function ProtectedRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, authReady, hasRole } = useAuth();

  if (!authReady) {
    return <div className="auth-loading" role="status">Checking your account…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function StaffPortalIndex() {
  const { hasRole } = useAuth();
  const destination = hasRole(['ADMIN', 'MANAGER', 'RECEPTIONIST'])
    ? '/staff/overview'
    : hasRole(['HOUSEKEEPING']) ? '/staff/rooms?status=CLEANING'
      : hasRole(['MAINTENANCE']) ? '/staff/maintenance' : '/staff/requests';
  return <Navigate to={destination} replace />;
}

function StaffHistoryRedirect() {
  const { hasRole } = useAuth();
  const destination = hasRole(['HOUSEKEEPING']) ? '/staff/rooms?status=CLEANING'
    : hasRole(['MAINTENANCE']) ? '/staff/maintenance'
      : hasRole(['SERVICE_STAFF']) ? '/staff/requests' : '/staff/bookings';
  return <Navigate to={destination} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Customer Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Authenticated guest portal */}
            <Route
              path="/guest"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <GuestLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<GuestDashboardPage />} />
              <Route path="loyalty" element={<GuestLoyaltyPage />} />
              <Route path="bookings" element={<GuestBookingsPage portal />} />
              <Route path="services" element={<ServicesPage portal />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Staff / Receptionist Routes */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['RECEPTIONIST', 'HOUSEKEEPING', 'SERVICE_STAFF', 'MAINTENANCE', 'MANAGER', 'ADMIN']}>
                  <StaffLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<StaffPortalIndex />} />
              <Route path="profile" element={<ProtectedRoute allowedRoles={['MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'SERVICE_STAFF', 'MAINTENANCE']}><ProfilePage /></ProtectedRoute>} />
              <Route path="overview" element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RECEPTIONIST']}><PortalOverviewPage type="staff" /></ProtectedRoute>} />
              <Route path="shifts" element={<ProtectedRoute allowedRoles={['RECEPTIONIST', 'MANAGER', 'ADMIN']}><StaffShiftsPage /></ProtectedRoute>} />
              <Route path="rooms" element={<ProtectedRoute allowedRoles={['RECEPTIONIST', 'HOUSEKEEPING', 'MANAGER', 'ADMIN']}><StaffRoomsPage /></ProtectedRoute>} />
              <Route path="bookings" element={<ProtectedRoute allowedRoles={['RECEPTIONIST', 'MANAGER', 'ADMIN']}><StaffBookingsPage /></ProtectedRoute>} />
              <Route path="walkin" element={<ProtectedRoute allowedRoles={['RECEPTIONIST', 'MANAGER', 'ADMIN']}><StaffWalkInPage /></ProtectedRoute>} />
              <Route path="requests" element={<ProtectedRoute allowedRoles={['SERVICE_STAFF', 'RECEPTIONIST', 'MANAGER', 'ADMIN']}><StaffRequestsPage /></ProtectedRoute>} />
              <Route path="maintenance" element={<ProtectedRoute allowedRoles={['MAINTENANCE', 'HOUSEKEEPING', 'RECEPTIONIST', 'MANAGER', 'ADMIN']}><StaffMaintenancePage /></ProtectedRoute>} />
              <Route path="history" element={<StaffHistoryRedirect />} />
            </Route>

            {/* Admin Management Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/overview" replace />} />
              <Route path="overview" element={<PortalOverviewPage type="admin" />} />
              <Route path="profile" element={<ProtectedRoute allowedRoles={['MANAGER']}><ProfilePage /></ProtectedRoute>} />
              <Route path="history" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminActivityLogPage /></ProtectedRoute>} />
              <Route path="accounts" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminAccountsPage /></ProtectedRoute>} />
              <Route path="rooms" element={<AdminRoomsPage />} />
              <Route path="services" element={<AdminServicesPage />} />
              <Route path="schedules" element={<AdminSchedulesPage />} />
              <Route path="vouchers" element={<AdminVouchersPage />} />
              <Route path="equipment" element={<AdminEquipmentPage />} />
              <Route path="loyalty" element={<AdminLoyaltyPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
