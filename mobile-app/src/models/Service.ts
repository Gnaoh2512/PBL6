export type ServiceCategory = 'spa' | 'laundry' | 'transport' | 'dining' | 'other';

export interface Service {
  serviceId: number;
  categoryName: string;
  serviceName: string;
  unitPrice: number;
  unit: string; // VD: 'Chai', 'Suất', 'Kg', 'Lần'
  isActive: boolean;
  // Aliases for compatibility
  id?: string;
  name?: string;
  price?: number;
  description?: string;
  icon?: string;
  category?: string;
}

export interface SelectedService extends Service {
  quantity: number;
}
