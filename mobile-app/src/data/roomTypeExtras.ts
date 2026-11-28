// Extra static info per roomTypeId (images, area, bedType)
// Backend does not return these fields, so we map them locally.

export interface RoomTypeExtras {
  images: string[];
  area: string;
  bedType: string;
}

export const STANDARD_EXTRAS: RoomTypeExtras = {
  images: [
    'https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=85',
  ],
  area: '22 m²',
  bedType: '1 giường đơn',
};

export const DELUXE_EXTRAS: RoomTypeExtras = {
  images: [
    'https://images.unsplash.com/photo-1646974400439-321c4a9240b9?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1666433638132-16f0185d2fdf?auto=format&fit=crop&w=1200&q=85',
  ],
  area: '35 m²',
  bedType: '1 giường đôi (King)',
};

export const SUITE_EXTRAS: RoomTypeExtras = {
  images: [
    'https://images.unsplash.com/photo-1713843841925-6af6ed0df472?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1739066500258-2c131cdf9852?auto=format&fit=crop&w=1200&q=85',
  ],
  area: '52 m²',
  bedType: '1 giường King + 2 giường đơn',
};

export const VIP_EXTRAS: RoomTypeExtras = {
  images: [
    'https://images.unsplash.com/photo-1611920629515-3f76f8c36b37?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1713843841925-6af6ed0df472?auto=format&fit=crop&w=1200&q=85',
  ],
  area: '65 m²',
  bedType: '1 giường King cao cấp',
};

export const DEFAULT_EXTRAS: RoomTypeExtras = {
  images: ['https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85'],
  area: '30 m²',
  bedType: 'Giường đôi',
};

const ROOM_TYPE_EXTRAS: Record<number, RoomTypeExtras> = {
  1: STANDARD_EXTRAS,
  2: DELUXE_EXTRAS,
  3: SUITE_EXTRAS,
};

/**
 * Lấy thông tin bổ sung (ảnh, diện tích, loại giường) cho loại phòng:
 * 1. Ưu tiên tra theo roomTypeId
 * 2. Nếu không có, chọn theo typeName không phân biệt hoa thường:
 *    - Chứa "vip" → bộ ảnh VIP
 *    - Chứa "suite" hoặc "family" → bộ ảnh Suite
 *    - Chứa "deluxe" → bộ ảnh Deluxe
 *    - Chứa "standard" → bộ ảnh Standard
 * 3. Cuối cùng dùng bộ ảnh mặc định
 */
export const getRoomExtras = (
  roomTypeId?: number | string | null,
  typeName?: string | null
): RoomTypeExtras => {
  // 1. Ưu tiên tra theo id
  if (roomTypeId !== undefined && roomTypeId !== null) {
    const id = typeof roomTypeId === 'string' ? parseInt(roomTypeId, 10) : roomTypeId;
    if (!isNaN(id) && ROOM_TYPE_EXTRAS[id]) {
      return ROOM_TYPE_EXTRAS[id];
    }
  }

  // 2. Tra theo tên không phân biệt hoa thường
  if (typeName) {
    const lower = typeName.toLowerCase();
    if (lower.includes('vip')) {
      return VIP_EXTRAS;
    }
    if (lower.includes('suite') || lower.includes('family')) {
      return SUITE_EXTRAS;
    }
    if (lower.includes('deluxe')) {
      return DELUXE_EXTRAS;
    }
    if (lower.includes('standard')) {
      return STANDARD_EXTRAS;
    }
  }

  // 3. Cuối cùng dùng bộ ảnh mặc định
  return DEFAULT_EXTRAS;
};

// Giữ lại alias getRoomTypeExtras để tương thích ngược
export const getRoomTypeExtras = (
  roomTypeId?: number | string | null,
  typeName?: string | null
): RoomTypeExtras => getRoomExtras(roomTypeId, typeName);
