import apiClient, { ApiResponse } from './apiClient';
import { Room, RoomAmenity } from '../models/Room';
import { toApiDate } from '../utils/dateUtils';
import { getRoomExtras } from '../data/roomTypeExtras';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomTypeDto {
  roomTypeId: number;
  typeName: string;
  capacity: number;
  basePrice: number;
  amenities: string; // comma-separated string
  description: string;
}

export interface AvailableRoomDto {
  roomId: number;
  roomNumber: string;
  floor: number;
  status: string;
  pricePerNight: number;
  totalRoomCharge: number;
  estimatedDeposit: number;
  roomType: {
    roomTypeId: number;
    typeName: string;
    capacity: number;
    basePrice: number;
    amenities: string;
    description: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseAmenities = (raw: string): RoomAmenity[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name, i) => ({ id: `a${i}`, name, icon: 'checkmark-circle-outline' }));

/** Map RoomTypeDto → Room (used in RoomsScreen list) */
export const roomTypeToRoom = (item: RoomTypeDto): Room => {
  const extras = getRoomExtras(item.roomTypeId, item.typeName);
  return {
    id: item.roomTypeId.toString(),
    type: 'standard_double',
    name: item.typeName,
    description: item.description,
    pricePerNight: item.basePrice,
    maxGuests: item.capacity,
    area: parseInt(extras.area) || 30,
    bedType: extras.bedType,
    totalRooms: 1,
    amenities: parseAmenities(item.amenities),
    images: extras.images,
    isAvailable: true,
  };
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const roomService = {
  /** GET /api/public/rooms/room-types */
  getRoomTypes: async (): Promise<RoomTypeDto[]> => {
    const url = '/api/public/rooms/room-types';
    console.log('[roomService] getRoomTypes →', url);
    const response = await apiClient.get<ApiResponse<RoomTypeDto[]>>(url);
    console.log('[roomService] getRoomTypes ←', response.data);
    return response.data.data;
  },

  /**
   * POST /api/public/rooms/available
   * Body: { checkInDate, checkOutDate, guestCount, roomTypeId? } (YYYY-MM-DD local time)
   * Returns raw AvailableRoomDto array — callers filter by roomTypeId themselves.
   */
  getAvailableRooms: async (
    checkInDate: string,  // YYYY-MM-DD (local)
    checkOutDate: string, // YYYY-MM-DD (local)
    guestCount: number,
    roomTypeId?: number
  ): Promise<AvailableRoomDto[]> => {
    const payload: Record<string, any> = { checkInDate, checkOutDate, guestCount };
    if (roomTypeId !== undefined) payload.roomTypeId = roomTypeId;

    const url = '/api/public/rooms/available';
    console.log('[roomService] getAvailableRooms request payload:', url, payload);
    try {
      const response = await apiClient.post<ApiResponse<AvailableRoomDto[]>>(url, payload);
      console.log('[roomService] getAvailableRooms raw response:', response.data);
      return response.data?.data ?? [];
    } catch (error: any) {
      console.error('[roomService] getAvailableRooms error:', error?.response?.data ?? error.message);
      throw error;
    }
  },

  /** Fetch room types and map to Room[] for the listing screen */
  getRooms: async (): Promise<Room[]> => {
    const types = await roomService.getRoomTypes();
    return types.map(roomTypeToRoom);
  },
};
