export interface Amenity {
  id: string;
  name: string;
  icon: string;
}

export interface Hotel {
  id: string;
  name: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  latitude: number;
  longitude: number;
  checkInTime: string;
  checkOutTime: string;
  amenities: Amenity[];
  rating: number;
  reviewCount: number;
}
