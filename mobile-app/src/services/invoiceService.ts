import apiClient, { ApiResponse } from './apiClient';

export interface FolioServiceItem {
  usageId?: number;
  serviceId?: number;
  serviceName: string;
  categoryName: string;
  quantity: number;
  unit: string;
  unitPriceApplied: number;
  discountAmount: number;
  totalPrice: number;
  status: string;
  usedAt?: string;
  // Aliases for compatibility
  name?: string;
  subtotal?: number;
}

export interface LiveFolio {
  bookingCode: string;
  bookingStatus: string;
  customerName: string;
  customerPhone: string;
  roomNumber: string;
  roomTypeName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  pricePerNight: number;
  roomCharge: number;
  serviceCharge: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  depositPaid: number;
  remainingBalance: number;
  isFullySettled: boolean;
  services: FolioServiceItem[];
  settlementQr?: any;
}

export const invoiceService = {
  getFolio: async (bookingCode: string): Promise<LiveFolio> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/public/bookings/${bookingCode}/folio`);
    console.log('[invoiceService] getFolio raw response:', response.data);
    const data = response.data?.data || {};

    const services: FolioServiceItem[] = (data.services || []).map((s: any) => ({
      usageId: s.usageId,
      serviceId: s.serviceId,
      serviceName: s.serviceName || s.name || 'Dịch vụ',
      categoryName: s.categoryName || '',
      quantity: s.quantity || 1,
      unit: s.unit || '',
      unitPriceApplied: s.unitPriceApplied ?? s.unitPrice ?? 0,
      discountAmount: s.discountAmount ?? 0,
      totalPrice: s.totalPrice ?? s.subtotal ?? 0,
      status: s.status || '',
      usedAt: s.usedAt,
      // Compatibility aliases
      name: s.serviceName || s.name,
      subtotal: s.totalPrice ?? s.subtotal,
    }));

    return {
      bookingCode: data.bookingCode || bookingCode,
      bookingStatus: data.bookingStatus || 'PENDING_DEPOSIT',
      customerName: data.customerName || '',
      customerPhone: data.customerPhone || '',
      roomNumber: data.roomNumber || '',
      roomTypeName: data.roomTypeName || '',
      checkInDate: data.checkInDate || '',
      checkOutDate: data.checkOutDate || '',
      nights: data.nights || 1,
      pricePerNight: data.pricePerNight || 0,
      roomCharge: data.roomCharge || 0,
      serviceCharge: data.serviceCharge ?? data.serviceCharges ?? 0,
      subtotal: data.subtotal || 0,
      taxRate: data.taxRate ?? 10,
      taxAmount: data.taxAmount || 0,
      discountAmount: data.discountAmount || 0,
      totalAmount: data.totalAmount || 0,
      depositPaid: data.depositPaid || 0,
      remainingBalance: data.remainingBalance ?? 0,
      isFullySettled: data.isFullySettled ?? data.fullySettled ?? false,
      services,
      settlementQr: data.settlementQr,
    };
  },
};
