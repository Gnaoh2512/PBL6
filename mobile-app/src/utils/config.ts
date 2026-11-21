import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = '9090';

// Ép địa chỉ thủ công nếu cần (vd: 'http://192.168.1.11:9090'). Đặt thành null để dùng tự động.
// Cách dùng qua biến môi trường (PowerShell):
// $env:EXPO_PUBLIC_API_URL="http://192.168.x.x:9090"; npx expo start -c
const MANUAL_OVERRIDE: string | null = null;

const getApiBaseUrl = (): string => {
  // 1. Ưu tiên cao nhất: biến môi trường EXPO_PUBLIC_API_URL
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Gán cứng thủ công nếu có
  if (MANUAL_OVERRIDE) return MANUAL_OVERRIDE;

  if (Platform.OS === 'web') {
    // Trên web, gọi API tới chính hostname của trình duyệt (ví dụ localhost hoặc IP LAN)
    if (typeof window !== 'undefined') {
      return `http://${window.location.hostname}:${BACKEND_PORT}`;
    }
    return `http://localhost:${BACKEND_PORT}`;
  }

  // Chạy trên điện thoại thật qua ứng dụng Expo Go (kết nối cùng LAN)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    // hostUri thường có dạng "172.31.98.73:8081" (IP:PORT của Expo server)
    const hostIp = hostUri.split(':')[0];
    return `http://${hostIp}:${BACKEND_PORT}`;
  }

  // Fallback nếu chạy Android Emulator mà không có hostUri
  return `http://10.0.2.2:${BACKEND_PORT}`;
};

export const API_BASE_URL = getApiBaseUrl();

// Feature flags
export const FEATURES = {
  customerCancelBooking: false,
};
