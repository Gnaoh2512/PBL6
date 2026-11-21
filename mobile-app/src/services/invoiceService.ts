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
    let data: any = null;
    try {
      const historyRes = await apiClient.get<ApiResponse<any>>(
        `/api/customer/bookings/history/${bookingCode}`
      );
      console.log('[invoiceService] history detail raw response:', historyRes.data);
      if (historyRes.data?.data) {
        data = historyRes.data.data;
      }
    } catch (e) {
      console.log('[invoiceService] history detail failed, trying folio endpoint...', e);
    }

    if (!data) {
      const response = await apiClient.get<ApiResponse<any>>(`/api/public/bookings/${bookingCode}/folio`);
      console.log('[invoiceService] getFolio raw response:', response.data);
      data = response.data?.data || {};
    }

    const rawServices = data.servicesUsed || data.services || [];
    const services: FolioServiceItem[] = rawServices.map((s: any) => ({
      usageId: s.usageId ?? s.serviceUsageId,
      serviceId: s.serviceId,
      serviceName: s.serviceName || s.name || 'Dịch vụ',
      categoryName: s.categoryName || '',
      quantity: s.quantity || 1,
      unit: s.unit || '',
      unitPriceApplied: s.unitPriceApplied ?? s.unitPrice ?? 0,
      discountAmount: s.discountAmount ?? 0,
      totalPrice: s.totalPrice ?? s.totalAmount ?? s.subtotal ?? 0,
      status: s.status || '',
      usedAt: s.usedAt ?? s.orderTime,
      // Compatibility aliases
      name: s.serviceName || s.name,
      subtotal: s.totalPrice ?? s.totalAmount ?? s.subtotal,
    }));

    const roomCharge = data.roomCharge ?? data.totalRoomCharge ?? 0;
    const serviceCharge = data.serviceCharge ?? data.totalServiceCharge ?? data.serviceCharges ?? 0;
    const subtotal = data.subtotal ?? (roomCharge + serviceCharge);
    const taxRate = data.taxRate ?? 10;
    const taxAmount = data.taxAmount ?? Math.round(subtotal * (taxRate / 100));
    const discountAmount = data.discountAmount ?? 0;
    const totalAmount = data.totalAmount ?? (subtotal + taxAmount - discountAmount);
    const depositPaid = data.depositPaid ?? 0;
    const remainingBalance = data.remainingBalance ?? Math.max(0, totalAmount - depositPaid);

    return {
      bookingCode: data.bookingCode || bookingCode,
      bookingStatus: (data.bookingStatus || data.status || 'PENDING_DEPOSIT').toString().toUpperCase(),
      customerName: data.customerName || data.fullName || '',
      customerPhone: data.customerPhone || data.phone || '',
      roomNumber: data.roomNumber ? String(data.roomNumber) : '',
      roomTypeName: data.roomTypeName || data.roomType?.typeName || '',
      checkInDate: data.checkInDate || '',
      checkOutDate: data.checkOutDate || '',
      nights: data.nights || 1,
      pricePerNight: data.priceAppliedPerNight ?? data.pricePerNight ?? 0,
      roomCharge,
      serviceCharge,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount,
      totalAmount,
      depositPaid,
      remainingBalance,
      isFullySettled: Boolean(data.isFullySettled ?? data.fullySettled ?? (remainingBalance === 0)),
      services,
      settlementQr: data.settlementQr,
    };
  },
};
