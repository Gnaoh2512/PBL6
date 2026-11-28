import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { User } from '../models/User';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setSession: (user: User, token: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

// JWTs use Android/iOS Keychain/Keystore. On web keep the session in memory;
// browser storage is not a secure place for bearer credentials.
const webSession = new Map<string, string>();
const authStorage = {
  getItem: async (name: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(name);
      return webSession.get(name) ?? null;
    }
    const secureValue = await SecureStore.getItemAsync(name);
    if (secureValue) return secureValue;
    const legacyValue = await AsyncStorage.getItem(name);
    if (legacyValue) {
      await SecureStore.setItemAsync(name, legacyValue);
      await AsyncStorage.removeItem(name);
    }
    return legacyValue;
  },
  setItem: async (name: string, value: string) => {
    if (Platform.OS === 'web') webSession.set(name, value);
    else await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    if (Platform.OS === 'web') webSession.delete(name);
    else await SecureStore.deleteItemAsync(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      setUser: (user) =>
        set({ user, isAuthenticated: !!user, error: null }),

      setToken: (token) => set({ token }),

      setSession: (user, token) => set({ user, token, isAuthenticated: true, error: null }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error, isLoading: false }),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false, error: null }),
    }),
    {
      name: 'auth-storage',           // migrated from AsyncStorage to secure device storage
      storage: createJSONStorage(() => authStorage),
      partialize: (state) => ({       // chỉ persist những gì cần thiết
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
