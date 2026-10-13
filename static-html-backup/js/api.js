/**
 * Hotel California - Core API Client, Route Guard, and Shared UI Helpers
 */

const API_BASE_URL = (window.location.port === '9090' || window.location.port === '')
    ? '' 
    : 'http://localhost:9090';

/**
 * Synchronous Route Guard to prevent Flash of Unauthorized Content.
 * Must be executed in <head> before <body> renders.
 */
function guardPageAccess(allowedRoles = []) {
    const token = localStorage.getItem('auth_token');
    const rawUser = localStorage.getItem('user_info');

    if (!token || !rawUser) {
        window.location.replace('login.html');
        return false;
    }

    if (allowedRoles.length > 0) {
        try {
            const user = JSON.parse(rawUser);
            const userRole = (user.role || '').toUpperCase();
            const normalizedRole = userRole.startsWith('ROLE_') ? userRole : 'ROLE_' + userRole;

            const isAllowed = allowedRoles.some(r => {
                const normR = r.toUpperCase().startsWith('ROLE_') ? r.toUpperCase() : 'ROLE_' + r.toUpperCase();
                return normR === normalizedRole;
            });

            if (!isAllowed) {
                window.location.replace('index.html');
                return false;
            }
        } catch (e) {
            window.location.replace('login.html');
            return false;
        }
    }

    // Authorized: Make body visible immediately
    if (document.body) {
        document.body.style.display = 'block';
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body) document.body.style.display = 'block';
        });
    }
    return true;
}

// Authentication Helpers
function getAuthToken() {
    return localStorage.getItem('auth_token') || '';
}

function getAuthUser() {
    try {
        const raw = localStorage.getItem('user_info');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function setAuthSession(token, user) {
    if (token) localStorage.setItem('auth_token', token);
    if (user) localStorage.setItem('user_info', JSON.stringify(user));
}

function clearAuthSession() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
}

function logout() {
    clearAuthSession();
    window.location.replace('login.html');
}

function hasRole(roles = []) {
    const user = getAuthUser();
    if (!user || !user.role) return false;
    const userRole = user.role.toUpperCase();
    const normalizedRole = userRole.startsWith('ROLE_') ? userRole : 'ROLE_' + userRole;
    return roles.some(r => {
        const normR = r.toUpperCase().startsWith('ROLE_') ? r.toUpperCase() : 'ROLE_' + r.toUpperCase();
        return normR === normalizedRole;
    });
}

// Global Toast System (Bootstrap 5 Style)
function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const typeConfig = {
        success: { bg: 'text-bg-success', icon: 'bi-check-circle-fill' },
        error: { bg: 'text-bg-danger', icon: 'bi-exclamation-octagon-fill' },
        warning: { bg: 'text-bg-warning', icon: 'bi-exclamation-triangle-fill' },
        info: { bg: 'text-bg-primary', icon: 'bi-info-circle-fill' }
    };

    const cfg = typeConfig[type] || typeConfig.info;
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center ${cfg.bg} border-0 show shadow-lg`;
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi ${cfg.icon} fs-5"></i>
                <div>${message}</div>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.toast').remove()"></button>
        </div>
    `;

    container.appendChild(toastEl);

    setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.remove(), 250);
    }, duration);
}

// Core API Call
async function apiCall(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = {
        method: options.method || 'GET',
        headers: headers
    };

    if (options.body) {
        fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, fetchOptions);
        let result = null;
        try {
            result = await response.json();
        } catch (e) {
            result = null;
        }

        if (response.status === 401) {
            clearAuthSession();
            showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
            if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('register.html')) {
                setTimeout(() => window.location.replace('login.html'), 1000);
            }
            throw new Error('Unauthorized');
        }

        if (response.status === 403) {
            showToast('Bạn không có quyền thực hiện thao tác này (403 Forbidden)', 'error');
            throw new Error('Forbidden');
        }

        if (!response.ok) {
            const errMessage = (result && result.message) ? result.message : `Lỗi hệ thống (${response.status})`;
            if (!options.silentError) {
                showToast(errMessage, 'error');
            }
            throw new Error(errMessage);
        }

        return result;
    } catch (err) {
        if (err.message !== 'Unauthorized' && err.message !== 'Forbidden' && !options.silentError) {
            if (err.name === 'TypeError') {
                showToast('Không thể kết nối đến máy chủ Backend (http://localhost:9090)', 'error');
            }
        }
        throw err;
    }
}

// Formatters
function formatVND(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0 đ';
    return Number(amount).toLocaleString('vi-VN') + ' đ';
}

function formatDate(dateStr) {
    if (!dateStr) return '---';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('vi-VN');
    } catch (e) {
        return dateStr;
    }
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '---';
    try {
        const d = new Date(dateTimeStr);
        if (isNaN(d.getTime())) return dateTimeStr;
        return d.toLocaleString('vi-VN');
    } catch (e) {
        return dateTimeStr;
    }
}

// Bootstrap Modal Helpers
function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        const modal = bootstrap.Modal.getOrCreateInstance(el);
        modal.show();
    }
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        const modal = bootstrap.Modal.getInstance(el);
        if (modal) modal.hide();
    }
}

