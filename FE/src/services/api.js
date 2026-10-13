/**
 * Hotel California — API Client Service
 */

const API_BASE = '';  // Vite proxy handles /api -> localhost:9090

export function getAuthToken() {
  return localStorage.getItem('auth_token') || '';
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem('user_info');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  if (token) localStorage.setItem('auth_token', token);
  if (user) localStorage.setItem('user_info', JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
}

export function hasRole(roles = []) {
  const user = getAuthUser();
  if (!user || !user.role) return false;
  const userRole = user.role.toUpperCase();
  const normalizedRole = userRole.startsWith('ROLE_') ? userRole : 'ROLE_' + userRole;
  return roles.some(r => {
    const normR = r.toUpperCase().startsWith('ROLE_') ? r.toUpperCase() : 'ROLE_' + r.toUpperCase();
    return normR === normalizedRole;
  });
}

export async function apiCall(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
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
    headers
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    if (!options.silentError) {
      console.warn('Network fetch error:', err);
    }
    throw new Error('Không thể kết nối đến máy chủ Backend (http://localhost:9090)');
  }

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (response.status === 401) {
    clearAuthSession();
    throw new Error('Unauthorized');
  }

  if (response.status === 403) {
    throw new Error('Bạn không có quyền thực hiện thao tác này (403 Forbidden)');
  }

  if (!response.ok) {
    const errMessage = (result && result.message) ? result.message : `Lỗi hệ thống (${response.status})`;
    throw new Error(errMessage);
  }

  return result;
}

// Formatters
export function formatVND(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 đ';
  return Number(amount).toLocaleString('vi-VN') + ' đ';
}

export function formatDate(dateStr) {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '---';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleString('vi-VN');
  } catch {
    return dateTimeStr;
  }
}

export function getCategoryName(category) {
  if (!category) return 'Khác';
  if (typeof category === 'string') return category;
  if (typeof category === 'object' && category.categoryName) return category.categoryName;
  return 'Khác';
}

export function getRoomTypeName(room) {
  if (!room) return '---';
  if (room.roomTypeName) return room.roomTypeName;
  if (room.roomType && typeof room.roomType === 'object') return room.roomType.typeName || '---';
  if (typeof room.roomType === 'string') return room.roomType;
  return '---';
}

export function getRoomBasePrice(room) {
  if (!room) return 0;
  if (room.basePrice !== undefined && room.basePrice !== null) return Number(room.basePrice);
  if (room.roomType && typeof room.roomType === 'object') return Number(room.roomType.basePrice || 0);
  return 0;
}

export function getRoomTypeId(room) {
  if (!room) return '';
  if (room.roomTypeId) return String(room.roomTypeId);
  if (room.roomType && typeof room.roomType === 'object') return String(room.roomType.roomTypeId || '');
  return '';
}

