/**
 * Azure Bay — API Client Service
 */

const API_BASE = ""; // Vite proxy handles /api -> localhost:9090

export function getAuthToken() {
  return localStorage.getItem("auth_token") || "";
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem("user_info");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  if (token) localStorage.setItem("auth_token", token);
  if (user) localStorage.setItem("user_info", JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user_info");
}

function normalizeRole(role) {
  if (typeof role === "string") {
    const normalized = role.trim().toUpperCase();
    return normalized.startsWith("ROLE_") ? normalized : `ROLE_${normalized}`;
  }
  if (role && typeof role === "object") {
    return normalizeRole(role.roleCode || role.authority || role.name || role.code);
  }
  return "";
}

export function getPrimaryRole(user) {
  const role = user?.role ?? user?.roleCode ?? user?.authorities?.[0];
  return normalizeRole(Array.isArray(role) ? role[0] : role);
}

export function hasRole(roles = [], candidateUser = getAuthUser()) {
  const userRole = getPrimaryRole(candidateUser);
  if (!userRole) return false;
  const availableRoles = Array.isArray(candidateUser?.roles) ? candidateUser.roles : [];
  const userRoles = [userRole, ...availableRoles.map(normalizeRole)];
  return roles.some((role) => userRoles.includes(normalizeRole(role)));
}

export async function apiCall(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = options.auth === false ? '' : getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.credentials ? { credentials: options.credentials } : {})
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (!options.silentError) {
      console.warn("Network fetch error:", err);
    }
    throw new Error("Không thể kết nối đến máy chủ Backend (http://localhost:9090)");
  }

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (response.status === 401) {
    clearAuthSession();
    const failure = new Error('Unauthorized');
    Object.assign(failure, { status: 401, code: result?.data?.code || 'UNAUTHORIZED', retryable: false });
    throw failure;
  }

  if (response.status === 403) {
    const failure = new Error('Bạn không có quyền thực hiện thao tác này (403 Forbidden)');
    Object.assign(failure, { status: 403, code: result?.data?.code || 'FORBIDDEN', retryable: false });
    throw failure;
  }

  if (!response.ok) {
    const errMessage = (result && result.message) ? result.message : `Lỗi hệ thống (${response.status})`;
    const error = new Error(errMessage);
    error.status = response.status;
    error.code = result?.data?.code || 'HTTP_ERROR';
    error.retryable = result?.data?.retryable === true;
    throw error;
  }

  return result;
}

// Serialized resets prevent an older logout request from invalidating a newer chat.
let assistantReset = Promise.resolve();
export function resetAssistantSession() {
  assistantReset = assistantReset.catch(() => {}).then(() => apiCall('/api/assistant/session', {
    method: 'DELETE', credentials: 'same-origin', auth: false, silentError: true
  }));
  return assistantReset;
}
export function waitForAssistantSessionReset() { return assistantReset; }

// Formatters
export function formatVND(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "0 đ";
  return Number(amount).toLocaleString("vi-VN") + " đ";
}

export function formatDate(dateStr) {
  if (!dateStr) return "---";
  try {
    let d;
    if (Array.isArray(dateStr)) {
      d = new Date(dateStr[0], (dateStr[1] || 1) - 1, dateStr[2] || 1, dateStr[3] || 0, dateStr[4] || 0, dateStr[5] || 0);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("vi-VN");
  } catch {
    return String(dateStr);
  }
}

export function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return "---";
  try {
    let d;
    if (Array.isArray(dateTimeStr)) {
      d = new Date(dateTimeStr[0], (dateTimeStr[1] || 1) - 1, dateTimeStr[2] || 1, dateTimeStr[3] || 0, dateTimeStr[4] || 0, dateTimeStr[5] || 0);
    } else {
      d = new Date(dateTimeStr);
    }
    if (isNaN(d.getTime())) return String(dateTimeStr);
    return d.toLocaleString("vi-VN");
  } catch {
    return String(dateTimeStr);
  }
}

export function getCategoryName(category) {
  if (!category) return "Khác";
  if (typeof category === "string") return category;
  if (typeof category === "object") {
    if (category.categoryName) return category.categoryName;
    if (category.category && typeof category.category === "object" && category.category.categoryName) {
      return category.category.categoryName;
    }
    if (typeof category.category === "string") return category.category;
    if (category.name) return category.name;
  }
  return "Khác";
}

// Colour-codes a service category tag so each kind of service reads at a glance.
// Known categories get a fixed tone; any other name gets a stable tone from a hash.
const CATEGORY_TONES = ["warning", "info", "violet", "success", "primary"];
export function getCategoryTone(categoryName) {
  const name = String(categoryName || "").trim().toLowerCase();
  if (!name || name === "khác") return "muted";
  if (/ẩm thực|đồ uống|f&b|nhà hàng|ăn|uống/.test(name)) return "warning";
  if (/phòng|giặt/.test(name)) return "info";
  if (/spa|thư giãn|massage|chăm sóc/.test(name)) return "violet";
  if (/đưa đón|phương tiện|xe|vận chuyển/.test(name)) return "success";
  if (/tiện ích/.test(name)) return "primary";
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_TONES[hash % CATEGORY_TONES.length];
}

export function getRoomTypeName(room) {
  if (!room) return "---";
  if (room.roomTypeName) return room.roomTypeName;
  if (room.roomType && typeof room.roomType === "object") return room.roomType.typeName || "---";
  if (typeof room.roomType === "string") return room.roomType;
  return "---";
}

export function getRoomBasePrice(room) {
  if (!room) return 0;
  if (room.basePrice !== undefined && room.basePrice !== null) return Number(room.basePrice);
  if (room.roomType && typeof room.roomType === "object") return Number(room.roomType.basePrice || 0);
  return 0;
}

export function getRoomTypeId(room) {
  if (!room) return "";
  if (room.roomTypeId) return String(room.roomTypeId);
  if (room.roomType && typeof room.roomType === "object") return String(room.roomType.roomTypeId || "");
  return "";
}
