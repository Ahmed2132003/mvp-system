// src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { notifyError, notifySuccess } from '../lib/notifications';
import api from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await api.post('/auth/forgot-password/', { email });
      notifySuccess('تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني إن وجد حساب مطابق.');
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'حدث خطأ أثناء إرسال الرابط، حاول مرة أخرى.';
      notifyError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-primary/10 px-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-border p-8">
        <h1 className="text-2xl font-bold text-center text-text-primary mb-2">
          نسيت كلمة المرور؟
        </h1>
        <p className="text-center text-text-secondary mb-6">
          ادخل بريدك الإلكتروني لإرسال رابط إعادة التعيين.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition"
              placeholder="example@domain.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال الرابط'}
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