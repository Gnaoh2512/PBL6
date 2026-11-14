import { create } from 'zustand';
import { Booking } from '../models/Booking';
import { Room } from '../models/Room';
import { bookingService } from '../services/bookingService';

interface BookingDraft {
  room: Room | null;
  checkIn: Date | null;
  checkOut: Date | null;
  guests: number;
  specialRequests: string;
}

interface BookingState {
  // Draft (in-progress booking)
  draft: BookingDraft;
  // User's booking history
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;

  setDraftRoom: (room: Room) => void;
  setDraftDates: (checkIn: Date, checkOut: Date) => void;
  setDraftGuests: (guests: number) => void;
  setDraftRequests: (requests: string) => void;
  clearDraft: () => void;

  setBookings: (bookings: Booking[]) => void;
  addBooking: (booking: Booking) => void;
  createBooking: (params: Parameters<typeof import('../services/bookingService').bookingService.createBooking>[0]) => Promise<Booking>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const initialDraft: BookingDraft = {
  room: null,
  checkIn: null,
  checkOut: null,
  guests: 1,
  specialRequests: '',
};

export const useBookingStore = create<BookingState>((set) => ({
  draft: initialDraft,
  bookings: [],
  isLoading: false,
  error: null,

  setDraftRoom: (room) =>
    set((state) => ({ draft: { ...state.draft, room } })),

  setDraftDates: (checkIn, checkOut) =>
    set((state) => ({ draft: { ...state.draft, checkIn, checkOut } })),

  setDraftGuests: (guests) =>
    set((state) => ({ draft: { ...state.draft, guests } })),

  setDraftRequests: (specialRequests) =>
    set((state) => ({ draft: { ...state.draft, specialRequests } })),

  clearDraft: () => set({ draft: initialDraft }),

  setBookings: (bookings) => set({ bookings }),

  addBooking: (booking) =>
    set((state) => ({ bookings: [booking, ...state.bookings] })),

  createBooking: async (params) => {
    const booking = await bookingService.createBooking(params);
    set((state) => ({ bookings: [booking, ...state.bookings] }));
    return booking;
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
