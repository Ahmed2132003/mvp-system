// src/pages/auth/VerifyAccount.jsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../lib/api';

export default function VerifyAccount() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const email = new URLSearchParams(location.search).get('email') || '';

  // Toast
  const [toast, setToast] = useState({
    open: false,
    message: '',
    type: 'success',
  });

  const showToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 3000);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      showToast('من فضلك أدخل كود مكوّن من 6 أرقام.', 'error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await api.post('/core/auth/verify/', { email, code });
      const successMsg = 'تم تفعيل حسابك بنجاح! جاري تحويلك إلى تسجيل الدخول...';
      setMessage(successMsg);
      showToast(successMsg, 'success');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail ||
        error.response?.data?.code?.[0] ||
        error.response?.data?.non_field_errors?.[0] ||
        'الكود غير صحيح أو منتهي الصلاحية';
      setMessage(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    // نفس الـ JSX الجميل بتاعك
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-primary mb-4">تفعيل الحساب</h1>
        <p className="text-gray-600 mb-8">
          تم إرسال كود التفعيل إلى بريدك:
          <br />
          <strong className="text-lg">{email || 'غير محدد'}</strong>
        </p>

        <input
          type="text"
          maxLength="6"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="أدخل الكود (6 أرقام)"
          className="w-full text-center text-4xl font-mono tracking-widest py-6 border-2 rounded-2xl mb-6 focus:border-primary outline-none transition"
        />

        {message && (
          <p className={`font-bold text-lg mb-6 ${message.includes('نجاح') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-xl disabled:opacity-50 transition"
        >
          {loading ? 'جاري التفعيل...' : 'تفعيل الحساب'}
        </button>
      </div>

      {/* Toast */}
      {toast.open && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`max-w-xs rounded-2xl shadow-lg px-4 py-3 text-sm border-l-4 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                : 'bg-red-50 border-red-500 text-red-800'
            }`}
          >
            <p className="font-semibold mb-1">
              {toast.type === 'success' ? 'تم بنجاح' : 'حدث خطأ'}
            </p>
            <p>{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
