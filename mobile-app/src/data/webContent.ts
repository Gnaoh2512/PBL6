// Static content + helpers ported 1:1 from the web FE
// (HomePage.jsx, Navbar.jsx, Footer.jsx, utils/roomVisuals.js)
import { Platform } from 'react-native';

export const SERIF_FONT = Platform.select({ ios: 'Georgia', default: 'serif' }) as string;

export const PHOTOS = {
  hero: 'https://images.unsplash.com/photo-1735770517146-e95c872226fc?auto=format&fit=crop&w=2200&q=88',
  retreat: 'https://images.unsplash.com/photo-1588504633950-9dc518941e93?auto=format&fit=crop&w=1800&q=88',
  loyalty: 'https://images.unsplash.com/photo-1679069389827-a633b8905d95?auto=format&fit=crop&w=1800&q=88',
};

export type Moment = { title: string; copy: string; image: string; alternate: string };

export const MOMENTS: Moment[] = [
  { title: 'Phòng nghỉ', copy: 'Không gian tĩnh tại ôm trọn ánh sáng đổi thay trên mặt vịnh.', image: 'https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=86', alternate: 'https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=86' },
  { title: 'Ẩm thực', copy: 'Nguyên liệu bản địa, bàn tiệc ngoài trời và những buổi tối thong thả.', image: 'https://images.unsplash.com/photo-1748052132432-c9ed80205de6?auto=format&fit=crop&w=900&q=86', alternate: 'https://images.unsplash.com/photo-1651697224183-1b25332e6967?auto=format&fit=crop&w=900&q=86' },
  { title: 'Chăm sóc sức khỏe', copy: 'Những liệu trình phục hồi giữa không gian tĩnh lặng bên bờ biển.', image: 'https://images.unsplash.com/photo-1737352777897-e22953991a32?auto=format&fit=crop&w=900&q=86', alternate: 'https://images.unsplash.com/photo-1488345979593-09db0f85545f?auto=format&fit=crop&w=900&q=86' },
  { title: 'Suite', copy: 'Không gian riêng tư rộng rãi với tầm nhìn biển không giới hạn.', image: 'https://images.unsplash.com/photo-1666433638132-16f0185d2fdf?auto=format&fit=crop&w=900&q=86', alternate: 'https://images.unsplash.com/photo-1611920629515-3f76f8c36b37?auto=format&fit=crop&w=900&q=86' },
  { title: 'Trải nghiệm ẩm thực', copy: 'Thực đơn tinh tế từ nông sản địa phương và hải sản đánh bắt trong ngày.', image: 'https://images.unsplash.com/photo-1641924676093-42e61835bbe2?auto=format&fit=crop&w=1200&q=86', alternate: 'https://images.unsplash.com/photo-1651697219057-7b44d777dc87?auto=format&fit=crop&w=1200&q=86' },
  { title: 'Hồ bơi', copy: 'Làn nước mát, nắng ấm và đường chân trời ngay trước mắt.', image: 'https://images.unsplash.com/photo-1615722440048-da4ccf6de048?auto=format&fit=crop&w=900&q=86', alternate: 'https://images.unsplash.com/photo-1739066500258-2c131cdf9852?auto=format&fit=crop&w=900&q=86' },
];

export type ServiceCardData = { title: string; copy: string; link: string; image: string };

export const SERVICE_CARDS: ServiceCardData[] = [
  { title: 'Ẩm thực tại phòng', copy: 'Món ăn theo mùa và hương vị thân quen được phục vụ riêng tại phòng.', link: 'Xem chi tiết ẩm thực', image: 'https://images.unsplash.com/photo-1621873495868-6c5774cf6012?auto=format&fit=crop&w=900&q=84' },
  { title: 'Nhà hàng & lounge', copy: 'Thực đơn ven biển, cocktail tinh tuyển và bàn tiệc hướng ra đại dương.', link: 'Khám phá ẩm thực', image: 'https://images.unsplash.com/photo-1741852197045-cc35920a3aa0?auto=format&fit=crop&w=900&q=84' },
  { title: 'Spa', copy: 'Bộ sưu tập liệu trình phục hồi lấy cảm hứng từ thảo mộc trên đảo.', link: 'Khám phá chăm sóc sức khỏe', image: 'https://images.unsplash.com/photo-1737352777897-e22953991a32?auto=format&fit=crop&w=900&q=84' },
  { title: 'Hồ bơi & bãi biển', copy: 'Ngày thư thái bên hồ bơi vô cực và bờ biển riêng kín đáo.', link: 'Khám phá bờ biển', image: 'https://images.unsplash.com/photo-1669542755430-be091cefbef8?auto=format&fit=crop&w=900&q=84' },
  { title: 'Dịch vụ concierge', copy: 'Gợi ý am hiểu địa phương và hỗ trợ tận tâm để bạn khám phá hòn đảo theo cách riêng.', link: 'Gặp đội ngũ concierge', image: 'https://images.unsplash.com/photo-1631352564777-fe9802f4924c?auto=format&fit=crop&w=900&q=84' },
  { title: 'Dịp đặc biệt', copy: 'Không gian riêng tư và dấu ấn cá nhân cho những khoảnh khắc đáng nhớ.', link: 'Lên kế hoạch sự kiện', image: 'https://images.unsplash.com/photo-1576343547429-1a9ac89d7013?auto=format&fit=crop&w=900&q=84' },
];

