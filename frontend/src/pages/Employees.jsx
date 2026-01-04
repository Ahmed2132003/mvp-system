import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { notifyError } from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';
import BrandMark from '../components/layout/BrandMark';
// =====================
// Sidebar Navigation (Same style as Dashboard)
// =====================
function SidebarNav({ lang }) {
  const isAr = lang === 'ar';

  return (
    <>
      <Link
        to="/dashboard"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الداشبورد' : 'Dashboard'}
      </Link>

      <Link
        to="/pos"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'شاشة الكاشير (POS)' : 'Cashier Screen (POS)'}
      </Link>
      <Link
        to="/inventory"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'إدارة المخزون' : 'Inventory Management'}
      </Link>
      <Link
        to="/attendance"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الحضور والانصراف' : 'Attendance'}
      </Link>
      <Link
        to="/reservations"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الحجوزات' : 'Reservations'}
      </Link>
      <Link
        to="/reports"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'التقارير' : 'Reports'}
      </Link>
      <Link
        to="/settings"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الإعدادات' : 'Settings'}
      </Link>

      <Link
        to="/employees"
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
      >
        <span>{isAr ? 'الموظفين' : 'Employees'}</span>
        <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
          {isAr ? 'الآن' : 'Now'}
        </span>
      </Link>

      <Link
        to="/accounting"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الحسابات' : 'Accounting'}
      </Link>

      <Link
        to="/users/create"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'إدارة المستخدمين' : 'User Management'}
      </Link>
    </>
  );
}

export default function Employees() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // theme & language (same pattern as Dashboard)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAr = lang === 'ar';

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);

  // Apply theme to <html> + persist
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Apply language + direction to <html> + persist
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/');
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setEmployees(data);
    } catch (err) {
      console.error(err);
      notifyError(isAr ? 'فشل تحميل الموظفين' : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // الموظف العادي يشوف بياناته فقط
      if (!user.is_superuser && user.role === 'STAFF') {
        try {
          setLoading(true);
          const res = await api.get('/employees/me/');
          const employeeId = res.data?.id;
          const destination = employeeId ? `/employees/${employeeId}` : '/employees/me';
          navigate(destination, { replace: true });
        } catch (err) {
          console.error(err);
          notifyError(isAr ? 'لا يمكن تحميل ملفك الشخصي' : 'Unable to load your profile');
        } finally {
          setLoading(false);          
        }
        return;
      }

      fetchEmployees();
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <BrandMark
              subtitle={isAr ? 'لوحة تحكم الكافيه / المطعم' : 'Restaurant / Café Dashboard'}
            />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {isAr ? 'تم تطوير هذا السيستم بواسطة كريتفيتي كود' : 'تم تطوير هذا السيستم بواسطة كريتفيتي كود'}
          </div>
        </aside>

        {/* Sidebar - Mobile (Overlay) */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden" aria-modal="true">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative ml-auto h-full w-64 bg-white shadow-xl border-l border-gray-200 flex flex-col dark:bg-slate-900 dark:border-slate-800">
              <div className="px-4 py-4 border-b flex items-center justify-between dark:border-slate-800">
                <BrandMark
                  variant="mobile"
                  subtitle={isAr ? 'القائمة الرئيسية' : 'Main Menu'}
                />                
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="inline-flex items-center justify-center rounded-full p-1.5 border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  <span className="sr-only">{isAr ? 'إغلاق القائمة' : 'Close menu'}</span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <SidebarNav lang={lang} />
              </nav>

              <div className="px-4 py-3 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
                {isAr ? 'تم تطوير هذا السيستم بواسطة كريتفيتي كود' : 'تم تطوير هذا السيستم بواسطة كريتفيتي كود'}
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-20 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex md:hidden items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <span className="sr-only">{isAr ? 'فتح القائمة' : 'Open menu'}</span>
                <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {isAr ? 'الموظفين' : 'Employees'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr ? 'عرض وإدارة الموظفين' : 'View and manage employees'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Language switcher */}
              <div className="flex items-center text-[11px] border border-gray-200 rounded-full overflow-hidden dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 ${
                    !isAr ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`px-2 py-1 ${
                    isAr ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  AR
                </button>
              </div>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
              >
                {theme === 'dark' ? (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span>☀️</span>
                    <span className="hidden sm:inline">{isAr ? 'وضع فاتح' : 'Light'}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span>🌙</span>
                    <span className="hidden sm:inline">{isAr ? 'وضع داكن' : 'Dark'}</span>
                  </span>
                )}
              </button>

              <Link
                to="/dashboard"
                className="text-xs px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
              >
                {isAr ? '← الرجوع للداشبورد' : '← Back to Dashboard'}
              </Link>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto w-full">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
              {loading ? (
                <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                  {isAr ? 'جاري التحميل...' : 'Loading...'}
                </div>
              ) : employees.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isAr ? 'لا يوجد موظفين' : 'No employees found'}
                </p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {employees.map((e) => (
                      <div
                        key={e.id}
                        className="border border-gray-100 rounded-2xl p-3 bg-gray-50/60 flex flex-col gap-1 dark:bg-slate-800/70 dark:border-slate-700"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                            #{e.id}
                          </span>
                          <Link
                            to={`/employees/${e.id}`}
                            className="text-[11px] px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                          >
                            {isAr ? 'فتح الملف' : 'Open'}
                          </Link>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {e.user?.name || '—'}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {e.user?.email || '—'}
                        </p>
                        <p className="text-[11px] text-gray-600 dark:text-gray-300">
                          {isAr ? 'الفرع:' : 'Branch:'} {e.store_name || '—'}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Table on tablet/desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">#</th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                            {isAr ? 'الاسم' : 'Name'}
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                            {isAr ? 'الإيميل' : 'Email'}
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                            {isAr ? 'الفرع' : 'Branch'}
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                            {isAr ? 'إجراءات' : 'Actions'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((e) => (
                          <tr
                            key={e.id}
                            className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                          >
                            <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{e.id}</td>
                            <td className="py-2 px-2 whitespace-nowrap font-semibold text-gray-800 dark:text-gray-100">
                              {e.user?.name || '—'}
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                              {e.user?.email || '—'}
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                              {e.store_name || '—'}
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <Link
                                to={`/employees/${e.id}`}
                                className="text-[11px] px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                              >
                                {isAr ? 'فتح الملف' : 'Open profile'}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}