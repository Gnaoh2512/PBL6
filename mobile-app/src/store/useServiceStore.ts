import { create } from 'zustand';
import { SelectedService, Service } from '../models/Service';

interface ServiceStore {
  selectedServices: SelectedService[];
  addService: (service: Service) => void;
  removeService: (serviceId: string) => void;
  updateQuantity: (serviceId: string, quantity: number) => void;
  clearServices: () => void;
}

export const useServiceStore = create<ServiceStore>((set) => ({
  selectedServices: [],
  addService: (service) =>
    set((state) => {
      const exists = state.selectedServices.find((s) => s.id === service.id);
      if (exists) {
        return {
          selectedServices: state.selectedServices.map((s) =>
            s.id === service.id ? { ...s, quantity: s.quantity + 1 } : s
          ),
        };
      }
      return {
        selectedServices: [...state.selectedServices, { ...service, quantity: 1 }],
      };
    }),
  removeService: (serviceId) =>
    set((state) => ({
      selectedServices: state.selectedServices.filter((s) => s.id !== serviceId),
    })),
  updateQuantity: (serviceId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return {
          selectedServices: state.selectedServices.filter((s) => s.id !== serviceId),
        };
      }
      return {
        selectedServices: state.selectedServices.map((s) =>
          s.id === serviceId ? { ...s, quantity } : s
        ),
      };
    }),
  clearServices: () => set({ selectedServices: [] }),
}));
