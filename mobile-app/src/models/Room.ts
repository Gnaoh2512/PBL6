export type RoomType =
  | 'standard_single'
  | 'standard_double'
  | 'deluxe_double'
  | 'family'
  | 'suite';

export interface RoomAmenity {
  id: string;
  name: string;
  icon: string;
}

export interface Room {
  id: string;
  type: RoomType;
  name: string;
  description: string;
  pricePerNight: number;
  maxGuests: number;
  area: number;
  bedType: string;
  totalRooms: number;
  amenities: RoomAmenity[];
  images: string[];
  isAvailable: boolean;
}
