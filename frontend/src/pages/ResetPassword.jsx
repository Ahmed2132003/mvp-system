// src/pages/ResetPassword.jsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError, notifySuccess } from '../lib/notifications';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const token = new URLSearchParams(location.search).get('token');

  useEffect(() => {
    if (!token) {
      notifyError('الرابط غير صالح، برجاء طلب رابط جديد.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (password !== passwordConfirm) {
      notifyError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password/', {
        token,
        password,
        password_confirm: passwordConfirm,
      });

      notifySuccess('تم تحديث كلمة المرور، يمكنك تسجيل الدخول الآن.');
      navigate('/login?reset=success');
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'الرابط غير صالح أو منتهي، اطلب رابط جديد.';
      notifyError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-primary/10 px-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-border p-8">
        <h1 className="text-2xl font-bold text-center text-text-primary mb-2">
          إعادة تعيين كلمة المرور
        </h1>
        <p className="text-center text-text-secondary mb-6">
          أدخل كلمة المرور الجديدة ثم أكدها.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              تأكيد كلمة المرور
            </label>
            <input
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm text-primary hover:underline font-medium">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}