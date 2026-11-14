import apiClient, { ApiResponse } from './apiClient';
import { Service } from '../models/Service';

export const serviceService = {
  getServices: async (): Promise<Service[]> => {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>('/api/public/services');
      console.log('[serviceService] getServices raw response:', response.data);
      const rawList = response.data?.data || [];
      return rawList
        .filter((item: any) => item.isActive !== false)
        .map((item: any): Service => ({
          serviceId: item.serviceId,
          categoryName: item.categoryName || 'Dịch vụ khác',
          serviceName: item.serviceName || 'Dịch vụ',
          unitPrice: item.unitPrice || 0,
          unit: item.unit || 'Lần',
          isActive: item.isActive ?? true,
          // Aliases for convenience
          id: item.serviceId?.toString(),
          name: item.serviceName,
          price: item.unitPrice,
        }));
    } catch (e) {
      console.error('[serviceService] Failed to fetch services from API:', e);
      return [];
    }
  },

  getServicesByCategory: async (categoryName: string): Promise<Service[]> => {
    const services = await serviceService.getServices();
    return services.filter((s) => s.categoryName === categoryName);
  },

  orderService: async (
    bookingCode: string,
    serviceId: number,
    quantity: number,
    note: string = ''
  ): Promise<any> => {
    const payload = {
      bookingCode,
      serviceId,
      quantity,
      note,
    };
    console.log('[serviceService] orderService request payload:', payload);
    const response = await apiClient.post<ApiResponse<any>>('/api/public/services/order', payload);
    console.log('[serviceService] orderService raw response:', response.data);
    return response.data;
  },
};