// Render Top Navbar with Hotel California Branding
function renderTopNav(activeId = '') {
    const navContainer = document.getElementById('top-navbar');
    if (!navContainer) return;

    const user = getAuthUser();
    let authArea = '';

    const isStaff = hasRole(['RECEPTIONIST', 'CASHIER', 'HOUSEKEEPING', 'MANAGER', 'ADMIN']);
    const isAdmin = hasRole(['ADMIN', 'MANAGER']);

    if (user) {
        const roleLabel = (user.role || '').replace('ROLE_', '');
        authArea = `
            <div class="d-flex align-items-center gap-2">
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">${roleLabel}</span>
                <span class="fw-semibold text-dark small">${user.fullName || user.username}</span>
                <button onclick="logout()" class="btn btn-outline-danger btn-sm">
                    <i class="bi bi-box-arrow-right"></i> Đăng xuất
                </button>
            </div>
        `;
    } else {
        authArea = `
            <div class="d-flex align-items-center gap-2">
                <a href="login.html" class="btn btn-outline-primary btn-sm">Đăng nhập</a>
                <a href="register.html" class="btn btn-primary btn-sm">Đăng ký</a>
            </div>
        `;
    }

    navContainer.className = 'navbar navbar-expand-lg navbar-hotel sticky-top py-2';
    navContainer.innerHTML = `
        <div class="container-fluid px-4">
            <a class="navbar-brand" href="index.html">
                <i class="bi bi-building fs-4 text-primary"></i>
                <span>Hotel California</span>
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navContent">
                <ul class="navbar-nav me-auto mb-2 mb-lg-0 gap-1">
                    <li class="nav-item">
                        <a class="nav-link ${activeId === 'home' ? 'active fw-bold text-primary' : ''}" href="index.html">
                            <i class="bi bi-house-door"></i> Trang chủ
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${activeId === 'booking' ? 'active fw-bold text-primary' : ''}" href="booking.html">
                            <i class="bi bi-calendar-check"></i> Đặt phòng & QR
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${activeId === 'services' ? 'active fw-bold text-primary' : ''}" href="services.html">
                            <i class="bi bi-cup-hot"></i> Dịch vụ & Folio
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${activeId === 'history' ? 'active fw-bold text-primary' : ''}" href="history.html">
                            <i class="bi bi-clock-history"></i> Tra cứu & Lịch sử
                        </a>
                    </li>
                    ${isStaff ? `
                    <li class="nav-item">
                        <a class="nav-link ${activeId === 'staff' ? 'active fw-bold text-primary' : ''}" href="staff-rooms.html">
                            <i class="bi bi-grid-3x3-gap"></i> Lễ tân & Thu ngân
                        </a>
                    </li>
                    ` : ''}
                    ${isAdmin ? `
                    <li class="nav-item">
                        <a class="nav-link ${activeId === 'admin' ? 'active fw-bold text-primary' : ''}" href="admin-accounts.html">
                            <i class="bi bi-gear"></i> Quản trị Admin
                        </a>
                    </li>
                    ` : ''}
                </ul>
                ${authArea}
            </div>
        </div>
    `;
}

// Render Staff & Admin Sidebar
function renderSidebar(activeId = '') {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;

    sidebar.className = 'app-sidebar';
    sidebar.innerHTML = `
        <div class="sidebar-heading">Nghiệp Vụ Lễ Tân & Thu Ngân</div>
        <nav class="d-flex flex-column mb-3">
            <a href="staff-shifts.html" class="sidebar-link ${activeId === 'staff-shifts' ? 'active' : ''}">
                <i class="bi bi-cash-coin fs-5"></i> Quản lý Ca trực
            </a>
            <a href="staff-rooms.html" class="sidebar-link ${activeId === 'staff-rooms' ? 'active' : ''}">
                <i class="bi bi-grid-3x3-gap fs-5"></i> Sơ đồ phòng & Quyết toán
            </a>
            <a href="staff-walkin.html" class="sidebar-link ${activeId === 'staff-walkin' ? 'active' : ''}">
                <i class="bi bi-person-plus fs-5"></i> Đặt phòng tại quầy (Walk-in)
            </a>
        </nav>

        <div class="sidebar-heading">Quản Trị Hệ Thống (Admin)</div>
        <nav class="d-flex flex-column mb-auto">
            <a href="admin-accounts.html" class="sidebar-link ${activeId === 'admin-accounts' ? 'active' : ''}">
                <i class="bi bi-people fs-5"></i> Tài khoản & Audit Log
            </a>
            <a href="admin-rooms.html" class="sidebar-link ${activeId === 'admin-rooms' ? 'active' : ''}">
                <i class="bi bi-door-closed fs-5"></i> Quản lý Phòng & Hạng phòng
            </a>
            <a href="admin-services.html" class="sidebar-link ${activeId === 'admin-services' ? 'active' : ''}">
                <i class="bi bi-cup-hot fs-5"></i> Quản lý Dịch vụ
            </a>
            <a href="admin-schedules.html" class="sidebar-link ${activeId === 'admin-schedules' ? 'active' : ''}">
                <i class="bi bi-calendar-week fs-5"></i> Ca & Lịch làm việc
            </a>
            <a href="admin-vouchers.html" class="sidebar-link ${activeId === 'admin-vouchers' ? 'active' : ''}">
                <i class="bi bi-ticket-perforated fs-5"></i> Quản lý Voucher
            </a>
        </nav>

        <div class="p-3 border-top">
            <a href="index.html" class="btn btn-outline-secondary btn-sm w-100">
                <i class="bi bi-arrow-left"></i> Về Trang Khách Hàng
            </a>
        </div>
    `;
}
