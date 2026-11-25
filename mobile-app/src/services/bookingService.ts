import apiClient, { ApiResponse } from './apiClient';
import {
  Booking,
  BookingStatus,
  GuestInfo,
  QRInfo,
  ServiceUsageItem,
  BookingServiceUsed,
  BookingServiceRequest,
} from '../models/Booking';
import { serviceService } from './serviceService';
import { SelectedService } from '../models/Service';
import { toApiDate } from '../utils/dateUtils';

export const bookingService = {
  // ────── PUBLIC APIs ──────

  createBooking: async (params: {
    userId?: string;
    roomId: string;
    roomName: string;
    roomType: string;
    checkInDate: Date;
    checkOutDate: Date;
    nights: number;
    guests: number;
    pricePerNight: number;
    totalPrice: number;
    guestInfo: GuestInfo;
    specialRequests?: string;
    services?: SelectedService[];
    voucherCode?: string;
  }): Promise<Booking> => {
    const payload = {
      roomId: parseInt(params.roomId) || 1,
      checkInDate: toApiDate(params.checkInDate),
      checkOutDate: toApiDate(params.checkOutDate),
      guestCount: params.guests,
      fullName:
        params.guestInfo.fullName ||
        `${params.guestInfo.lastName || ''} ${params.guestInfo.firstName || ''}`.trim(),
      phone: params.guestInfo.phone,
      email: params.guestInfo.email?.trim() || undefined,
      idNumber: params.guestInfo.idNumber?.trim() || undefined,
      idType: params.guestInfo.idType || 'CCCD',
      nationality: params.guestInfo.nationality || 'Vietnam',
      voucherCode: params.voucherCode || undefined,
      note: params.specialRequests || '',
    };

    console.log('[bookingService] createBooking request payload:', payload);
    const response = await apiClient.post<ApiResponse<any>>('/api/public/bookings', payload);
    console.log('[bookingService] createBooking raw response:', response.data);
    const data = response.data?.data || {};

    let rawStatus = (data.status ?? data.bookingStatus ?? 'PENDING_DEPOSIT').toString().toUpperCase();
    if (rawStatus === 'CANCELLED') rawStatus = 'CANCELED';

    return {
      id: data.bookingId?.toString() || data.bookingCode,
      bookingCode: data.bookingCode,
      roomId: params.roomId,
      roomName: params.roomName,
      roomType: params.roomType,
      userId: params.userId || '',
      guestInfo: params.guestInfo,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      nights: params.nights,
      guests: params.guests,
      pricePerNight: params.pricePerNight,
      totalPrice: data.totalRoomCharge || params.totalPrice,
      status: rawStatus as BookingStatus,
      depositRequired: data.depositRequired,
      depositPaid: data.depositPaid,
      qrInfo: data.qrInfo as QRInfo,
      specialRequests: params.specialRequests,
      services: params.services,
      voucherCode: params.voucherCode,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  getPaymentStatus: async (bookingCode: string): Promise<{
    bookingCode: string;
    bookingStatus: string;
    depositAmount: number;
    paidAt: string;
    message: string;
    [key: string]: any;
  }> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/api/public/bookings/${bookingCode}/payment-status`
    );
    console.log('[bookingService] getPaymentStatus raw response:', response.data);
    return response.data?.data;
  },

  simulateDeposit: async (bookingCode: string): Promise<any> => {
    const response = await apiClient.post(`/api/public/bookings/${bookingCode}/simulate-deposit`);
    console.log('[bookingService] simulateDeposit raw response:', response.data);
    return response.data;
  },

  lookupByPhone: async (phone: string): Promise<Booking[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>(
      '/api/public/history/lookup',
      { params: { phone } }
    );
    console.log('[bookingService] lookupByPhone raw response:', response.data);
    return (response.data?.data || []).map(mapApiToBooking);
  },

  lookupByCode: async (bookingCode: string): Promise<Booking> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/api/public/history/lookup/${bookingCode}`
    );
    console.log('[bookingService] lookupByCode raw response:', response.data);
    return mapApiToBooking(response.data?.data);
  },

  getBookingByCode: async (bookingCode: string): Promise<Booking> => {
    try {
      const response = await apiClient.get<ApiResponse<any>>(`/api/public/history/lookup/${bookingCode}`);
      console.log('[bookingService] getBookingByCode (lookup) raw response:', response.data);
      return mapApiToBooking(response.data?.data);
    } catch (err) {
      console.log('[bookingService] getBookingByCode error:', err);
      return {} as Booking;
    }
  },

  // ────── CUSTOMER APIs (cần token) ──────

  getMyBookings: async (): Promise<Booking[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>(
      '/api/customer/bookings/history'
    );
    console.log('[bookingService] getMyBookings raw response:', response.data);
    return (response.data?.data || []).map(mapApiToBooking);
  },

  getBookingHistory: async (): Promise<Booking[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>(
      '/api/customer/bookings/history'
    );
    console.log('[bookingService] getBookingHistory raw response:', response.data);
    return (response.data?.data || []).map(mapApiToBooking);
  },

  getBookingDetail: async (bookingCode: string): Promise<Booking> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/api/customer/bookings/history/${bookingCode}`
    );
    console.log('[bookingService] getBookingDetail raw response:', response.data);
    return mapApiToBooking(response.data?.data);
  },

  cancelBooking: async (
    bookingCode: string,
    params?: { reason?: string; refundOption?: string }
  ): Promise<ApiResponse<any>> => {
    const payload = {
      reason: params?.reason?.trim() || undefined,
      refundOption: params?.refundOption || 'CASH_REFUND',
    };
    console.log('[bookingService] cancelBooking request:', { bookingCode, payload });
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/customer/bookings/${bookingCode}/cancel`,
      payload
    );
    console.log('[bookingService] cancelBooking raw response:', response.data);
    return response.data;
  },

  getBookingServicesUsed: async (bookingCode: string): Promise<ServiceUsageItem[]> => {
    try {
      const response = await apiClient.get<ApiResponse<any>>(
        `/api/customer/bookings/history/${bookingCode}`
      );
      console.log('[bookingService] getBookingServicesUsed raw response:', response.data);
      const data = response.data?.data;
      const list = data?.servicesUsed || data?.serviceUsages || data?.services || [];
      return Array.isArray(list) ? list.map((s: any) => ({
        serviceUsageId: s.serviceUsageId || s.id,
        serviceId: s.serviceId,
        serviceName: s.serviceName || s.service?.serviceName || 'Dịch vụ',
        quantity: s.quantity || 1,
        unitPrice: s.unitPrice,
        totalPrice: s.totalPrice || s.totalAmount,
        note: s.note,
        status: s.status,
      })) : [];
    } catch (err) {
      console.log('[bookingService] getBookingServicesUsed error:', err);
      return [];
    }
  },
};

