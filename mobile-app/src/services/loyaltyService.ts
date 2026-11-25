import apiClient, { ApiResponse } from './apiClient';
import { LoyaltyProfile, LoyaltyTransaction, LoyaltyBenefit, RedeemBenefitRequest } from '../models/Loyalty';

export const loyaltyService = {
  getProfile: async (): Promise<LoyaltyProfile> => {
    const response = await apiClient.get<ApiResponse<LoyaltyProfile>>('/api/customer/loyalty/profile');
    console.log('[loyaltyService] getProfile raw response:', response.data);
    const data = response.data?.data || response.data;
    return data;
  },

  getTransactions: async (): Promise<LoyaltyTransaction[]> => {
    const response = await apiClient.get<ApiResponse<LoyaltyTransaction[]>>('/api/customer/loyalty/transactions');
    console.log('[loyaltyService] getTransactions raw response:', response.data);
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list : [];
  },

  getBenefits: async (): Promise<LoyaltyBenefit[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/api/customer/loyalty/benefits');
    console.log('[loyaltyService] getBenefits raw response:', response.data);
    const rawList = response.data?.data || response.data;
    const list = Array.isArray(rawList) ? rawList : [];
    return list.map((item: any): LoyaltyBenefit => ({
      tierBenefitId: Number(item.tierBenefitId ?? item.id ?? 0),
      id: item.id ?? item.tierBenefitId,
      tierId: item.tierId,
      tierCode: item.tierCode,
      tierLevel: item.tierLevel != null ? Number(item.tierLevel) : undefined,
      benefitName: item.benefitName || 'Đặc quyền',
      benefitType: item.benefitType || '',
      discountPercent: item.discountPercent ?? null,
      quota: item.quota ?? null,
      remainingQuota: item.remainingQuota ?? null,
      periodType: item.periodType ?? null,
      description: item.description,
      tierName: item.tierName,
      isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
      serviceId: item.serviceId ?? null,
      serviceName: item.serviceName ?? null,
      roomTypeId: item.roomTypeId ?? null,
      roomTypeName: item.roomTypeName ?? null,
    }));
  },

  getLoyaltyBenefits: async (): Promise<LoyaltyBenefit[]> => {
    return loyaltyService.getBenefits();
  },

  redeemBenefit: async (params: RedeemBenefitRequest): Promise<any> => {
    const payload: {
      tierBenefitId: number;
      bookingCode: string;
      idempotencyKey?: string;
      note?: string;
    } = {
      tierBenefitId: Number(params.tierBenefitId),
      bookingCode: String(params.bookingCode),
    };
    if (params.idempotencyKey) payload.idempotencyKey = params.idempotencyKey;
    if (params.note) payload.note = params.note;

    console.log('[loyaltyService] redeemBenefit request payload:', payload);
    const response = await apiClient.post<ApiResponse<any>>('/api/customer/loyalty/redeem', payload);
    console.log('[loyaltyService] redeemBenefit raw response:', response.data);
    return response.data;
  },
};
