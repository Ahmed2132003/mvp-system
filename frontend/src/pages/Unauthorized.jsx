import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Unauthorized() {
  const { user } = useAuth();
  const isAr = (user?.lang || localStorage.getItem('lang') || 'en') === 'ar';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 max-w-lg text-center space-y-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          {isAr ? 'غير مسموح لك بالوصول لهذه الصفحة' : 'You are not allowed to access this page'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {isAr
            ? 'من فضلك استخدم الصفحة المخصصة لدورك.'
            : 'Please use the page that matches your role.'}
        </p>
        <div className="flex justify-center gap-2">
          <Link
            to="/"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            {isAr ? 'العودة للرئيسية' : 'Back to home'}
          </Link>
          <Link
            to="/employees/me"
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            {isAr ? 'ملفي' : 'My profile'}
          </Link>
        </div>
      </div>
    </div>
  );
}