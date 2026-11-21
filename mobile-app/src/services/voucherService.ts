import apiClient, { ApiResponse } from './apiClient';

export interface VoucherResult {
  voucherCode: string;
  code?: string;
  voucherName: string;
  discountAmount: number;
  finalAmount: number;
  message: string;
}

export const voucherService = {
  applyVoucher: async (code: string, orderAmount: number): Promise<VoucherResult> => {
    const cleanCode = (code || '').trim().toUpperCase();
    const payload = {
      code: cleanCode,
      voucherCode: cleanCode,
      orderAmount,
    };
    const response = await apiClient.post<ApiResponse<any>>('/api/public/vouchers/apply', payload);
    console.log('[voucherService] applyVoucher raw response:', response.data);
    const data = response.data?.data || response.data || {};
    return {
      voucherCode: data.voucherCode || data.code || cleanCode,
      code: data.code || data.voucherCode || cleanCode,
      voucherName: data.voucherName || data.name || data.voucherCode || cleanCode,
      discountAmount: Number(data.discountAmount ?? data.discount ?? 0),
      finalAmount: Number(data.finalAmount ?? (orderAmount - (data.discountAmount || 0))),
      message: response.data?.message || data.message || 'Áp dụng voucher thành công!',
    };
  }
};