export type SectionId = 'stay' | 'about' | 'discover' | 'rooms' | 'experiences' | 'services' | 'gallery' | 'offers' | 'contact';

// Navbar.jsx RESORT_NAV_ITEMS (bootstrap icons -> Ionicons)
export const RESORT_NAV_ITEMS: { section: SectionId; label: string; icon: string }[] = [
  { section: 'about', label: 'Về chúng tôi', icon: 'information-circle-outline' },
  { section: 'discover', label: 'Khám phá', icon: 'compass-outline' },
  { section: 'rooms', label: 'Phòng nghỉ', icon: 'enter-outline' },
  { section: 'experiences', label: 'Trải nghiệm', icon: 'sparkles-outline' },
  { section: 'offers', label: 'Ưu đãi', icon: 'ticket-outline' },
];

export const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6].map((c) => ({ value: String(c), label: `${c} khách` }));
export const ID_TYPE_OPTIONS = [
  { value: 'CCCD', label: 'CCCD / Căn cước' },
  { value: 'PASSPORT', label: 'Hộ chiếu' },
  { value: 'OTHER', label: 'Khác' },
];

// ── utils/roomVisuals.js ──
const ROOM_VARIANTS = [
  { label: 'PHÒNG TIÊU CHUẨN', image: 'https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85', alternate: 'https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=85' },
  { label: 'HẠNG DELUXE', image: 'https://images.unsplash.com/photo-1646974400439-321c4a9240b9?auto=format&fit=crop&w=1200&q=85', alternate: 'https://images.unsplash.com/photo-1666433638132-16f0185d2fdf?auto=format&fit=crop&w=1200&q=85' },
  { label: 'SUITE ĐẶC TRƯNG', image: 'https://images.unsplash.com/photo-1713843841925-6af6ed0df472?auto=format&fit=crop&w=1200&q=85', alternate: 'https://images.unsplash.com/photo-1739066500258-2c131cdf9852?auto=format&fit=crop&w=1200&q=85' },
  { label: 'KHÔNG GIAN CAO CẤP', image: 'https://images.unsplash.com/photo-1611920629515-3f76f8c36b37?auto=format&fit=crop&w=1200&q=85', alternate: 'https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=85' },
];

export function getRoomVisual(roomOrType: any, fallbackIndex = 0) {
  const roomType = roomOrType?.roomType && typeof roomOrType.roomType === 'object' ? roomOrType.roomType : roomOrType || {};
  const explicitImage = roomOrType?.imageUrl || roomType?.imageUrl || '';
  const typeName = String(roomType?.typeName || roomOrType?.roomTypeName || '').toLowerCase();
  const typeId = Number(roomType?.roomTypeId || roomOrType?.roomTypeId || 0);
  let variantIndex: number;
  let customLabel: string | null = null;
  if (/vip|president|tổng thống|biệt thự|villa|hồ bơi|pool/.test(typeName)) { variantIndex = 2; customLabel = 'BIỆT THỰ & VIP'; }
  else if (/family|gia đình/.test(typeName)) { variantIndex = 3; customLabel = 'SUITE GIA ĐÌNH'; }
  else if (/suite/.test(typeName)) { variantIndex = 2; customLabel = 'SUITE ĐẶC TRƯNG'; }
  else if (/deluxe|ocean|sea|hướng biển|vịnh|superior/.test(typeName)) { variantIndex = 1; customLabel = 'HẠNG DELUXE'; }
  else if (/standard|tiêu chuẩn|classic|đơn|single/.test(typeName)) { variantIndex = 0; customLabel = 'PHÒNG TIÊU CHUẨN'; }
  else {
    const seed = typeId > 0 ? typeId - 1 : Math.max(0, Number(fallbackIndex) || 0);
    variantIndex = seed % ROOM_VARIANTS.length;
  }
  const base = ROOM_VARIANTS[variantIndex];
  return { label: customLabel || base.label, image: explicitImage || base.image, alternate: explicitImage || base.alternate };
}

export function getPrimaryAmenityLabel(amenities?: string | null) {
  if (!amenities) return 'Wi-Fi';
  const first = String(amenities).split(/[,;\n•]+/).map((s) => s.trim()).find(Boolean);
  return first || 'Wi-Fi';
}
