import apiClient, { ApiResponse } from './apiClient';
import { User } from '../models/User';
import { useAuthStore } from '../store/useAuthStore';

export const authService = {
  login: async (username: string, password: string): Promise<User> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/auth/login', {
      username,
      password,
    });
    console.log('[authService] login raw response:', response.data);
    const data = response.data.data;
    
    // API actual format for login:
    // { accessToken, tokenType, expiresInMs, user: { accountId, username, fullName, email, phone, role, status, lastLogin, createdAt } }
    
    // Save token using accessToken instead of token
    useAuthStore.getState().setToken(data.accessToken);
    
    // Map response to our User model
    const userData = data.user;
    const user: User = {
      id: userData.accountId?.toString() || userData.username,
      accountId: userData.accountId,
      username: userData.username,
      email: userData.email || '',
      fullName: userData.fullName || '',
      phone: userData.phone || '',
      role: userData.role || 'customer',
      status: userData.status || 'ACTIVE',
      lastLogin: userData.lastLogin,
      createdAt: userData.createdAt,
    };
    return user;
  },

  register: async (
    username: string,
    password: string,
    fullName: string,
    email: string,
    phone: string,
  ): Promise<User> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/auth/register', {
      username,
      password,
      fullName,
      phone,
      email,
    });
    console.log('[authService] register raw response:', response.data);
    
    // API actual format for register/me:
    // { accountId, username, fullName, email, phone, role, status, createdAt }
    const data = response.data.data;
    const user: User = {
      id: data.accountId?.toString() || data.username || username,
      accountId: data.accountId,
      username: data.username || username,
      email: data.email || email,
      fullName: data.fullName || fullName,
      phone: data.phone || phone,
      role: data.role || 'customer',
      status: data.status || 'ACTIVE',
      createdAt: data.createdAt,
    };
    return user;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<any>>('/api/auth/me');
    console.log('[authService] getMe raw response:', response.data);
    const data = response.data?.data || response.data || {};
    const user: User = {
      id: data.accountId?.toString() || data.username || '',
      accountId: data.accountId,
      username: data.username,
      email: data.email || '',
      fullName: data.fullName || '',
      phone: data.phone || '',
      role: data.role || 'CUSTOMER',
      status: data.status || 'ACTIVE',
      lastLogin: data.lastLogin,
      createdAt: data.createdAt,
    };
    return user;
  },

  logout: async (): Promise<void> => {
    useAuthStore.getState().logout();
  },
};
