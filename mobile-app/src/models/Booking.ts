import { SelectedService } from './Service';

export type BookingStatus =
  | 'PENDING_DEPOSIT'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface GuestInfo {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone: string;
  nationality?: string;
  idNumber?: string;
  idType?: string;
}

export interface QRInfo {
  qrDataUrl?: string;
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  transferContent: string;
  expiredAt?: string;
}

export interface Booking {
  id: string; // Or bookingId
  bookingCode?: string;
  roomId: string;
  roomName: string;
  roomType: string;
  userId: string;
  guestInfo: GuestInfo;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  guests: number;
  pricePerNight: number;
  totalPrice: number; 
  status: BookingStatus;
  specialRequests?: string;
  services?: SelectedService[];
  invoiceId?: string;
  depositRequired?: number;
  depositPaid?: number;
  qrInfo?: QRInfo;
  createdAt: Date;
  updatedAt: Date;
  voucherCode?: string;
}
