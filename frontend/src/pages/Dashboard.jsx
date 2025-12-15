import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError } from '../lib/notifications';

// =====================
// Sidebar Navigation
// =====================
function SidebarNav({ lang }) {
  const isAr = lang === 'ar';

  return (
    <>
      <Link
        to="/dashboard"
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
      >
        <span>{isAr ? 'الداشبورد' : 'Dashboard'}</span>
        <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
          {isAr ? 'الآن' : 'Now'}
        </span>
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
      {/* ✅ Employees */}
      <Link
        to="/employees"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الموظفين' : 'Employees'}
      </Link>

      {/* ✅ Accounting */}
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

      <button
        type="button"
        className="w-full text-right flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'التقارير' : 'Reports (Soon)'}
      </button>
    </>
  );
}

export default function Dashboard() {
  // ================
  // State
  // ================
  const [me, setMe] = useState(null); // ✅ جديد: بيانات المستخدم الحالي
  const [summary, setSummary] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState(null);

  // theme & language
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'en' // EN default
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAr = lang === 'ar';

  // رقم فورمات
  const numberFormatter = new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG');

  // تطبيق الثيم على <html> + حفظه
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // تطبيق اللغة والاتجاه على <html> + حفظها
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  // ================
  // Data fetching
  // ================
  const fetchMe = async () => {
    try {
      // ✅ FIX: المسار الصحيح في Django هو /api/v1/auth/me/
      const res = await api.get('/auth/me/');
      setMe(res.data);
    } catch (err) {
      console.error('Error loading me:', err);
      // مش هنوقف الداشبورد، بس الزر مش هيظهر
    }
  };

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/summary/');
      setSummary(res.data);
      setError(null);
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
      const msg = isAr
        ? 'حدث خطأ أثناء تحميل بيانات الداشبورد'
        : 'An error occurred while loading dashboard data';
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await api.get('/orders/', {
        params: {
          page_size: 5,
          ordering: '-created_at',
        },
      });

      const results = Array.isArray(res.data)
        ? res.data
        : res.data.results || [];

      setRecentOrders(results);
    } catch (err) {
      console.error('Error loading recent orders:', err);
      const msg = isAr
        ? 'حدث خطأ أثناء تحميل آخر الطلبات'
        : 'An error occurred while loading recent orders';
      notifyError(msg);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchMe(); // ✅ جديد
    fetchSummary();
    fetchRecentOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sales = summary?.sales || {};
  const salesOverTime = summary?.sales_over_time || [];
  const lowStock = summary?.low_stock || [];
  const topItems = summary?.top_selling_items || [];

  const kpis = [
    {
      id: 1,
      label: isAr ? 'مبيعات اليوم' : 'Today’s Sales',
      value: `${sales.daily ? numberFormatter.format(sales.daily) : 0} ${
        isAr ? 'ج.م' : 'EGP'
      }`,
    },
    {
      id: 2,
      label: isAr ? 'عدد الطلبات اليوم' : 'Orders Today',
      value: sales.daily_orders ?? 0,
    },
    {
      id: 3,
      label: isAr ? 'متوسط قيمة الطلب (اليوم)' : 'Avg Ticket (Today)',
      value: `${sales.avg_ticket ? Math.round(sales.avg_ticket) : 0} ${
        isAr ? 'ج.م' : 'EGP'
      }`,
    },
    {
      id: 4,
      label: isAr ? 'إجمالي الطلبات المدفوعة' : 'Total Paid Orders',
      value: sales.total_orders ?? 0,
    },
  ];

  const maxSalesValue =
    salesOverTime.length > 0
      ? Math.max(...salesOverTime.map((r) => r.value || 0))
      : 0;

  // ==================
  // Handlers
  // ==================
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setLanguage = (lng) => {
    setLang(lng);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <h1 className="text-xl font-bold text-primary dark:text-blue-300">
              MVP POS
            </h1>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
              {isAr ? 'لوحة تحكم الكافيه / المطعم' : 'Restaurant / Café Dashboard'}
            </p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {isAr ? 'نسخة تجريبية • جاهز للانطلاق 🚀' : 'Beta version • Ready to launch 🚀'}
          </div>
        </aside>

        {/* Sidebar - Mobile (Overlay) */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden" aria-modal="true">
            {/* خلفية */}
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Panel */}
            <div className="relative ml-auto h-full w-64 bg-white shadow-xl border-l border-gray-200 flex flex-col dark:bg-slate-900 dark:border-slate-800">
              <div className="px-4 py-4 border-b flex items-center justify-between dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-primary dark:text-blue-300">
                    MVP POS
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5 dark:text-gray-400">
                    {isAr ? 'القائمة الرئيسية' : 'Main Menu'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="inline-flex items-center justify-center rounded-full p-1.5 border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  <span className="sr-only">
                    {isAr ? 'إغلاق القائمة' : 'Close menu'}
                  </span>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    fill="none"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <SidebarNav lang={lang} />
              </nav>

              <div className="px-4 py-3 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
                {isAr ? 'نسخة تجريبية • جاهز للانطلاق 🚀' : 'Beta version • Ready to launch 🚀'}
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-20 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                type="button"
                className="inline-flex md:hidden items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <span className="sr-only">
                  {isAr ? 'فتح القائمة' : 'Open menu'}
                </span>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  fill="none"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <div>
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {isAr ? 'الداشبورد' : 'Dashboard'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr
                    ? 'نظرة سريعة على أداء اليوم في المطعم / الكافيه'
                    : 'Quick overview of today’s performance in your restaurant / café'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* ✅ زر إضافة ستور - يظهر للسوبر يوزر فقط */}
              {me?.is_superuser && (
                <Link
                  to="/admin/stores/create"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  <span>➕</span>
                  <span>{isAr ? 'إضافة ستور' : 'Add Store'}</span>
                </Link>
              )}

              {/* Filters */}
              <select className="hidden sm:block text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100">
                <option>{isAr ? 'اليوم' : 'Today'}</option>
                <option disabled>
                  {isAr ? 'قريبًا: آخر ٧ أيام' : 'Coming soon: Last 7 days'}
                </option>
                <option disabled>
                  {isAr ? 'قريبًا: هذا الشهر' : 'Coming soon: This month'}
                </option>
              </select>

              <select className="hidden md:block text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100">
                <option>{isAr ? 'الفرع الرئيسي' : 'Main branch'}</option>
              </select>

              {/* Language switcher */}
              <div className="flex items-center text-[11px] border border-gray-200 rounded-full overflow-hidden dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 ${
                    !isAr
                      ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`px-2 py-1 ${
                    isAr
                      ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-300'
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
                    <span className="hidden sm:inline">
                      {isAr ? 'وضع فاتح' : 'Light'}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span>🌙</span>
                    <span className="hidden sm:inline">
                      {isAr ? 'وضع داكن' : 'Dark'}
                    </span>
                  </span>
                )}
              </button>

              {/* User */}
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  {me?.name?.[0]?.toUpperCase() || me?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {me?.name || (me?.is_superuser ? 'Super Admin' : 'User')}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {me?.email || (isAr ? '—' : '—')}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Loading / Error */}
            {loading && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                {isAr
                  ? 'جاري تحميل بيانات الداشبورد...'
                  : 'Loading dashboard data...'}
              </div>
            )}

            {error && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                {error}
              </div>
            )}

            {/* KPI cards */}
            {!loading && (
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800"
                  >
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </section>
            )}

            {/* Charts / summaries */}
            {!loading && (
              <section className="grid gap-4 lg:grid-cols-2">
                {/* Sales over time */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr
                          ? 'مبيعات اليوم - توزيع زمني'
                          : 'Today’s Sales - Time distribution'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr
                          ? 'توزيع المبيعات على ساعات اليوم (طلبات مدفوعة)'
                          : 'Sales distribution over today’s hours (paid orders)'}
                      </p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                      {isAr ? 'بيانات حقيقية' : 'Live data'}
                    </span>
                  </div>

                  {salesOverTime.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr
                        ? 'لا توجد مبيعات مسجلة اليوم حتى الآن.'
                        : 'No sales recorded yet today.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {salesOverTime.map((row) => {
                        const width =
                          maxSalesValue > 0
                            ? `${Math.round((row.value / maxSalesValue) * 100)}%`
                            : '0%';
                        return (
                          <div key={row.label} className="flex items-center gap-3">
                            <span className="w-10 text-[11px] text-gray-500 dark:text-gray-400">
                              {row.label}
                            </span>
                            <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-l from-blue-500 to-indigo-500"
                                style={{ width }}
                              />
                            </div>
                            <span className="w-16 text-[11px] text-gray-500 text-left dark:text-gray-300">
                              {numberFormatter.format(row.value)}{' '}
                              {isAr ? 'ج.م' : 'EGP'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Top items */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? 'أعلى الأصناف مبيعًا' : 'Top selling items'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr
                          ? 'أفضل ٥ منتجات من حيث عدد القطع المباعة (طلبات مدفوعة)'
                          : 'Top 5 products by quantity sold (paid orders).'}
                      </p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {isAr ? 'من بيانات الطلبات' : 'From orders data'}
                    </span>
                  </div>

                  {topItems.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr
                        ? 'لا توجد بيانات كافية حتى الآن.'
                        : 'Not enough data yet.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {topItems.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between text-xs border-b border-gray-50 pb-2 last:border-0 last:pb-0 dark:border-slate-800"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 dark:text-gray-100">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {isAr
                                ? `عدد القطع المباعة: ${item.total_sold}`
                                : `Units sold: ${item.total_sold}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] dark:bg-blue-900/40 dark:text-blue-200">
                              {isAr ? 'تريندي 🔥' : 'Trending 🔥'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Tables section */}
            {!loading && (
              <section className="grid gap-4 xl:grid-cols-3">
                {/* Recent orders */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 xl:col-span-2 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? 'آخر الطلبات' : 'Latest orders'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr
                          ? 'لمتابعة الحالة الحالية في الـPOS والـQR'
                          : 'Monitor current status from POS / QR orders.'}
                      </p>
                    </div>
                    <Link
                      to="/pos"
                      className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                    >
                      {isAr ? 'فتح شاشة الكاشير' : 'Open POS screen'}
                    </Link>
                  </div>

                  {ordersLoading ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr
                        ? 'جاري تحميل آخر الطلبات...'
                        : 'Loading recent orders...'}
                    </p>
                  ) : recentOrders.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr ? 'لا توجد طلبات حتى الآن.' : 'No orders yet.'}
                    </p>
                  ) : (
                    <>
                      {/* Cards on mobile */}
                      <div className="space-y-2 md:hidden">
                        {recentOrders.map((order) => {
                          const tableLabel =
                            order.table_name ||
                            order.table?.name ||
                            (order.table?.number
                              ? `${isAr ? 'طاولة' : 'Table'} ${order.table.number}`
                              : isAr
                                ? 'غير محدد'
                                : 'Not specified');

                          const createdAt = order.created_at
                            ? new Date(order.created_at)
                            : null;

                          const timeLabel = createdAt
                            ? createdAt.toLocaleTimeString(isAr ? 'ar-EG' : 'en-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '--';

                          return (
                            <div
                              key={order.id}
                              className="border border-gray-100 rounded-xl p-3 bg-gray-50/60 flex flex-col gap-1 dark:bg-slate-800/70 dark:border-slate-700"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                                  {isAr ? `طلب #${order.id}` : `Order #${order.id}`}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {timeLabel}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                                <span>{tableLabel}</span>
                                <span>
                                  {order.total}{' '}
                                  {isAr ? 'ج.م' : 'EGP'}
                                </span>
                              </div>
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                                  {order.status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Table on larger screens */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-xs text-right">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'الطلب' : 'Order'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'الوقت' : 'Time'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'القناة / الطاولة' : 'Channel / Table'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'الإجمالي' : 'Total'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'الحالة' : 'Status'}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentOrders.map((order) => {
                              const tableLabel =
                                order.table_name ||
                                order.table?.name ||
                                (order.table?.number
                                  ? `${isAr ? 'طاولة' : 'Table'} ${order.table.number}`
                                  : isAr
                                    ? 'غير محدد'
                                    : 'Not specified');

                              const createdAt = order.created_at
                                ? new Date(order.created_at)
                                : null;

                              const timeLabel = createdAt
                                ? createdAt.toLocaleTimeString(
                                    isAr ? 'ar-EG' : 'en-EG',
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }
                                  )
                                : '--';

                              return (
                                <tr
                                  key={order.id}
                                  className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                                >
                                  <td className="py-2 px-2 whitespace-nowrap font-semibold text-gray-800 dark:text-gray-100">
                                    #{order.id}
                                  </td>
                                  <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                    {timeLabel}
                                  </td>
                                  <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                    {tableLabel}
                                  </td>
                                  <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                    {order.total}{' '}
                                    {isAr ? 'ج.م' : 'EGP'}
                                  </td>
                                  <td className="py-2 px-2 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                                      {order.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* Low stock */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? 'أصناف قليلة في المخزون' : 'Low stock items'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr
                          ? 'تابع الأصناف الحرجة قبل ما تخلص'
                          : 'Track critical items before they run out.'}
                      </p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200">
                      {isAr
                        ? `${lowStock.length} عناصر حرجة`
                        : `${lowStock.length} critical items`}
                    </span>
                  </div>

                  {lowStock.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr
                        ? 'لا توجد أصناف منخفضة المخزون حاليًا.'
                        : 'No low-stock items at the moment.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {lowStock.map((item, idx) => (
                        <div
                          key={`${item.item}-${idx}`}
                          className="flex items-center justify-between text-xs border-b border-gray-50 pb-2 last:border-0 last:pb-0 dark:border-slate-800"
                        >
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-100">
                              {item.item}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {isAr
                                ? `الفرع: ${item.branch} • الكمية الحالية: ${item.current} • حد إعادة الطلب: ${item.min}`
                                : `Branch: ${item.branch} • Current qty: ${item.current} • Reorder level: ${item.min}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-[11px] px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                          >
                            {isAr ? 'عرض الصنف' : 'View item'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
                    {isAr
                      ? '* لاحقًا: تنبيهات تلقائية عند انخفاض المخزون (واتساب / إشعار داخل النظام)'
                      : '* Coming soon: automatic alerts when stock is low (WhatsApp / in-app notifications).'}
                  </p>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
