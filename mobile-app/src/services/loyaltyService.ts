import apiClient, { ApiResponse } from './apiClient';
import { LoyaltyProfile, LoyaltyTransaction, LoyaltyBenefit } from '../models/Loyalty';

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
    const response = await apiClient.get<ApiResponse<LoyaltyBenefit[]>>('/api/customer/loyalty/benefits');
    console.log('[loyaltyService] getBenefits raw response:', response.data);
    const list = response.data?.data || response.data;
    return Array.isArray(list) ? list : [];
  },
};
