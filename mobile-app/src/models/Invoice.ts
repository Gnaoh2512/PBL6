export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'hotel' | 'transfer' | 'ewallet';

export interface Invoice {
  id: string;
  bookingId: string;
  roomCharge: number;
  serviceCharges: number;
  tax: number;
  discount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  createdAt: Date;
}
