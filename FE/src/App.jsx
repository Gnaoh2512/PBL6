import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Public Pages
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import ServicesPage from './pages/ServicesPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Staff Section
import StaffLayout from './pages/staff/StaffLayout';
import StaffShiftsPage from './pages/staff/StaffShiftsPage';
import StaffRoomsPage from './pages/staff/StaffRoomsPage';
import StaffWalkInPage from './pages/staff/StaffWalkInPage';

// Admin Section
import AdminLayout from './pages/admin/AdminLayout';
import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import AdminRoomsPage from './pages/admin/AdminRoomsPage';
import AdminServicesPage from './pages/admin/AdminServicesPage';
import AdminSchedulesPage from './pages/admin/AdminSchedulesPage';
import AdminVouchersPage from './pages/admin/AdminVouchersPage';

function ProtectedRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, hasRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return children;
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
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Staff / Receptionist Routes */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['RECEPTIONIST', 'CASHIER', 'HOUSEKEEPING', 'MANAGER', 'ADMIN']}>
                  <StaffLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/staff/rooms" replace />} />
              <Route path="shifts" element={<StaffShiftsPage />} />
              <Route path="rooms" element={<StaffRoomsPage />} />
              <Route path="walkin" element={<StaffWalkInPage />} />
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
              <Route index element={<Navigate to="/admin/accounts" replace />} />
              <Route path="accounts" element={<AdminAccountsPage />} />
              <Route path="rooms" element={<AdminRoomsPage />} />
              <Route path="services" element={<AdminServicesPage />} />
              <Route path="schedules" element={<AdminSchedulesPage />} />
              <Route path="vouchers" element={<AdminVouchersPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
