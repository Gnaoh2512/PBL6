import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminLayout() {
  return (
    <>
      <Navbar />
      <div className="hc-layout-admin">
        <AdminSidebar />
        <main className="hc-admin-main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
