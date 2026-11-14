// Extra static info per roomTypeId (images, area, bedType)
// Backend does not return these fields, so we map them locally.

interface RoomTypeExtras {
  images: string[];
  area: string;
  bedType: string;
}

const ROOM_TYPE_EXTRAS: Record<number, RoomTypeExtras> = {
  1: {
    images: [
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800',
    ],
    area: '22 m²',
    bedType: '1 giường đơn',
  },
  2: {
    images: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800',
    ],
    area: '35 m²',
    bedType: '1 giường đôi (King)',
  },
  3: {
    images: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800',
    ],
    area: '52 m²',
    bedType: '1 giường King + 2 giường đơn',
  },
};

const DEFAULT_EXTRAS: RoomTypeExtras = {
  images: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800'],
  area: '30 m²',
  bedType: 'Giường đôi',
};

export const getRoomTypeExtras = (roomTypeId: number): RoomTypeExtras =>
  ROOM_TYPE_EXTRAS[roomTypeId] ?? DEFAULT_EXTRAS;
