// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ جلب بيانات المستخدم الحالي
  const checkAuth = useCallback(async () => {
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('access') ||
      localStorage.getItem('token');

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/me/');
      setUser(res.data);
    } catch {
      console.warn('Token invalid/expired -> logout auto');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Login (fallback: /auth/login/ OR /auth/token/)
  const login = async (email, password) => {
    try {
      let res;
      try {
        res = await api.post('/auth/login/', { email, password });
      } catch {
        res = await api.post('/auth/token/', { email, password });
      }

      const data = res.data || {};
      const access = data.access || data.token || data.access_token;
      const refresh = data.refresh || data.refresh_token;

      if (access) localStorage.setItem('access_token', access);
      if (refresh) localStorage.setItem('refresh_token', refresh);

      // بعض السيرفرات ممكن ترجع user
      if (data.user) setUser(data.user);

      await checkAuth();
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);

      const msg =
        error.response?.data?.detail ||
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.email?.[0] ||
        error.response?.data?.password?.[0] ||
        'فشل تسجيل الدخول، تأكد من الإيميل وكلمة المرور';

      return { success: false, error: msg };
    }
  };

  // ✅ Logout
  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('token');
    localStorage.removeItem('selected_store_id');
    localStorage.removeItem('selected_store_name');
    setUser(null);
    window.location.href = '/login';
  }, []);
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        isAuthenticated: !!user,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
