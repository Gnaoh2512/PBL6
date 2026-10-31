import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiCall, getAuthUser, getAuthToken, setAuthSession, clearAuthSession, hasRole as checkRole } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getAuthUser());
  const [token, setToken] = useState(() => getAuthToken());
  const [authReady, setAuthReady] = useState(() => !getAuthToken());

  useEffect(() => {
    if (!token) return undefined;

    let active = true;
    apiCall('/api/auth/me', { silentError: true })
      .then((response) => {
        if (!active) return;
        if (response?.success && response.data) {
          setUser(response.data);
          setAuthSession(token, response.data);
        }
        setAuthReady(true);
      })
      .catch((error) => {
        if (!active) return;
        if (error.message === 'Unauthorized') {
          clearAuthSession();
          setUser(null);
          setToken('');
        }
        setAuthReady(true);
      });

    return () => { active = false; };
  }, [token]);

  const login = useCallback((newToken, newUser) => {
    setAuthSession(newToken, newUser);
    setUser(newUser);
    setToken(newToken);
    setAuthReady(true);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    setToken('');
  }, []);

  const hasRole = useCallback((roles) => checkRole(roles, user), [user]);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, authReady, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
