import { Hotel } from '../models/Hotel';

/**
 * Thông tin tổng quan khách sạn (tên, giới thiệu, tiện ích, vị trí).
 * Giữ lại vì backend hiện tại chưa cung cấp API cho thông tin chung khách sạn.
 */
export const MOCK_HOTEL: Hotel = {
  id: 'hotel_azure_bay',
  name: 'Azure Bay Hotel',
  tagline: 'Where Luxury Meets the Sea',
  address: '123 Coastal Boulevard, Đà Nẵng, Việt Nam',
  phone: '+84 236 123 4567',
  email: 'info@azurebayhotel.com',
  website: 'www.azurebayhotel.com',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  description:
    'Azure Bay Hotel là điểm đến sang trọng bậc nhất bên bờ biển Đà Nẵng. Với tầm nhìn toàn cảnh vịnh biển xanh ngọc, chúng tôi mang đến trải nghiệm nghỉ dưỡng hoàn hảo kết hợp giữa kiến trúc hiện đại và văn hóa Việt Nam đặc sắc.',
  latitude: 16.0544,
  longitude: 108.2022,
  rating: 4.8,
  reviewCount: 342,
  amenities: [
    { id: 'a1', name: 'Swimming Pool', icon: 'water' },
    { id: 'a2', name: 'Free WiFi', icon: 'wifi' },
    { id: 'a3', name: 'Restaurant', icon: 'restaurant' },
    { id: 'a4', name: 'Spa', icon: 'spa' },
    { id: 'a5', name: 'Gym', icon: 'fitness' },
    { id: 'a6', name: 'Beach Access', icon: 'umbrella' },
    { id: 'a7', name: 'Parking', icon: 'car' },
    { id: 'a8', name: 'Room Service', icon: 'room-service' },
  ],
};
