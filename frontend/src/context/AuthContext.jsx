// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useCallback } from 'react';
import api, {
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  refreshAccessToken,
  setAccessToken,
  setRefreshToken,
} from '../lib/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearAuthStorage = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('token');
  }, []);

  // ✅ جلب بيانات المستخدم الحالي
  const checkAuth = useCallback(async () => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();

    if (!accessToken && !refreshToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      let tokenToUse = accessToken;

      // 🔄 حاول تحديث التوكن لو منتهي أو مفقود
      if ((!tokenToUse || isTokenExpired(tokenToUse)) && refreshToken) {
        const refreshed = await refreshAccessToken(refreshToken);
        tokenToUse = refreshed?.access || null;
      }

      if (!tokenToUse) {
        clearAuthStorage();
        setUser(null);
        return;
      }

      const res = await api.get('/auth/me/', {
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      setUser(res.data);
    } catch {
      console.warn('Token invalid/expired -> logout auto');
      clearAuthStorage();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [clearAuthStorage]);

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

      if (access) setAccessToken(access);
      if (refresh) setRefreshToken(refresh);

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
    clearAuthStorage();
    localStorage.removeItem('selected_store_id');
    localStorage.removeItem('selected_store_name');
    setUser(null);
    window.location.href = '/login';
  }, [clearAuthStorage]);
    
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
