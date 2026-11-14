export type UserRole = 'customer' | 'admin' | 'CUSTOMER' | 'ROLE_CUSTOMER' | string;

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  createdAt: any;
  accountId?: number;
  username?: string;
  status?: string;
  lastLogin?: any;
}
