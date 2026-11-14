import axios from 'axios';
import { Alert, Platform } from 'react-native';
import { API_BASE_URL } from '../utils/config';
import { useAuthStore } from '../store/useAuthStore';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // Nếu API trả về success: false ở tầng data (dù status 200)
    if (response.data && response.data.success === false) {
      return Promise.reject({
        response: {
          data: response.data,
          status: response.status
        },
        message: response.data.message || 'Có lỗi xảy ra từ máy chủ.'
      });
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const url = error.config?.url;
      const hasToken = !!error.config?.headers?.Authorization;
      
      if (status === 401 || status === 403) {
        console.log(`[Auth Error] Status: ${status}, URL: ${url}`);
      }

      // Chỉ tự động đăng xuất nếu nhận 401 VÀ request đó có đính kèm token
      if (status === 401 && hasToken) {
        useAuthStore.getState().logout();
        if (Platform.OS === 'web') {
          window.alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        } else {
          Alert.alert('Hết phiên', 'Vui lòng đăng nhập lại.');
        }
      } 
      // Nếu 403 thì chỉ báo lỗi không có quyền, không logout
      else if (status === 403) {
        if (Platform.OS === 'web') {
          window.alert('Lỗi 403: Không có quyền truy cập tính năng này.');
        } else {
          Alert.alert('Từ chối truy cập', 'Bạn không có quyền thực hiện hành động này.');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
