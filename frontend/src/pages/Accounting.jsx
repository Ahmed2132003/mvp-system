import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError, notifySuccess } from '../lib/notifications';

// =====================
// Sidebar Navigation (نفس الداشبورد)
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

      <Link
        to="/employees"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الموظفين' : 'Employees'}
      </Link>

      <Link
        to="/accounting"
        className="flex items-center px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
      >
        <span>{isAr ? 'الحسابات' : 'Accounting'}</span>
        <span className="text-xs bg-emerald-100 px-2 py-0.5 rounded-full dark:bg-emerald-800/70">
          {isAr ? 'الآن' : 'Now'}
        </span>
      </Link>

      <Link
        to="/kds"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'المطبخ والبار' : 'KDS'}
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

// =====================
// Helpers
// =====================
function formatDateForInput(date) {
  return date.toISOString().slice(0, 10);
}
function formatMonthForInput(date) {
  return date.toISOString().slice(0, 7);
}

export default function Accounting() {
  const today = useMemo(() => new Date(), []);

  // theme & language (نفس الداشبورد)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAr = lang === 'ar';

  // period filter
  const [periodType, setPeriodType] = useState('month');
  const [periodValue, setPeriodValue] = useState(() => formatMonthForInput(today));

  // data
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // formatter
  const numberFormatter = useMemo(() => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG'), [isAr]);

  // sound (نفس فكرة الداشبورد)
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.18);
    } catch (error) {
      console.warn('Audio unavailable', error);
    }
  }, []);

  // apply theme to html
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // apply lang + dir
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  const fetchAccounting = useCallback(
    async (opts = { silent: false }) => {
      try {
        if (!opts?.silent) setLoading(true);
        setError(null);

        const res = await api.get('/reports/accounting/', {
          params: {
            period_type: periodType,
            period_value: periodValue,
          },
        });

        const payload = res?.data?.data ?? res?.data ?? null;

        if (!payload || typeof payload !== 'object') {
          throw new Error('Invalid accounting response shape');
        }

        setData(payload);

        if (opts?.silent) {
          const msg = isAr ? 'تم تحديث الحسابات تلقائيًا.' : 'Accounting refreshed automatically.';
          notifySuccess(msg);
          playNotificationSound();
        }
      } catch (err) {
        console.error('Accounting fetch error:', err);

        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          (err?.response?.status === 404
            ? isAr
              ? 'Endpoint الحسابات غير موجود على السيرفر (404).'
              : 'Accounting endpoint not found on server (404).'
            : isAr
              ? 'فشل تحميل صفحة الحسابات.'
              : 'Failed to load accounting page.');

        setError(msg);
        notifyError(msg);
        setData(null);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [periodType, periodValue, isAr, playNotificationSound]
  );

  useEffect(() => {
    fetchAccounting();
  }, [fetchAccounting]);

  // Auto refresh (اختياري)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAccounting({ silent: true });
    }, 60000); // كل دقيقة

    return () => clearInterval(interval);
  }, [fetchAccounting]);

  // ✅ memoized slices (fix exhaustive-deps warnings)
  const payroll = useMemo(() => data?.payroll ?? {}, [data]);
  const inventory = useMemo(() => data?.inventory ?? {}, [data]);
  const sales = useMemo(() => data?.sales ?? {}, [data]);
  const expenses = useMemo(() => data?.expenses ?? {}, [data]);
  const profit = useMemo(() => data?.profit ?? {}, [data]);
  const legacy = useMemo(() => data?.legacy_totals ?? {}, [data]);

  const currency = data?.currency ?? 'EGP';

  const rows = useMemo(() => {
    const list = payroll?.rows;
    return Array.isArray(list) ? list : [];
  }, [payroll]);

  const periodLabel = useMemo(() => {
    if (periodType === 'day') return isAr ? 'يوم' : 'Day';
    if (periodType === 'year') return isAr ? 'سنة' : 'Year';
    return isAr ? 'شهر' : 'Month';
  }, [periodType, isAr]);

  const summaryCards = useMemo(
    () => [
      {
        label: isAr
          ? 'إجمالي الرواتب (حضور + مكافآت + سلف - خصومات)'
          : 'Total payroll (attendance + bonuses + advances - penalties)',
        value: expenses.payroll ?? payroll.payroll_total ?? 0,
      },
      {
        label: isAr ? 'مشتريات المخزون (قيمة شراء)' : 'Inventory purchases (cost)',
        value: inventory.purchase_cost_total ?? 0,
      },
      { label: isAr ? 'إجمالي المبيعات' : 'Total sales', value: sales.total_sales ?? 0 },
      { label: isAr ? 'إجمالي المصروفات' : 'Total expenses', value: expenses.total ?? 0 },
      { label: isAr ? 'صافي الربح' : 'Net profit', value: profit.net_profit ?? 0 },
    ],
    [isAr, expenses, payroll, inventory, sales, profit]
  );

  const payrollBreakdown = useMemo(
    () => [
      {
        label: isAr ? 'قيمة الحضور' : 'Attendance value',
        value: payroll.attendance_value_total ?? legacy.total_salaries ?? 0,
        isDays: false,
      },
      {
        label: isAr ? 'المكافآت (تضاف على المصروفات)' : 'Bonuses (add to expenses)',
        value: payroll.bonuses_total ?? legacy.total_bonuses ?? 0,
        isDays: false,
      },
      {
        label: isAr ? 'السلف (تضاف على المصروفات)' : 'Advances (add to expenses)',
        value: payroll.advances_total ?? legacy.total_advances ?? 0,
        isDays: false,
      },
      {
        label: isAr ? 'الخصومات (تخصم من المصروفات)' : 'Penalties (deduct from expenses)',
        value: payroll.penalties_total ?? legacy.total_penalties ?? 0,
        isDays: false,
      },
      { label: isAr ? 'أيام الحضور' : 'Attendance days', value: payroll.attendance_days ?? 0, isDays: true },
    ],
    [isAr, payroll, legacy]
  );

  const fmtMoney = useCallback(
    (v) => `${numberFormatter.format(Number(v || 0))} ${currency}`,
    [numberFormatter, currency]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <h1 className="text-xl font-bold text-primary dark:text-blue-300">MVP POS</h1>
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

        {/* Sidebar - Mobile Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden" aria-modal="true">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative ml-auto h-full w-64 bg-white shadow-xl border-l border-gray-200 flex flex-col dark:bg-slate-900 dark:border-slate-800">
              <div className="px-4 py-4 border-b flex items-center justify-between dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-primary dark:text-blue-300">MVP POS</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5 dark:text-gray-400">
                    {isAr ? 'القائمة الرئيسية' : 'Main Menu'}
                  </p>
                </div>
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
                <span className="sr-only">{isAr ? 'فتح القائمة' : 'Open menu'}</span>
                <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {isAr ? 'الحسابات' : 'Accounting'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr
                    ? 'رواتب الحضور، المشتريات، المبيعات، المصروفات، والربحية للفترة المختارة'
                    : 'Payroll, purchases, sales, expenses, and profitability for the selected period.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick back */}
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
              >
                {isAr ? '← الرجوع للداشبورد' : '← Back to dashboard'}
              </Link>

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
                    <span className="hidden sm:inline">{isAr ? 'وضع فاتح' : 'Light'}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span>🌙</span>
                    <span className="hidden sm:inline">{isAr ? 'وضع داكن' : 'Dark'}</span>
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Period Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    {isAr ? 'فلتر الفترة' : 'Period filter'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                    {isAr
                      ? `يتم الحساب للفترة (${periodLabel}) المختارة.`
                      : `Calculated for the selected (${periodLabel}) period.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{isAr ? 'العملة:' : 'Currency:'}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{currency}</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    {isAr ? 'نوع الفترة' : 'Period type'}
                  </label>
                  <select
                    value={periodType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setPeriodType(nextType);
                      if (nextType === 'day') setPeriodValue(formatDateForInput(today));
                      else if (nextType === 'year') setPeriodValue(String(today.getFullYear()));
                      else setPeriodValue(formatMonthForInput(today));
                    }}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                  >
                    <option value="day">{isAr ? 'يومي' : 'Daily'}</option>
                    <option value="month">{isAr ? 'شهري' : 'Monthly'}</option>
                    <option value="year">{isAr ? 'سنوي' : 'Yearly'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    {isAr ? 'قيمة الفترة' : 'Period value'}
                  </label>

                  {periodType === 'day' && (
                    <input
                      type="date"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      value={periodValue}
                      onChange={(e) => setPeriodValue(e.target.value)}
                    />
                  )}

                  {periodType === 'month' && (
                    <input
                      type="month"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      value={periodValue}
                      onChange={(e) => setPeriodValue(e.target.value)}
                    />
                  )}

                  {periodType === 'year' && (
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      value={periodValue}
                      onChange={(e) => setPeriodValue(e.target.value)}
                    />
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fetchAccounting({ silent: false })}
                    className="w-full bg-blue-600 text-white rounded-xl px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-70"
                    disabled={loading}
                  >
                    {loading ? (isAr ? 'جار التحميل...' : 'Loading...') : isAr ? 'تحديث البيانات' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>
                  {isAr
                    ? 'يشمل: حضور الموظفين، المكافآت، الخصومات، السلف، مشتريات المخزون، والمبيعات المدفوعة.'
                    : 'Includes: attendance, bonuses, penalties, advances, inventory purchases, and paid sales.'}
                </span>

                <span className="font-semibold text-gray-800 dark:text-gray-100">
                  {isAr ? 'آخر تحديث:' : 'Last update:'}{' '}
                  {data?.generated_at
                    ? new Date(data.generated_at).toLocaleString(isAr ? 'ar-EG' : 'en-EG')
                    : '—'}
                </span>
              </div>
            </div>

            {/* Loading / Error */}
            {loading && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                {isAr ? 'جاري تحميل بيانات الحسابات...' : 'Loading accounting data...'}
              </div>
            )}

            {!loading && error && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                <div className="flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => fetchAccounting({ silent: false })}
                    className="text-xs px-3 py-1 rounded-full border border-red-200 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                  >
                    {isAr ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              </div>
            )}

            {/* KPIs */}
            {!loading && !error && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {summaryCards.map((card) => (
                    <div
                      key={card.label}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800"
                    >
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                        {fmtMoney(card.value)}
                      </p>
                    </div>
                  ))}
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {payrollBreakdown.map((card) => (
                    <div
                      key={card.label}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800"
                    >
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-50">
                        {card.isDays
                          ? numberFormatter.format(Number(card.value || 0))
                          : fmtMoney(card.value)}
                      </p>
                    </div>
                  ))}
                </section>

                {/* Inventory & Sales */}
                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {isAr ? 'المخزون' : 'Inventory'}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                          {isAr ? 'ملخص مشتريات المخزون للفترة' : 'Inventory purchases summary for the period.'}
                        </p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        {isAr ? 'ملخص' : 'Summary'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                        <span>{isAr ? 'قيمة شراء الأصناف' : 'Purchase cost total'}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {fmtMoney(inventory.purchase_cost_total)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                        <span>{isAr ? 'قيمة البيع المتوقعة' : 'Expected sale value'}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {fmtMoney(inventory.purchase_sale_value_total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {isAr ? 'المبيعات والمصروفات' : 'Sales & Expenses'}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                          {isAr ? 'نظرة سريعة على الربحية للفترة' : 'Quick look at period profitability.'}
                        </p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {isAr ? 'أرقام' : 'KPIs'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                        <span>{isAr ? 'إجمالي المبيعات' : 'Total sales'}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {fmtMoney(sales.total_sales)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                        <span>{isAr ? 'إجمالي المصروفات' : 'Total expenses'}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {fmtMoney(expenses.total)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                        <span>{isAr ? 'صافي الربح' : 'Net profit'}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {fmtMoney(profit.net_profit)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Payroll Details */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? 'تفاصيل الرواتب حسب الحضور' : 'Payroll details by attendance'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr
                          ? 'عرض تفصيلي لكل موظف خلال الفترة المحددة'
                          : 'Detailed view per employee in the selected period.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchAccounting({ silent: false })}
                      className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                    >
                      {isAr ? 'تحديث' : 'Refresh'}
                    </button>
                  </div>

                  {rows.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr ? 'لا توجد بيانات لعرضها.' : 'No data to display.'}
                    </p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="space-y-2 md:hidden">
                        {rows.map((r, idx) => (
                          <div
                            key={r.employee_id ?? idx}
                            className="border border-gray-100 rounded-xl p-3 bg-gray-50/60 flex flex-col gap-1 dark:bg-slate-800/70 dark:border-slate-700"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                                {r.employee_name ?? (isAr ? '—' : '—')}
                              </span>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isAr ? 'صافي:' : 'Net:'} {fmtMoney(r.net_salary)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300 mt-1">
                              <div className="flex items-center justify-between">
                                <span>{isAr ? 'أيام' : 'Days'}</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {numberFormatter.format(Number(r.attendance_days || 0))}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>{isAr ? 'تأخير' : 'Late'}</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {numberFormatter.format(Number(r.late_minutes || 0))}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span>{isAr ? 'الحضور' : 'Attendance'}</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {fmtMoney(r.attendance_value)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span>{isAr ? 'خصومات' : 'Penalties'}</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {fmtMoney(r.penalties)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span>{isAr ? 'سلف' : 'Advances'}</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {fmtMoney(r.advances)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span>{isAr ? 'مكافآت' : 'Bonuses'}</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {fmtMoney(r.bonuses)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'الموظف' : 'Employee'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'أيام الحضور' : 'Days'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'الأساس الشهري (يومي × 30)' : 'Monthly base (daily × 30)'}
                              </th>                              
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'أجر اليوم' : 'Daily'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'قيمة الحضور' : 'Attendance'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'خصومات' : 'Penalties'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'سلف' : 'Advances'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'مكافآت' : 'Bonuses'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'الصافي' : 'Net'}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'دقائق تأخير' : 'Late (min)'}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, idx) => (
                              <tr
                                key={r.employee_id ?? idx}
                                className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70 text-center"
                              >
                                <td className="py-2 px-2 whitespace-nowrap font-semibold text-gray-800 dark:text-gray-100">
                                  {r.employee_name ?? '—'}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  {numberFormatter.format(Number(r.attendance_days || 0))}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {fmtMoney(r.base_salary)}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {fmtMoney(r.daily_rate)}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {fmtMoney(r.attendance_value)}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {fmtMoney(r.penalties)}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {fmtMoney(r.advances)}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {fmtMoney(r.bonuses)}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap font-semibold text-gray-900 dark:text-gray-50">
                                  {fmtMoney(r.net_salary)}
                                </td>
                                <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  {numberFormatter.format(Number(r.late_minutes || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
