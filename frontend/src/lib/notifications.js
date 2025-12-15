// src/lib/notifications.js
import { toast } from 'react-hot-toast';

const defaultOptions = {
  duration: 4000,
};

// ✅ رسائل النجاح
export const notifySuccess = (message) =>
  toast.success(message, {
    ...defaultOptions,
  });

// ⚠️ رسائل التحذير
export const notifyWarning = (message) =>
  toast(message, {
    ...defaultOptions,
    icon: '⚠️',
  });

// ℹ️ رسائل المعلومات
export const notifyInfo = (message) =>
  toast(message, {
    ...defaultOptions,
  });

// ❌ رسائل الخطأ
export const notifyError = (message) =>
  toast.error(message, {
    ...defaultOptions,
  });

// 🧠 هلبـر عشان نطلع رسالة محترمة من error جايلنا من Axios
export const handleApiError = (
  error,
  fallbackMessage = 'حدث خطأ غير متوقع، برجاء المحاولة مرة أخرى.'
) => {
  let message = fallbackMessage;

  if (error?.response?.data) {
    const data = error.response.data;

    if (typeof data === 'string') {
      message = data;
    } else if (data.detail) {
      message = data.detail;
    } else if (data.message) {
      message = data.message;
    } else if (Array.isArray(data) && data[0]) {
      message = data[0];
    }
  } else if (error?.message) {
    message = error.message;
  }

  notifyError(message);
};
