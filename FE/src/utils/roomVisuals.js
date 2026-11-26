const ROOM_VARIANTS = [
  {
    label: "PHÒNG TIÊU CHUẨN",
    image: "https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85",
    alternate: "https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=85",
  },
  {
    label: "HẠNG DELUXE",
    image: "https://images.unsplash.com/photo-1646974400439-321c4a9240b9?auto=format&fit=crop&w=1200&q=85",
    alternate: "https://images.unsplash.com/photo-1666433638132-16f0185d2fdf?auto=format&fit=crop&w=1200&q=85",
  },
  {
    label: "SUITE ĐẶC TRƯNG",
    image: "https://images.unsplash.com/photo-1713843841925-6af6ed0df472?auto=format&fit=crop&w=1200&q=85",
    alternate: "https://images.unsplash.com/photo-1739066500258-2c131cdf9852?auto=format&fit=crop&w=1200&q=85",
  },
  {
    label: "KHÔNG GIAN CAO CẤP",
    image: "https://images.unsplash.com/photo-1611920629515-3f76f8c36b37?auto=format&fit=crop&w=1200&q=85",
    alternate: "https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=85",
  },
];

/**
 * Returns consistent visual metadata (image, alternate hover image, label)
 * for a Room or RoomType so HomePage and BookingPage display identical visuals.
 */
export function getRoomVisual(roomOrType, fallbackIndex = 0) {
  const roomType = roomOrType?.roomType && typeof roomOrType.roomType === "object" ? roomOrType.roomType : roomOrType || {};
  const explicitImage = roomOrType?.imageUrl || roomType?.imageUrl || "";
  const typeName = String(roomType?.typeName || roomOrType?.roomTypeName || "").toLowerCase();
  const typeId = Number(roomType?.roomTypeId || roomOrType?.roomTypeId || 0);

  let variantIndex;
  let customLabel = null;

  if (/vip|president|tổng thống|biệt thự|villa|hồ bơi|pool/.test(typeName)) {
    variantIndex = 2;
    customLabel = "BIỆT THỰ & VIP";
  } else if (/family|gia đình/.test(typeName)) {
    variantIndex = 3;
    customLabel = "SUITE GIA ĐÌNH";
  } else if (/suite/.test(typeName)) {
    variantIndex = 2;
    customLabel = "SUITE ĐẶC TRƯNG";
  } else if (/deluxe|ocean|sea|hướng biển|vịnh|superior/.test(typeName)) {
    variantIndex = 1;
    customLabel = "HẠNG DELUXE";
  } else if (/standard|tiêu chuẩn|classic|đơn|single/.test(typeName)) {
    variantIndex = 0;
    customLabel = "PHÒNG TIÊU CHUẨN";
  } else {
    const seed = typeId > 0 ? typeId - 1 : Math.max(0, Number(fallbackIndex) || 0);
    variantIndex = seed % ROOM_VARIANTS.length;
  }

  const base = ROOM_VARIANTS[variantIndex];
  return {
    label: customLabel || base.label,
    image: explicitImage || base.image,
    alternate: explicitImage || base.alternate,
  };
}

export function getPrimaryAmenityLabel(amenities) {
  if (!amenities) return "Wi-Fi";
  const first = String(amenities)
    .split(/[,;\n•]+/)
    .map((item) => item.trim())
    .find(Boolean);
  return first || "Wi-Fi";
}
