// src/pages/AdminAccounts.jsx

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError, notifySuccess } from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';
import BrandMark from '../components/layout/BrandMark';

// =====================
// Sidebar Navigation (نفس بتاعة الداشبورد)
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
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الحسابات' : 'Accounting'}
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
    </>
  );
}

// =====================
// Role Badge
// =====================
const RoleBadge = ({ role, lang }) => {
  const isAr = lang === 'ar';
  const map = {
    OWNER: {
      label: isAr ? 'مالك النظام' : 'Owner',
      color: 'bg-purple-100 text-purple-700',
    },
    MANAGER: {
      label: isAr ? 'مدير' : 'Manager',
      color: 'bg-blue-100 text-blue-700',
    },
    STAFF: {
      label: isAr ? 'موظف' : 'Staff',
      color: 'bg-gray-100 text-gray-700',
    },
  };
  const info = map[role] || map.STAFF;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${info.color}`}>
      {info.label}
    </span>
  );
};

export default function AdminAccounts() {
  const { User } = useAuth();

  // ==============
  // Theme & Language (نفس منطق الداشبورد)
  // ==============
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAr = lang === 'ar';

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  // ==============
  // State (الحسابات)
  // ==============
  const [accounts, setAccounts] = useState([]);
  const [stores, setStores] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const filteredAccounts = useMemo(() => {
    if (!roleFilter) return accounts;
    return accounts.filter((acc) => acc.role === roleFilter);
  }, [accounts, roleFilter]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users/', {
        params: roleFilter ? { role: roleFilter } : {},
      });
      const results = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setAccounts(results);
      setError('');
    } catch (err) {
      console.error(err);
      const msg = isAr
        ? 'تعذر تحميل الحسابات، حاول لاحقًا.'
        : 'Failed to load accounts, please try again later.';
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, isAr]);

  const loadStores = useCallback(async () => {
    try {
      const res = await api.get('/stores/available/');
      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setStores(results);
    } catch (err) {
      console.error(err);
      const msg = isAr
        ? 'تعذر تحميل الفروع المتاحة.'
        : 'Failed to load available stores.';
      notifyError(msg);
    }
  }, [isAr]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const updateAccountInState = (updated) => {
    setAccounts((prev) => prev.map((acc) => (acc.id === updated.id ? updated : acc)));
  };

  const handleTogglePayment = async (acc) => {
    setActionLoading(acc.id);
    try {
      const res = await api.post(`/admin/users/${acc.id}/set-payment/`, {
        verified: !acc.is_payment_verified,
      });
      updateAccountInState(res.data);
      const msg = !acc.is_payment_verified
        ? isAr
          ? 'تم توثيق الدفع وتشغيل الحساب بنجاح.'
          : 'Payment verified and account activated successfully.'
        : isAr
          ? 'تم إيقاف توثيق الدفع لهذا الحساب.'
          : 'Payment verification disabled for this account.';
      notifySuccess(msg);
    } catch (err) {
      console.error(err);
      const msg = isAr ? 'تعذر تعديل حالة الدفع.' : 'Could not update payment status.';
      notifyError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (acc) => {
    setActionLoading(acc.id);
    try {
      const res = await api.patch(`/admin/users/${acc.id}/`, { is_active: !acc.is_active });
      updateAccountInState(res.data);
      const msg = !acc.is_active
        ? isAr
          ? 'تم تفعيل الحساب.'
          : 'Account has been activated.'
        : isAr
          ? 'تم إيقاف الحساب.'
          : 'Account has been deactivated.';
      notifySuccess(msg);
    } catch (err) {
      console.error(err);
      const msg = isAr ? 'تعذر تحديث حالة الحساب.' : 'Could not update account status.';
      notifyError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (acc, newRole) => {
    setActionLoading(acc.id);
    try {
      const res = await api.patch(`/admin/users/${acc.id}/`, { role: newRole });
      updateAccountInState(res.data);
      const msg = isAr
        ? 'تم تحديث نوع الحساب.'
        : 'Account role has been updated.';
      notifySuccess(msg);
    } catch (err) {
      console.error(err);
      const msg = isAr ? 'تعذر تحديث نوع الحساب.' : 'Could not update account role.';
      notifyError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStoreLink = async (acc, storeId) => {
    if (!storeId) return;
    setActionLoading(acc.id);
    try {
      const res = await api.post(`/admin/users/${acc.id}/link-store/`, { store_id: storeId });
      updateAccountInState(res.data);
      const msg = isAr
        ? 'تم ربط الحساب بالستور بنجاح.'
        : 'Store linked to account successfully.';
      notifySuccess(msg);
    } catch (err) {
      console.error(err);
      const msg = isAr ? 'تعذر ربط الستور بالحساب.' : 'Could not link store to account.';
      notifyError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStoreUnlink = async (acc, storeId) => {
    setActionLoading(acc.id);
    try {
      const res = await api.post(`/admin/users/${acc.id}/unlink-store/`, { store_id: storeId });
      updateAccountInState(res.data);
      const msg = isAr
        ? 'تم إزالة الربط بالستور.'
        : 'Store unlinked from account.';
      notifySuccess(msg);
    } catch (err) {
      console.error(err);
      const msg = isAr ? 'تعذر إزالة ربط الستور.' : 'Could not unlink store.';
      notifyError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (acc) => {
    const confirmMsg = isAr
      ? 'هل أنت متأكد من حذف هذا الحساب؟'
      : 'Are you sure you want to delete this account?';
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(acc.id);
    try {
      await api.delete(`/admin/users/${acc.id}/`);
      setAccounts((prev) => prev.filter((u) => u.id !== acc.id));
      const msg = isAr ? 'تم حذف الحساب.' : 'Account has been deleted.';
      notifySuccess(msg);
    } catch (err) {
      console.error(err);
      const msg = isAr ? 'تعذر حذف الحساب.' : 'Could not delete account.';
      notifyError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setLanguage = (lng) => {
    setLang(lng);
  };

  // ==============
  // UI
  // ==============
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
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => setMobileSidebarOpen(false)}
            />
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
                {isAr ? 'تم تطوير هذا السيستم بواسطة كريتفيتي كود' : 'تم تطوير هذا السيستم بواسطة كريتفيتي كود'}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Top bar (نفس ستايل الداشبورد) */}
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
                  {isAr
                    ? 'إدارة الحسابات (سوبر يوزر)'
                    : 'Accounts Management (Superuser)'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr
                    ? 'ربط/إزالة ستور، ضبط التجربة المجانية، توثيق الدفع، وتفعيل/إيقاف الحسابات.'
                    : 'Link / unlink stores, manage trial, verify payments, and activate / deactivate accounts.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Back to dashboard */}
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
              >
                {isAr ? '← العودة للداشبورد' : '← Back to Dashboard'}
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

              {/* User avatar */}
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  {User?.name?.[0]?.toUpperCase() ||
                    User?.email?.[0]?.toUpperCase() ||
                    'U'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {User?.name ||
                      (User?.is_superuser
                        ? isAr
                          ? 'سوبر أدمن'
                          : 'Super Admin'
                        : isAr
                          ? 'مستخدم'
                          : 'User')}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {User?.email || '—'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="px-4 md:px-8 py-6 space-y-4 max-w-7xl mx-auto w-full">
            {/* Filters row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                >
                  <option value="">
                    {isAr ? 'كل أنواع الحسابات' : 'All roles'}
                  </option>
                  <option value="OWNER">{isAr ? 'Owner - مالك' : 'Owner'}</option>
                  <option value="MANAGER">{isAr ? 'Manager - مدير' : 'Manager'}</option>
                  <option value="STAFF">{isAr ? 'Staff - موظف' : 'Staff'}</option>
                </select>
                <button
                  type="button"
                  onClick={loadAccounts}
                  className="text-sm px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark"
                >
                  {isAr ? 'تحديث القائمة' : 'Refresh list'}
                </button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {isAr ? 'إجمالي الحسابات: ' : 'Total accounts: '}
                <span className="font-semibold">{filteredAccounts.length}</span>
              </div>
            </div>

            {error && (
              <div className="mb-2 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                {error}
              </div>
            )}

            {/* Table wrapper (ريسپونسف مع سكرول أفقى للموبايل) */}
            <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm">
              <table className="w-full text-sm text-right min-w-[720px]">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr className="text-gray-600 dark:text-gray-300">
                    <th className="py-3 px-3 font-semibold">
                      {isAr ? 'الحساب' : 'Account'}
                    </th>
                    <th className="py-3 px-3 font-semibold">
                      {isAr ? 'الدور' : 'Role'}
                    </th>
                    <th className="py-3 px-3 font-semibold">
                      {isAr ? 'التجربة / الدفع' : 'Trial / Payment'}
                    </th>
                    <th className="py-3 px-3 font-semibold">
                      {isAr ? 'الستور المرتبط' : 'Linked store'}
                    </th>
                    <th className="py-3 px-3 font-semibold">
                      {isAr ? 'إجراءات' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="py-6 text-center text-gray-500 dark:text-gray-400">
                        {isAr ? 'جاري تحميل الحسابات...' : 'Loading accounts...'}
                      </td>
                    </tr>
                  ) : filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-6 text-center text-gray-500 dark:text-gray-400">
                        {isAr
                          ? 'لا توجد حسابات مطابقة.'
                          : 'No accounts found for current filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <tr
                        key={acc.id}
                        className="border-b border-gray-50 last:border-0 dark:border-slate-800 hover:bg-gray-50/70 dark:hover:bg-slate-800/60"
                      >
                        <td className="py-3 px-3 space-y-1">
                          <div className="font-semibold text-gray-900 dark:text-gray-50">
                            {acc.name || '—'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {acc.email}
                          </div>
                          <div className="text-[11px] text-gray-400 dark:text-gray-500">
                            {acc.date_joined
                              ? new Date(acc.date_joined).toLocaleDateString(
                                  isAr ? 'ar-EG' : 'en-EG'
                                )
                              : '—'}
                          </div>
                        </td>

                        <td className="py-3 px-3 space-y-2">
                          <RoleBadge role={acc.role} lang={lang} />
                          <select
                            value={acc.role}
                            onChange={(e) => handleRoleChange(acc, e.target.value)}
                            disabled={actionLoading === acc.id}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                          >
                            <option value="OWNER">{isAr ? 'Owner - مالك' : 'Owner'}</option>
                            <option value="MANAGER">
                              {isAr ? 'Manager - مدير' : 'Manager'}
                            </option>
                            <option value="STAFF">
                              {isAr ? 'Staff - موظف' : 'Staff'}
                            </option>
                          </select>
                        </td>

                        <td className="py-3 px-3 space-y-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] ${
                                acc.is_payment_verified
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {acc.is_payment_verified
                                ? isAr
                                  ? 'مدفوع'
                                  : 'Paid'
                                : isAr
                                  ? 'تجربة'
                                  : 'Trial'}
                            </span>
                            {!acc.has_active_access && !acc.is_payment_verified && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-100 text-red-700">
                                {isAr ? 'منتهية' : 'Expired'}
                              </span>
                            )}
                          </div>

                          {!acc.is_payment_verified && (
                            <div className="text-gray-500 dark:text-gray-400">
                              {isAr ? 'متبقي: ' : 'Remaining: '}
                              {acc.trial_days_left !== null &&
                              acc.trial_days_left !== undefined
                                ? isAr
                                  ? `${acc.trial_days_left} يوم`
                                  : `${acc.trial_days_left} days`
                                : '—'}
                            </div>
                          )}

                          {acc.access_block_reason && !acc.is_payment_verified && (
                            <div className="text-[11px] text-red-500 leading-5 dark:text-red-300">
                              {acc.access_block_reason}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleTogglePayment(acc)}
                            disabled={actionLoading === acc.id}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-gray-100"
                          >
                            {acc.is_payment_verified
                              ? isAr
                                ? 'إزالة التفعيل'
                                : 'Remove payment'
                              : isAr
                                ? 'تفعيل الدفع'
                                : 'Activate payment'}
                          </button>
                        </td>

                        <td className="py-3 px-3 space-y-2 text-xs">
                          {acc.role === 'OWNER' ? (
                            <div className="space-y-2">
                              <div className="text-gray-600 dark:text-gray-200">
                                {isAr ? 'يملك: ' : 'Owns: '}
                                {acc.owned_stores?.length || 0}{' '}
                                {isAr ? 'فروع' : 'stores'}
                              </div>
                              {acc.owned_stores?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {acc.owned_stores.map((s) => (
                                    <span
                                      key={s.id}
                                      className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-200 flex items-center gap-1"
                                    >
                                      {s.name}
                                      <button
                                        type="button"
                                        className="text-red-600 dark:text-red-400"
                                        onClick={() => handleStoreUnlink(acc, s.id)}
                                        disabled={actionLoading === acc.id}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-gray-600 dark:text-gray-200">
                                {acc.employee_store?.name ||
                                  (isAr ? 'غير مرتبط بستور' : 'No store linked')}
                              </div>
                            </div>
                          )}

                          <select
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                            defaultValue=""
                            onChange={(e) => {
                              const value = e.target.value;
                              e.target.value = '';
                              handleStoreLink(acc, value);
                            }}
                            disabled={actionLoading === acc.id}
                          >
                            <option value="">
                              {isAr ? 'اختر ستور للربط' : 'Select store to link'}
                            </option>
                            {stores.map((store) => (
                              <option key={store.id} value={store.id}>
                                {store.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 px-3 space-y-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(acc)}
                            disabled={actionLoading === acc.id}
                            className="w-full px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-gray-100"
                          >
                            {acc.is_active
                              ? isAr
                                ? 'إيقاف الحساب'
                                : 'Deactivate'
                              : isAr
                                ? 'تفعيل الحساب'
                                : 'Activate'}
                          </button>

                          {!acc.is_superuser && (
                            <button
                              type="button"
                              onClick={() => handleDelete(acc)}
                              disabled={actionLoading === acc.id}
                              className="w-full px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
                            >
                              {isAr ? 'حذف' : 'Delete'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-xs text-gray-500 leading-6 dark:text-gray-400">
              {isAr ? (
                <>
                  • يستطيع السوبر يوزر فقط التحكم في الدفع، ربط/إزالة ستور، وتفعيل/إيقاف الحسابات.
                  <br />
                  • عند إزالة التفعيل أو انتهاء التجربة المجانية سيُمنع الحساب من الوصول إلى النظام مع
                  إظهار رسالة ترقية.
                </>
              ) : (
                <>
                  • Only superusers can manage payment status, store linking, and account
                  activation.
                  <br />
                  • When access is disabled or trial expires, the user will be blocked from the
                  system with an upgrade message.
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
