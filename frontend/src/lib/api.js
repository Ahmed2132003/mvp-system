// src/lib/api.js
import axios from 'axios';
import { handleApiError, notifyError } from './notifications';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// -----------------------------
// Token Helpers (Compatibility)
// -----------------------------
export const getAccessToken = () =>
  localStorage.getItem('access_token') ||
  localStorage.getItem('access') ||
  localStorage.getItem('token') ||
  null;

export const getRefreshToken = () =>
  localStorage.getItem('refresh_token') ||
  localStorage.getItem('refresh') ||
  null;

export const setAccessToken = (token) => {
  if (!token) return;
  localStorage.setItem('access_token', token);
  localStorage.setItem('access', token); // دعم قديم
};

export const setRefreshToken = (token) => {
  if (!token) return;
  localStorage.setItem('refresh_token', token);
  localStorage.setItem('refresh', token); // دعم قديم
};

// -----------------------------
// Token expiry helpers
// -----------------------------
const decodeJwtPayload = (token) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('Unable to decode JWT payload', error);
    return null;
  }
};

export const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  const expiryMs = payload.exp * 1000;
  return Date.now() >= expiryMs;
};

export const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) return null;

  try {
    let res;

    try {
      res = await axios.post(`${BASE_URL}/auth/refresh/`, {
        refresh: refreshToken,
      });
    } catch {
      res = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
        refresh: refreshToken,
      });
    }

    const { access, refresh } = res.data || {};

    if (access) {
      setAccessToken(access);
      api.defaults.headers.common.Authorization = `Bearer ${access}`;
    }

    if (refresh) {
      setRefreshToken(refresh);
    }

    return { access, refresh };
  } catch (error) {
    console.error('refreshAccessToken failed', error);
    throw error;
  }
};

// -----------------------------
// Request Interceptor
// -----------------------------
api.interceptors.request.use(  
  (config) => {
    // ✅ Authorization
    const token = getAccessToken();
    if (token) {
      if (!config.headers) config.headers = {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ store_id injection (for branch/store switching)
    const storeId = localStorage.getItem('selected_store_id');
    if (storeId) {
      config.params = config.params || {};
      if (!config.params.store_id) {
        config.params.store_id = storeId;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// -----------------------------
// Response Interceptor + Refresh
// -----------------------------
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  failedQueue.length = 0;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      handleApiError(
        error,
        'تعذّر الاتصال بالسيرفر، تأكد من الاتصال بالإنترنت ثم حاول مرة أخرى.'
      );
      return Promise.reject(error);
    }

    if (error.response.status !== 401 || originalRequest._retry) {
      handleApiError(error);
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      notifyError('انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى.');
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        if (!originalRequest.headers) originalRequest.headers = {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      let res;
      try {
        res = await axios.post(`${BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });
      } catch {
        res = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });
      }

      const { access, refresh: newRefresh } = res.data || {};

      if (access) {
        setAccessToken(access);
        api.defaults.headers.common.Authorization = `Bearer ${access}`;
      }

      if (newRefresh) {
        setRefreshToken(newRefresh);
      }

      processQueue(null, access);

      if (!originalRequest.headers) originalRequest.headers = {};
      originalRequest.headers.Authorization = `Bearer ${access}`;

      return api(originalRequest);
    } catch (refreshError) {
      notifyError('انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى.');
      processQueue(refreshError, null);
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