// ────── Helper mapper ──────
function mapApiToBooking(data: any): Booking {
  if (!data) return {} as Booking;

  const nights =
    data.nights ||
    (data.checkInDate && data.checkOutDate
      ? Math.max(
          1,
          Math.round(
            (new Date(data.checkOutDate).getTime() - new Date(data.checkInDate).getTime()) /
              86400000
          )
        )
      : 1);

  // Chuẩn hóa status từ data.status ?? data.bookingStatus
  let rawStatus = (data.status ?? data.bookingStatus ?? 'PENDING_DEPOSIT').toString().toUpperCase();
  if (rawStatus === 'CANCELLED') rawStatus = 'CANCELED';

  const guestName = data.customerName || data.fullName || '';
  const nameParts = guestName.trim().split(' ');

  return {
    id: data.bookingId?.toString() || data.bookingCode || Math.random().toString(),
    bookingCode: data.bookingCode || data.bookingId?.toString(),
    roomId: data.roomId?.toString() || (data.roomNumber ? data.roomNumber.toString() : '1'),
    roomName: data.roomTypeName || data.roomType?.typeName || data.roomName || 'Phòng Khách Sạn',
    roomType: data.roomType?.typeName || data.roomType || 'Standard',
    userId: data.customerId?.toString() || '',
    guestInfo: {
      fullName: guestName,
      firstName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : guestName,
      lastName: nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '',
      email: data.customerEmail || data.email || '',
      phone: data.customerPhone || data.phone || '',
      nationality: data.nationality || 'Vietnam',
      idNumber: data.idNumber,
      idType: data.idType,
    },
    checkInDate: data.checkInDate ? new Date(data.checkInDate) : new Date(),
    checkOutDate: data.checkOutDate ? new Date(data.checkOutDate) : new Date(),
    nights,
    guests: data.guestCount || data.guests || 2,
    pricePerNight: data.priceAppliedPerNight || data.pricePerNight || 0,
    totalPrice: data.totalAmount || data.totalRoomCharge || 0,
    status: rawStatus as BookingStatus,
    depositRequired: data.depositRequired,
    depositPaid: data.depositPaid,
    qrInfo: data.qrInfo,
    paymentTransactions: data.paymentTransactions || [],
    servicesUsed: Array.isArray(data.servicesUsed)
      ? data.servicesUsed.map((s: any): BookingServiceUsed => {
          const isLoyalty = Boolean(
            s.loyaltyBenefit === true ||
            s.isLoyaltyBenefit === true ||
            (typeof s.benefitName === 'string' && s.benefitName.trim().length > 0)
          );
          return {
            serviceUsageId: s.serviceUsageId ?? s.id,
            serviceId: s.serviceId,
            serviceName: s.serviceName || s.service?.serviceName || 'Dịch vụ',
            quantity: s.quantity ?? 1,
            unit: s.unit,
            unitPrice: s.unitPrice,
            totalAmount: s.totalAmount ?? s.totalPrice,
            totalPrice: s.totalAmount ?? s.totalPrice,
            orderTime: s.orderTime ?? s.createdAt,
            note: s.note,
            status: s.status,
            loyaltyBenefit: isLoyalty,
            isLoyaltyBenefit: isLoyalty,
            benefitName: s.benefitName,
          };
        })
      : [],
    serviceRequests: Array.isArray(data.serviceRequests)
      ? data.serviceRequests.map((r: any): BookingServiceRequest => ({
          serviceRequestId: r.serviceRequestId ?? r.id,
          serviceName: r.serviceName || 'Yêu cầu dịch vụ',
          roomNumber: r.roomNumber,
          quantity: r.quantity ?? 1,
          feeAmount: r.feeAmount ?? r.amount,
          status: (r.status || 'PENDING').toUpperCase(),
          assignedToStaff: r.assignedToStaff,
          note: r.note,
          isLoyaltyBenefit:
            r.isLoyaltyBenefit ??
            r.loyaltyBenefit ??
            (typeof r.note === 'string' && r.note.trim().startsWith('[LOYALTY BENEFIT]')),
          loyaltyBenefit: r.loyaltyBenefit ?? r.isLoyaltyBenefit,
          requestedAt: r.requestedAt ?? r.createdAt,
          completedAt: r.completedAt,
        }))
      : [],
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  };
}
