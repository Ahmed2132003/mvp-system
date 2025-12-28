// src/components/auth/LoginForm.jsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      // The backend redirect will handle it, but add fallback
      window.location.href = '/dashboard';
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-border">
      <h2 className="text-2xl font-bold text-center mb-8 text-text-primary">
        تسجيل الدخول
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* البريد الإلكتروني */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            البريد الإلكتروني
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition"
            placeholder="example@eduvia.com"
            dir="ltr"
          />
        </div>

        {/* كلمة المرور */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            كلمة المرور
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

        {/* رسالة الخطأ */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-danger px-4 py-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {/* زر تسجيل الدخول */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.3" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              جاري تسجيل الدخول...
            </>
          ) : (
            'تسجيل الدخول'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/forgot-password"
          className="text-sm text-primary hover:underline font-medium"
        >
          نسيت كلمة المرور؟
        </Link>
      </div>
    </div>
  );
}