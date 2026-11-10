import { create } from 'zustand';
import { Hotel } from '../models/Hotel';
import { Room } from '../models/Room';
import { MOCK_HOTEL } from '../data/mockData';
import { roomService } from '../services/roomService';

interface HotelState {
  hotel: Hotel | null;
  rooms: Room[];
  isLoading: boolean;
  error: string | null;

  loadHotel: () => void;
  loadRooms: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useHotelStore = create<HotelState>((set) => ({
  hotel: null,
  rooms: [],
  isLoading: false,
  error: null,

  loadHotel: () => {
    set({ isLoading: true });
    setTimeout(() => {
      set({ hotel: MOCK_HOTEL, isLoading: false });
    }, 300);
  },

  loadRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const rooms = await roomService.getRooms();
      set({ rooms, isLoading: false });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Không thể tải danh sách phòng';
      set({ error: msg, isLoading: false });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
