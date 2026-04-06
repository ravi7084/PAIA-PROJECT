/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Auth Context                        ║
 * ║   Global auth state for the entire app       ║
 * ╚══════════════════════════════════════════════╝
 */

import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios.config';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        setUser(res.data.data.user);
        setIsAuthenticated(true);
      } catch {
        localStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  const login = useCallback((userData, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {}

    localStorage.clear();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
  }, []);

  const getInitials = (name = '') =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        updateUser,
        getInitials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};