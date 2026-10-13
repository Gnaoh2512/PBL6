import { createContext, useContext, useState, useCallback } from 'react';
import { getAuthUser, getAuthToken, setAuthSession, clearAuthSession, hasRole as checkRole } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getAuthUser());
  const [token, setToken] = useState(() => getAuthToken());

  const login = useCallback((newToken, newUser) => {
    setAuthSession(newToken, newUser);
    setUser(newUser);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    setToken('');
  }, []);

  const hasRole = useCallback((roles) => {
    return checkRole(roles);
  }, []);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
