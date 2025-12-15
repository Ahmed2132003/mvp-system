import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';

// =====================
// Sidebar Navigation (نفس شكل الداشبورد تقريبًا)
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
        to="/users/create"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'إدارة المستخدمين' : 'User Management'}
      </Link>

      <Link
        to="/admin/stores/create"
        className="flex items-center px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
      >
        {isAr ? 'إضافة ستور' : 'Add Store'}
      </Link>
    </>
  );
}

export default function AdminCreateStore() {
  // ==================
  // Theme & Language (نفس فكرة الداشبورد)
  // ==================
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAr = lang === 'ar';

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  // ==================
  // Data
  // ==================
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    owner_id: '',
    paymob_keys: {
      enabled: false,
      sandbox_mode: true,
      api_key: '',
      iframe_id: '',
      integration_id_card: '',
      integration_id_wallet: '',
      hmac_secret: '',
    },
  });

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const title = useMemo(
    () => (isAr ? 'إضافة ستور جديد' : 'Create New Store'),
    [isAr]
  );

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      try {
        setUsersLoading(true);

        // ملاحظة: انت كنت بتستخدم /users/?role=OWNER,MANAGER
        // ده هيمشي لو API فعلاً بتفلتر بالـ role
        const res = await api.get('/users/', { params: { role: 'OWNER,MANAGER' } });

        // لو بيرجع results
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        if (mounted) setUsers(data);
      } catch (err) {
        console.error('Failed to load users:', err);
        notifyError(isAr ? 'فشل تحميل المستخدمين' : 'Failed to load users');
      } finally {
        if (mounted) setUsersLoading(false);
      }
    };

    loadUsers();

    return () => {
      mounted = false;
    };
  }, [isAr]);

  // ==================
  // Handlers
  // ==================
  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onPaymobChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      paymob_keys: { ...prev.paymob_keys, [key]: value },
    }));
  };

  const submit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const payload = {
        name: form.name,
        address: form.address,
        phone: form.phone,
        owner_id: form.owner_id ? Number(form.owner_id) : null,
        paymob_keys: form.paymob_keys,
      };

      await api.post('/admin/stores/', payload);

      notifySuccess(isAr ? 'تم إنشاء الستور بنجاح' : 'Store created successfully');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Create store failed:', err);

      const serverMsg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === 'string' ? err.response.data : null);

      notifyError(
        serverMsg ||
          (isAr ? 'فشل إنشاء الستور' : 'Failed to create store')
      );
    } finally {
      setSaving(false);
    }
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
            {isAr ? 'إدارة السوبر يوزر • إنشاء ستور 🚀' : 'Superuser tools • Create store 🚀'}
          </div>
        </aside>

        {/* Sidebar - Mobile */}
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
                {isAr ? 'إدارة السوبر يوزر' : 'Superuser tools'}
              </div>
            </div>
          </div>
        )}

        {/* Main */}
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
                  {title}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr
                    ? 'إنشاء ستور جديد وتعيين Owner / Manager'
                    : 'Create a new store and assign an Owner / Manager'}
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

              <Link
                to="/dashboard"
                className="text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {isAr ? 'رجوع' : 'Back'}
              </Link>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto w-full">
            <form onSubmit={submit} className="space-y-4">
              {/* Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? 'بيانات الستور' : 'Store details'}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr ? 'املأ البيانات الأساسية' : 'Fill basic information'}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                    {isAr ? 'سوبر يوزر' : 'Superuser'}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      {isAr ? 'اسم الستور' : 'Store name'}
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => onChange('name', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                      placeholder={isAr ? 'مثال: فرع المعادي' : 'e.g. Maadi Branch'}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      {isAr ? 'رقم الهاتف' : 'Phone'}
                    </label>
                    <input
                      value={form.phone}
                      onChange={(e) => onChange('phone', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                      placeholder={isAr ? '010...' : '+20...'}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      {isAr ? 'العنوان' : 'Address'}
                    </label>
                    <input
                      value={form.address}
                      onChange={(e) => onChange('address', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                      placeholder={isAr ? 'العنوان بالكامل' : 'Full address'}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      {isAr ? 'Owner / Manager' : 'Owner / Manager'}
                    </label>

                    <select
                      value={form.owner_id}
                      onChange={(e) => onChange('owner_id', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                      disabled={usersLoading}
                    >
                      <option value="">
                        {usersLoading
                          ? isAr
                            ? 'جاري تحميل المستخدمين...'
                            : 'Loading users...'
                          : isAr
                            ? 'اختر Owner / Manager'
                            : 'Select Owner / Manager'}
                      </option>

                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.name || u.email) + ` (${u.role})`}
                        </option>
                      ))}
                    </select>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isAr
                        ? 'يجب أن يكون الدور OWNER أو MANAGER.'
                        : 'Role must be OWNER or MANAGER.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Paymob Card (اختياري لكن بنفس ستايل المشروع) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? 'إعدادات PayMob' : 'PayMob settings'}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr ? 'اختياري — يمكن تفعيله لاحقًا' : 'Optional — can be enabled later'}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={!!form.paymob_keys.enabled}
                      onChange={(e) => onPaymobChange('enabled', e.target.checked)}
                    />
                    {isAr ? 'تفعيل' : 'Enable'}
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">API Key</label>
                    <input
                      value={form.paymob_keys.api_key}
                      onChange={(e) => onPaymobChange('api_key', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">Iframe ID</label>
                    <input
                      value={form.paymob_keys.iframe_id}
                      onChange={(e) => onPaymobChange('iframe_id', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      Integration ID (Card)
                    </label>
                    <input
                      value={form.paymob_keys.integration_id_card}
                      onChange={(e) => onPaymobChange('integration_id_card', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      Integration ID (Wallet)
                    </label>
                    <input
                      value={form.paymob_keys.integration_id_wallet}
                      onChange={(e) => onPaymobChange('integration_id_wallet', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs text-gray-600 dark:text-gray-300">HMAC Secret</label>
                    <input
                      value={form.paymob_keys.hmac_secret}
                      onChange={(e) => onPaymobChange('hmac_secret', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={!!form.paymob_keys.sandbox_mode}
                        onChange={(e) => onPaymobChange('sandbox_mode', e.target.checked)}
                      />
                      {isAr ? 'Sandbox mode' : 'Sandbox mode'}
                    </label>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
                  </button>

                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </Link>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {isAr
                    ? 'بعد الإنشاء سيتم تحويلك للداشبورد.'
                    : 'After creation, you will be redirected to the dashboard.'}
                </p>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
