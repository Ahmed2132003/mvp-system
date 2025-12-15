// src/pages/Login.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import LoginBackground from '../components/auth/LoginBackground';
import { notifySuccess, notifyError } from '../lib/notifications';

export default function Login() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // لو الموظف ضغط على رابط التفعيل وكان صالح
    if (params.get('verified') === 'true') {
      const email = params.get('email');
      const namePart = email ? email.split('@')[0] : '';
      notifySuccess(
        `تم تفعيل حسابك بنجاح! ${
          namePart ? `مرحبًا يا ${namePart}` : 'مرحبًا بك'
        }، سجّل دخولك الآن.`
      );
    }

    // لو الرابط منتهي أو غير صالح
    if (params.get('error') === 'invalid_or_expired_link') {
      notifyError(
        'عذرًا، الرابط منتهي الصلاحية أو غير صحيح. اطلب من المدير يرسل لك رابط تفعيل جديد.'
      );
    }
  }, [location]);

  const searchParams = new URLSearchParams(location.search);
  const isVerified = searchParams.get('verified') === 'true';
  const hasInvalidLink = searchParams.get('error') === 'invalid_or_expired_link';

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* الخلفية المتحركة */}
      <LoginBackground />

      {/* الفورم في النص */}
      <div className="flex-1 flex items-center justify-center relative z-10 px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-primary mb-2">MVP POS</h1>
            <p className="text-text-secondary text-lg">
              نظام إدارة المطاعم والكافيهات الأقوى في مصر
            </p>
          </div>

          {/* رسائل التفعيل (اختياري: بالإضافة للتوست) */}
          {isVerified && (
            <div className="mb-8 p-6 bg-green-100 border-2 border-green-500 text-green-800 rounded-2xl text-center font-bold shadow-lg animate-pulse">
              <p className="text-xl">تم تفعيل حسابك بنجاح!</p>
              <p className="text-lg mt-2">مرحبًا بيك في MVP POS</p>
            </div>
          )}

          {hasInvalidLink && (
            <div className="mb-8 p-6 bg-red-100 border-2 border-red-500 text-red-800 rounded-2xl text-center font-bold shadow-lg">
              <p className="text-xl">الرابط منتهي أو غير صالح</p>
              <p className="text-base mt-2">اطلب رابط تفعيل جديد من المدير</p>
            </div>
          )}

          <LoginForm />

          <div className="text-center mt-8">
            <p className="text-sm text-text-secondary">
              لسه مش معانا؟{' '}
              <a
                href="#"
                className="text-primary font-semibold hover:underline"
              >
                ابدأ تجربة مجانية 14 يوم
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* الجانب الأيمن - لوجو أو صورة (اختياري) */}
      <div className="hidden lg:flex lg:flex-1 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 relative">
        <div className="text-center">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-12 shadow-2xl">
            <h2 className="text-3xl font-bold text-primary mb-4">
              مرحبًا بيك في المستقبل
            </h2>
            <p className="text-lg text-gray-700 max-w-sm">
              ادير مطعمك أو كافيهك بكل سهولة، من أي مكان، في أي وقت
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
