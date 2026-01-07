// src/pages/Settings.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';
import BrandMark from '../components/layout/BrandMark';

// =====================
// Sidebar Navigation (نفس الداشبورد)
// =====================
function SidebarNav({ lang, current }) {
  const isAr = lang === 'ar';

  const itemClass = (path) =>
    `flex items-center px-3 py-2 rounded-xl text-sm transition ${
      current === path
        ? 'font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-slate-800'
    }`;

  return (
    <>
      <Link to="/dashboard" className={itemClass('/dashboard')}>
        {isAr ? 'الداشبورد' : 'Dashboard'}
      </Link>
      <Link to="/pos" className={itemClass('/pos')}>
        {isAr ? 'شاشة الكاشير (POS)' : 'Cashier Screen (POS)'}
      </Link>
      <Link to="/inventory" className={itemClass('/inventory')}>
        {isAr ? 'إدارة المخزون' : 'Inventory Management'}
      </Link>
      <Link to="/attendance" className={itemClass('/attendance')}>
        {isAr ? 'الحضور والانصراف' : 'Attendance'}
      </Link>
      <Link to="/reservations" className={itemClass('/reservations')}>
        {isAr ? 'الحجوزات' : 'Reservations'}
      </Link>
      <Link to="/reports" className={itemClass('/reports')}>
        {isAr ? 'التقارير' : 'Reports'}
      </Link>
      <Link to="/settings" className={itemClass('/settings')}>
        {isAr ? 'الإعدادات' : 'Settings'}
      </Link>
      <Link to="/users/create" className={itemClass('/users/create')}>
        {isAr ? 'إدارة المستخدمين' : 'User Management'}
      </Link>
    </>
  );
}

export default function SettingsPage() {
  // theme & language (نفس الداشبورد)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ar');
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

  // =================
  // Original states
  // =================
  const [loading, setLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [savingStoreSettings, setSavingStoreSettings] = useState(false);
  const [savingPaymob, setSavingPaymob] = useState(false);
  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);

  const [activeTab, setActiveTab] = useState('store'); // 'store' | 'paymob' | 'loyalty'

  const [store, setStore] = useState(null);
  const [storeForm, setStoreForm] = useState({ name: '', address: '', phone: '' });

  const [storeSettings, setStoreSettings] = useState({
    loyalty_enabled: false,
    allow_negative_stock: false,
    allow_order_without_stock: true,
    tax_rate: 14,
    service_charge: 0,
    printer_ip: '',
    printer_port: '',
    attendance_penalty_per_15min: 0,
  });

  const [paymob, setPaymob] = useState({
    enabled: false,
    api_key: '',
    iframe_id: '',
    integration_id_card: '',
    integration_id_wallet: '',
    hmac_secret: '',
    sandbox_mode: true,
  });

  const [loyalty, setLoyalty] = useState({
    is_active: false,
    points_per_egp: 1,
    egp_per_point: 1,
    min_points_to_redeem: 50,
    expiry_months: '',
  });

  const [attendanceQRs, _setAttendanceQRs] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [branchForm, setBranchForm] = useState({
    name: '',
    phone: '',
    address: '',
    is_active: true,
    attendance_penalty_per_15min: '',
  });
  const storeMenuUrl = useMemo(
    () => (store?.id ? `${window.location.origin}/store/${store.id}/menu` : ''),
    [store]
  );
  const branchMenuUrl = useCallback(
    (branchId) =>
      store?.id ? `${window.location.origin}/store/${store.id}/menu/?branch=${branchId}` : '',
    [store]
  );
  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === String(selectedBranchId)) || null,
    [branches, selectedBranchId]
  );
  const tableMenuTemplate = useMemo(
    () => (store?.id ? `${window.location.origin}/table/{table_id}/menu` : ''),
    [store]
  );

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    notifySuccess(msg);
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  const copyValue = useCallback(
    async (value, label) => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        notifySuccess(label || (isAr ? 'تم النسخ' : 'Copied'));
      } catch (err) {
        notifyError(isAr ? 'تعذر النسخ إلى الحافظة' : 'Could not copy to clipboard');
        console.error('Copy failed', err);
      }
    },
    [isAr]
  );

  const fetchAttendanceQRs = useCallback(async () => {
    // ✅ تم إيقافه لأن النظام أصبح QR موحّد للفرع (Store-level)
    // endpoint القديم /employees/attendance_qr_list/ كان للـ QR لكل موظف وبيسبب 500
    return;

    // try {
    //   const res = await api.get('/employees/attendance_qr_list/');
    //   setAttendanceQRs(res.data || []);
    // } catch (err) {
    //   console.error('خطأ في تحميل QR الحضور والانصراف:', err);
    // }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [storeRes, settingsRes, loyaltyRes] = await Promise.all([
        api.get('/stores/'),
        api.get('/store-settings/current/'),
        api.get('/loyalty/program/current/'),
      ]);

      const storeList = Array.isArray(storeRes.data)
        ? storeRes.data
        : storeRes.data.results || [];

      const currentStore = storeList[0] || null;
      setStore(currentStore);

      if (currentStore) {
        setStoreForm({
          name: currentStore.name || '',
          address: currentStore.address || '',          
          phone: currentStore.phone || '',
        });

        const keys = currentStore.paymob_keys || {};
        setPaymob({
          enabled: keys.enabled ?? false,
          api_key: keys.api_key || '',
          iframe_id: keys.iframe_id || '',
          integration_id_card: keys.integration_id_card || '',          
          integration_id_wallet: keys.integration_id_wallet || '',
          hmac_secret: keys.hmac_secret || '',
          sandbox_mode: keys.sandbox_mode ?? true,
        });

        try {
          const branchesRes = await api.get('/branches/');
          const branchData = branchesRes.data;
          const list = Array.isArray(branchData)
            ? branchData
            : Array.isArray(branchData?.results)
              ? branchData.results
              : [];

          setBranches(list);

          if (list.length && !selectedBranchId) {
            setSelectedBranchId(String(list[0].id));
          }
        } catch (branchErr) {
          console.error('خطأ في تحميل الفروع:', branchErr);
          setBranches([]);
        }        
      }

      setStoreSettings({
        loyalty_enabled: settingsRes.data.loyalty_enabled,
        allow_negative_stock: settingsRes.data.allow_negative_stock,        
        allow_order_without_stock: settingsRes.data.allow_order_without_stock,
        tax_rate: settingsRes.data.tax_rate,
        service_charge: settingsRes.data.service_charge,
        printer_ip: settingsRes.data.printer_ip || '',
        printer_port: settingsRes.data.printer_port || '',
        attendance_penalty_per_15min: settingsRes.data.attendance_penalty_per_15min ?? 0,
      });
      
      setLoyalty({
        is_active: loyaltyRes.data.is_active,
        points_per_egp: loyaltyRes.data.points_per_egp,
        egp_per_point: loyaltyRes.data.egp_per_point,
        min_points_to_redeem: loyaltyRes.data.min_points_to_redeem,
        expiry_months: loyaltyRes.data.expiry_months ?? '',
      });
    } catch (err) {
      console.error('خطأ في تحميل إعدادات النظام:', err);
      const msg =
        err.response?.data?.detail ||
        (isAr
          ? 'حدث خطأ أثناء تحميل إعدادات النظام. تأكد من تسجيل الدخول وصلاحيات الحساب.'
          : 'Error loading settings. Please check your login and permissions.');
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAr, selectedBranchId]);

  useEffect(() => {
    fetchAll();
    // ✅ QR موحّد للفرع موجود داخل store => مش محتاجين endpoint attendance_qr_list
    // fetchAttendanceQRs();
  }, [fetchAll, fetchAttendanceQRs]);

  useEffect(() => {
    if (!selectedBranch) {
      setBranchForm({
        name: '',
        phone: '',
        address: '',
        is_active: true,
        attendance_penalty_per_15min: '',
      });
      return;
    }

    setBranchForm({
      name: selectedBranch.name || '',
      phone: selectedBranch.phone || '',
      address: selectedBranch.address || '',
      is_active: selectedBranch.is_active ?? true,
      attendance_penalty_per_15min: selectedBranch.attendance_penalty_per_15min ?? '',
    });
  }, [selectedBranch]);

  // ====== Handlers ======
  const handleStoreChange = (e) => {
    const { name, value } = e.target;
    setStoreForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleStoreSettingsChange = (e) => {
    const { name, type, checked, value } = e.target;
    setStoreSettings((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePaymobChange = (e) => {
    const { name, type, checked, value } = e.target;
    setPaymob((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleLoyaltyChange = (e) => {
    const { name, type, checked, value } = e.target;
    setLoyalty((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  const handleBranchSelect = (e) => {
    setSelectedBranchId(e.target.value);
  };

  const handleBranchChange = (e) => {
    const { name, type, checked, value } = e.target;
    setBranchForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ====== Save actions ======
  const saveStoreInfo = async (e) => {
    e?.preventDefault();
    if (!store) return;

    try {
      setSavingStore(true);
      setError(null);

      await api.patch(`/stores/${store.id}/`, {
        name: storeForm.name,
        address: storeForm.address,
        phone: storeForm.phone,
      });

      showSuccess(isAr ? 'تم حفظ بيانات المتجر بنجاح.' : 'Store info saved successfully.');
      await fetchAll();
    } catch (err) {
      console.error('خطأ في حفظ بيانات المتجر:', err);
      const msg =
        err.response?.data?.detail ||
        (isAr ? 'حدث خطأ أثناء حفظ بيانات المتجر.' : 'Failed to save store info.');
      setError(msg);
      notifyError(msg);
    } finally {
      setSavingStore(false);
    }
  };

  const saveStoreSettings = async (e) => {
    e?.preventDefault();
    try {
      setSavingStoreSettings(true);
      setError(null);

      await api.patch('/store-settings/current/', { ...storeSettings });

      showSuccess(isAr ? 'تم حفظ إعدادات الفرع بنجاح.' : 'Store settings saved successfully.');
      await fetchAll();
    } catch (err) {
      console.error('خطأ في حفظ إعدادات الفرع:', err);
      const msg =
        err.response?.data?.detail ||
        (isAr ? 'حدث خطأ أثناء حفظ إعدادات الفرع.' : 'Failed to save store settings.');
      setError(msg);
      notifyError(msg);
    } finally {
      setSavingStoreSettings(false);
    }
  };

  const savePaymobSettings = async (e) => {
    e?.preventDefault();
    if (!store) return;

    try {
      setSavingPaymob(true);
      setError(null);

      await api.patch(`/stores/${store.id}/`, { paymob_keys: paymob });

      showSuccess(isAr ? 'تم حفظ إعدادات PayMob بنجاح.' : 'PayMob settings saved successfully.');
      await fetchAll();
    } catch (err) {
      console.error('خطأ في حفظ إعدادات PayMob:', err);
      const msg =
        err.response?.data?.paymob_keys?.[0] ||
        err.response?.data?.detail ||
        (isAr ? 'حدث خطأ أثناء حفظ إعدادات بوابة الدفع.' : 'Failed to save payment settings.');
      setError(msg);
      notifyError(msg);
    } finally {
      setSavingPaymob(false);
    }
  };

  const saveLoyaltySettings = async (e) => {
    e?.preventDefault();

    try {
      setSavingLoyalty(true);      
      setError(null);

      await api.patch('/loyalty/program/current/', {
        is_active: loyalty.is_active,
        points_per_egp: loyalty.points_per_egp,
        egp_per_point: loyalty.egp_per_point,
        min_points_to_redeem: loyalty.min_points_to_redeem,
        expiry_months: loyalty.expiry_months === '' ? null : loyalty.expiry_months,
      });

      showSuccess(isAr ? 'تم حفظ إعدادات برنامج الولاء بنجاح.' : 'Loyalty settings saved successfully.');
      await fetchAll();
    } catch (err) {
      console.error('خطأ في حفظ إعدادات الولاء:', err);
      const msg =
        err.response?.data?.detail ||
        (isAr ? 'حدث خطأ أثناء حفظ إعدادات برنامج الولاء.' : 'Failed to save loyalty settings.');
      setError(msg);
      notifyError(msg);
    } finally {
      setSavingLoyalty(false);
    }
  };
  const saveBranchSettings = async (e) => {
    e?.preventDefault();
    if (!selectedBranch) return;

    try {
      setSavingBranch(true);
      setError(null);

      await api.patch(`/branches/${selectedBranch.id}/`, {
        name: branchForm.name,
        phone: branchForm.phone,
        address: branchForm.address,
        is_active: branchForm.is_active,
        attendance_penalty_per_15min:
          branchForm.attendance_penalty_per_15min === ''
            ? null
            : Number(branchForm.attendance_penalty_per_15min),
      });

      showSuccess(isAr ? 'تم حفظ إعدادات الفرع بنجاح.' : 'Branch settings saved successfully.');
      await fetchAll();
    } catch (err) {
      console.error('خطأ في حفظ إعدادات الفرع:', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.name?.[0] ||
        (isAr ? 'حدث خطأ أثناء حفظ إعدادات الفرع.' : 'Failed to save branch settings.');
      setError(msg);
      notifyError(msg);
    } finally {
      setSavingBranch(false);
    }
  };

  const tabs = [
    { id: 'store', label: isAr ? 'معلومات المتجر' : 'Store info' },
    { id: 'branches', label: isAr ? 'إعدادات الفروع' : 'Branch settings' },
    { id: 'paymob', label: isAr ? 'إعدادات PayMob' : 'PayMob' },
    { id: 'loyalty', label: isAr ? 'برنامج الولاء' : 'Loyalty' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <BrandMark subtitle={isAr ? 'إعدادات النظام' : 'System settings'} />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} current="/settings" />
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
                <BrandMark variant="mobile" subtitle={isAr ? 'القائمة الرئيسية' : 'Main Menu'} />                
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
                <SidebarNav lang={lang} current="/settings" />
              </nav>

              <div className="px-4 py-3 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
                {isAr ? 'تم تطوير هذا السيستم بواسطة كريتفيتي كود' : 'تم تطوير هذا السيستم بواسطة كريتفيتي كود'}
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
                  {isAr ? 'الإعدادات' : 'Settings'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr
                    ? 'تحكم في بيانات المتجر، بوابة الدفع، وبرنامج الولاء من مكان واحد'
                    : 'Manage store info, payment gateway, and loyalty program in one place'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Language */}
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

              {/* Theme */}
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

              {/* User */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  O
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    Owner
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {isAr ? 'مدير النظام' : 'System admin'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-4 max-w-6xl mx-auto w-full">
            {/* Alerts */}
            {loading && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                {isAr ? 'جاري تحميل الإعدادات...' : 'Loading settings...'}
              </div>
            )}

            {error && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-2xl dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-100">
                {successMessage}
              </div>
            )}

            {/* Tabs */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-2 flex gap-2 text-xs md:text-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-2 rounded-xl text-center transition ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-slate-950 dark:text-gray-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Panels */}
            {!loading && (
              <>
                {activeTab === 'store' && (
                  <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 md:p-5 space-y-4">                    
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? 'معلومات المتجر وإعدادات الفواتير' : 'Store info & invoice settings'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr
                          ? 'حدّث بيانات الفرع، وسلوك الفاتورة (ضريبة / خدمة / بيع بدون مخزون).'
                          : 'Update branch info and invoice behavior (tax/service/selling without stock).'}
                      </p>
                    </div>

                    <form onSubmit={saveStoreInfo} className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'اسم الفرع' : 'Store name'}
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={storeForm.name}
                          onChange={handleStoreChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          placeholder={isAr ? 'مثال: الفرع الرئيسي' : 'e.g. Main branch'}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'رقم الهاتف / الواتساب' : 'Phone / WhatsApp'}
                        </label>
                        <input
                          type="text"
                          name="phone"
                          value={storeForm.phone}
                          onChange={handleStoreChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          placeholder={isAr ? 'مثال: 0100 000 0000' : 'e.g. +2010...'}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'العنوان التفصيلي' : 'Address'}
                        </label>
                        <textarea
                          name="address"
                          value={storeForm.address}
                          onChange={handleStoreChange}
                          rows={2}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          placeholder={isAr ? 'مثال: شارع ....، بجوار ....' : 'Street, area, landmark...'}
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end gap-2">
                        <button
                          type="submit"
                          disabled={savingStore}
                          className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {savingStore ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ بيانات المتجر' : 'Save store info')}
                        </button>
                      </div>
                    </form>

                    {/* QR Codes */}
                    <div className="grid gap-3 md:grid-cols-2">
                      {store?.qr_menu_base64 && (
                        <div className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-4">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                            {isAr ? 'QR منيو الفرع' : 'Store menu QR'}
                          </p>                          
                          <img
                            alt="Store Menu QR"
                            className="w-40 h-40 rounded-xl border border-gray-200 dark:border-slate-700 bg-white"
                            src={`data:image/png;base64,${store.qr_menu_base64}`}
                          />
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                            {isAr
                              ? 'امسح الكود لفتح منيو الطلبات العامة للفرع.'
                              : 'Scan to open the public store menu.'}
                          </p>
                          {storeMenuUrl && (
                            <div className="mt-3 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                                <span className="truncate">{storeMenuUrl}</span>
                                <button
                                  type="button"
                                  onClick={() => copyValue(storeMenuUrl, isAr ? 'تم نسخ رابط المنيو' : 'Menu link copied')}
                                  className="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                                >
                                  {isAr ? 'نسخ' : 'Copy'}
                                </button>
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isAr
                                  ? 'قالب رابط منيو الطاولة (استبدل {table_id} برقم الطاولة):'
                                  : 'Table menu link template (replace {table_id}):'}
                              </p>
                              <div className="text-[11px] font-mono bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg px-2 py-1">
                                {tableMenuTemplate}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Store Attendance QR (موحّد للحضور والانصراف) */}
                      {store?.qr_attendance_base64 && (
                        <div className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-4">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                            {isAr ? 'QR تسجيل الحضور والانصراف (موحّد للفرع)' : 'Store Attendance QR (Unified)'}
                          </p>

                          <img
                            alt="Store Attendance QR"
                            className="w-40 h-40 rounded-xl border border-gray-200 dark:border-slate-700 bg-white"
                            src={`data:image/png;base64,${store.qr_attendance_base64}`}
                          />

                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                            {isAr
                              ? 'يتم طباعة هذا الكود ووضعه عند مدخل الفرع. الموظف يفتح شاشة الحضور ويصوّر الكود لتسجيل دخول أو انصراف.'
                              : 'Print this QR and place it at the store entrance. Staff scans it from the attendance screen to check in/out.'}
                          </p>
                        </div>
                      )}


                      {attendanceQRs?.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                            {isAr ? 'QR الحضور والانصراف' : 'Attendance QR'}
                          </p>                          
                          <div className="grid gap-2 grid-cols-2">
                            {attendanceQRs.slice(0, 4).map((row) => (
                              <div
                                key={row.id}
                                className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-2"
                              >
                                <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate mb-1">
                                  {row.name}
                                </p>
                                {row.qr_code_attendance_base64 ? (
                                  <img
                                    alt="Attendance QR"
                                    className="w-28 h-28 rounded-xl border border-gray-200 dark:border-slate-700 bg-white"
                                    src={`data:image/png;base64,${row.qr_code_attendance_base64}`}
                                  />
                                ) : (
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                    {isAr ? 'لا يوجد QR بعد' : 'No QR yet'}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                          {attendanceQRs.length > 4 && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                              {isAr
                                ? '* يتم عرض أول 4 موظفين هنا. يمكننا إضافة زر “عرض الكل / طباعة” لاحقًا.'
                                : '* Showing first 4 employees. We can add “View all / Print” later.'}
                            </p>
                          )}
                        </div>
                      )}

                      {branches?.length > 0 && (
                        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                {isAr ? 'أكواد QR لفروع المتجر' : 'Branches menu QR codes'}
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isAr
                                  ? 'كل كود يفتح منيو الطلبات الخاصة بالفرع المحدد.'
                                  : 'Each QR opens the menu for its specific branch.'}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {branches.map((branch) => {
                              const url = branchMenuUrl(branch.id);
                              return (
                                <div
                                  key={branch.id}
                                  className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                                      {branch.name}
                                    </p>
                                    {branch.is_active === false && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-gray-300">
                                        {isAr ? 'متوقف' : 'Inactive'}
                                      </span>
                                    )}
                                  </div>

                                  {branch.qr_menu_base64 ? (
                                    <img
                                      alt={branch.name}
                                      className="w-32 h-32 rounded-xl border border-gray-200 dark:border-slate-700 bg-white"
                                      src={`data:image/png;base64,${branch.qr_menu_base64}`}
                                    />
                                  ) : (
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                      {isAr ? 'لم يتم إنشاء QR بعد.' : 'QR not generated yet.'}
                                    </p>
                                  )}

                                  <div className="flex items-center justify-between gap-2 text-[11px] text-gray-700 dark:text-gray-200">
                                    <span className="truncate">{url}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copyValue(url, isAr ? 'تم نسخ رابط منيو الفرع' : 'Branch menu link copied')
                                      }
                                      className="px-2 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                                    >
                                      {isAr ? 'نسخ' : 'Copy'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* مشاركة الروابط والـ QR */}
                    <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                            {isAr ? 'المشاركة' : 'Sharing'}
                          </h4>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {isAr
                              ? 'انسخ روابط المنيو واطبع كود الـ QR لمشاركتها مع العملاء.'
                              : 'Copy menu links and share the QR code with customers.'}
                          </p>
                        </div>
                        {store?.qr_menu_base64 && (
                          <img
                            alt="Store Menu QR"
                            className="w-16 h-16 rounded-lg border border-gray-200 dark:border-slate-700 bg-white"
                            src={`data:image/png;base64,${store.qr_menu_base64}`}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-700 dark:text-gray-200">
                          <span className="truncate">{storeMenuUrl}</span>
                          <button
                            type="button"
                            onClick={() => copyValue(storeMenuUrl, isAr ? 'تم نسخ رابط المنيو' : 'Menu link copied')}
                            className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                          >
                            {isAr ? 'نسخ' : 'Copy'}
                          </button>
                        </div>
                        <div className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                          <span className="font-semibold">{isAr ? 'قالب منيو الطاولة:' : 'Table menu template:'}</span>
                          <span className="font-mono bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg px-2 py-1 break-all">
                            {tableMenuTemplate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <hr className="my-3 border-gray-100 dark:border-slate-800" />
                    <form onSubmit={saveStoreSettings} className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'نسبة الضريبة %' : 'Tax rate %'}
                        </label>
                        <input
                          type="number"
                          name="tax_rate"
                          value={storeSettings.tax_rate}
                          onChange={handleStoreSettingsChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'مصاريف الخدمة %' : 'Service charge %'}
                        </label>
                        <input                        
                          type="number"
                          name="service_charge"
                          value={storeSettings.service_charge}
                          onChange={handleStoreSettingsChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'غرامة التأخير لكل 15 دقيقة' : 'Late penalty per 15 minutes'}
                        </label>
                        <input
                          type="number"
                          name="attendance_penalty_per_15min"
                          value={storeSettings.attendance_penalty_per_15min}
                          onChange={handleStoreSettingsChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          step="0.01"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id="allow_order_without_stock"
                          type="checkbox"
                          name="allow_order_without_stock"
                          checked={storeSettings.allow_order_without_stock}
                          onChange={handleStoreSettingsChange}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="allow_order_without_stock" className="text-sm text-gray-700 dark:text-gray-200">
                          {isAr
                            ? 'السماح ببيع أصناف غير متوفرة في المخزون (مع تحذير).'
                            : 'Allow selling out-of-stock items (with warning).'}
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id="allow_negative_stock"
                          type="checkbox"
                          name="allow_negative_stock"
                          checked={storeSettings.allow_negative_stock}
                          onChange={handleStoreSettingsChange}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="allow_negative_stock" className="text-sm text-gray-700 dark:text-gray-200">
                          {isAr
                            ? 'السماح بالمخزون السالب (للطوارئ فقط – غير مفضل).'
                            : 'Allow negative stock (emergency only).'}
                        </label>
                      </div>

                      <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                            {isAr ? 'IP الطابعة الحرارية (اختياري)' : 'Printer IP (optional)'}
                          </label>
                          <input
                            type="text"
                            name="printer_ip"
                            value={storeSettings.printer_ip}
                            onChange={handleStoreSettingsChange}
                            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                            placeholder="192.168.1.50"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                            {isAr ? 'Port الطابعة (اختياري)' : 'Printer port (optional)'}
                          </label>
                          <input
                            type="number"
                            name="printer_port"
                            value={storeSettings.printer_port || ''}
                            onChange={handleStoreSettingsChange}
                            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                            placeholder="9100"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2 flex justify-end gap-2">
                        <button
                          type="submit"
                          disabled={savingStoreSettings}
                          className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {savingStoreSettings ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ إعدادات الفرع' : 'Save store settings')}
                        </button>
                      </div>
                    </form>
                  </section>
                )}
                {activeTab === 'branches' && (
                  <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 md:p-5 space-y-5">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {isAr ? 'إعدادات الفروع' : 'Branch settings'}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                          {isAr
                            ? 'اختر الفرع وحدّث بياناته، حالة التفعيل، ورابط المنيو أو كود الـ QR.'
                            : 'Choose a branch to update its data, status, and menu link / QR code.'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 md:items-end">
                        <label className="text-[11px] text-gray-600 dark:text-gray-300">
                          {isAr ? 'اختر الفرع' : 'Select branch'}
                        </label>
                        <select
                          value={selectedBranchId}
                          onChange={handleBranchSelect}
                          className="w-full md:w-64 text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                        >
                          <option value="">{isAr ? 'اختر فرعًا' : 'Select a branch'}</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {!selectedBranch && (
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                        {isAr
                          ? 'اختر فرعًا من القائمة لمعاينة بياناته وتعديلها.'
                          : 'Select a branch to view and edit its settings.'}
                      </div>
                    )}

                    {selectedBranch && (
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="md:col-span-2 space-y-4">
                          <form onSubmit={saveBranchSettings} className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                                {isAr ? 'اسم الفرع' : 'Branch name'}
                              </label>
                              <input
                                type="text"
                                name="name"
                                value={branchForm.name}
                                onChange={handleBranchChange}
                                className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                                {isAr ? 'الهاتف / الواتساب' : 'Phone / WhatsApp'}
                              </label>
                              <input                              
                                type="text"
                                name="phone"
                                value={branchForm.phone}
                                onChange={handleBranchChange}
                                className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                                {isAr ? 'غرامة التأخير لكل 15 دقيقة' : 'Late penalty per 15 minutes'}
                              </label>
                              <input
                                type="number"
                                name="attendance_penalty_per_15min"
                                value={branchForm.attendance_penalty_per_15min}
                                onChange={handleBranchChange}
                                className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                                step="0.01"
                              />
                            </div>                            
                            <div className="md:col-span-2">
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                                {isAr ? 'العنوان' : 'Address'}
                              </label>
                              <textarea
                                name="address"
                                rows={2}
                                value={branchForm.address}
                                onChange={handleBranchChange}
                                className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                              />
                            </div>
                            <div className="md:col-span-2 flex items-center gap-2">
                              <input
                                id="branch_is_active"
                                type="checkbox"
                                name="is_active"
                                checked={branchForm.is_active}
                                onChange={handleBranchChange}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor="branch_is_active" className="text-sm text-gray-700 dark:text-gray-200">
                                {isAr ? 'تفعيل الفرع' : 'Activate branch'}
                              </label>
                            </div>

                            <div className="md:col-span-2 flex justify-end gap-2">
                              <button
                                type="submit"
                                disabled={savingBranch}
                                className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {savingBranch ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ إعدادات الفرع' : 'Save branch settings')}
                              </button>
                            </div>
                          </form>
                        </div>

                        <div className="space-y-3">
                          <div className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-3">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                              {isAr ? 'رابط المنيو' : 'Menu link'}
                            </p>
                            <div className="text-[11px] text-gray-700 dark:text-gray-200 break-all">
                              {branchMenuUrl(selectedBranch.id)}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                copyValue(
                                  branchMenuUrl(selectedBranch.id),
                                  isAr ? 'تم نسخ رابط منيو الفرع' : 'Branch menu link copied'
                                )
                              }
                              className="mt-2 w-full text-sm px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                            >
                              {isAr ? 'نسخ الرابط' : 'Copy link'}
                            </button>
                          </div>

                          <div className="bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                {isAr ? 'QR كود الفرع' : 'Branch QR'}
                              </p>
                              {selectedBranch.is_active === false && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-gray-300">
                                  {isAr ? 'متوقف' : 'Inactive'}
                                </span>
                              )}
                            </div>

                            {selectedBranch.qr_menu_base64 ? (
                              <img
                                alt={selectedBranch.name}
                                className="w-40 h-40 rounded-xl border border-gray-200 dark:border-slate-700 bg-white mx-auto"
                                src={`data:image/png;base64,${selectedBranch.qr_menu_base64}`}
                              />
                            ) : (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isAr ? 'لا يوجد QR متاح لهذا الفرع بعد.' : 'No QR available yet for this branch.'}
                              </p>
                            )}

                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {isAr
                                ? 'انسخ الرابط أو اطبع الكود لمشاركته مع العملاء لهذا الفرع فقط.'
                                : 'Copy the link or print the QR to share this branch only.'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}
                {activeTab === 'paymob' && (
                  <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 md:p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? 'إعدادات بوابة الدفع PayMob' : 'PayMob settings'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr
                          ? 'فعّل/عطّل PayMob لكل فرع. لو فعلته لازم تدخل بيانات الحساب كاملة.'
                          : 'Enable/disable PayMob per store. If enabled, you must fill required fields.'}
                      </p>
                    </div>

                    <form onSubmit={savePaymobSettings} className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2 flex items-center gap-2">
                        <input
                          id="paymob_enabled"
                          type="checkbox"
                          name="enabled"
                          checked={paymob.enabled}
                          onChange={handlePaymobChange}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="paymob_enabled" className="text-sm text-gray-700 dark:text-gray-200 font-semibold">
                          {isAr ? 'تفعيل الدفع عبر PayMob لهذا الفرع' : 'Enable PayMob for this store'}
                        </label>
                      </div>

                      {paymob.enabled && (
                        <div className="md:col-span-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-xl dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-100">
                          {isAr
                            ? '⚠️ مهم: لازم تعطّل وضع الاختبار (Sandbox) وتستخدم بيانات الحساب الحقيقي Live عشان عمليات الدفع تشتغل فعليًا.'
                            : '⚠️ Important: Disable Sandbox and use Live credentials for real payments.'}
                        </div>
                      )}

                      {paymob.enabled && (
                        <>
                          <div className="md:col-span-2">
                            <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                              API Key
                            </label>
                            <input
                              type="text"
                              name="api_key"
                              value={paymob.api_key}
                              onChange={handlePaymobChange}
                              className="w-full text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                              placeholder="PayMob API Key"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                              Iframe ID
                            </label>
                            <input
                              type="text"
                              name="iframe_id"
                              value={paymob.iframe_id}
                              onChange={handlePaymobChange}
                              className="w-full text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                              Integration ID (Card)
                            </label>
                            <input
                              type="text"
                              name="integration_id_card"
                              value={paymob.integration_id_card}
                              onChange={handlePaymobChange}
                              className="w-full text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                              Integration ID (Wallet) (optional)
                            </label>
                            <input
                              type="text"
                              name="integration_id_wallet"
                              value={paymob.integration_id_wallet}
                              onChange={handlePaymobChange}
                              className="w-full text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                              HMAC Secret
                            </label>
                            <input
                              type="text"
                              name="hmac_secret"
                              value={paymob.hmac_secret}
                              onChange={handlePaymobChange}
                              className="w-full text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                            />
                          </div>

                          <div className="md:col-span-2 flex items-center gap-2">
                            <input
                              id="sandbox_mode"
                              type="checkbox"
                              name="sandbox_mode"
                              checked={paymob.sandbox_mode}
                              onChange={handlePaymobChange}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="sandbox_mode" className="text-sm text-gray-700 dark:text-gray-200">
                              {isAr ? 'استخدام وضع الاختبار (Sandbox)' : 'Use Sandbox mode'}
                            </label>
                          </div>
                        </>
                      )}

                      <div className="md:col-span-2 flex justify-end gap-2">
                        <button
                          type="submit"
                          disabled={savingPaymob}
                          className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {savingPaymob ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ إعدادات PayMob' : 'Save PayMob')}
                        </button>
                      </div>
                    </form>

                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {isAr
                        ? '* لاحقًا: هنضيف زر "اختبار الاتصال بـ PayMob" للتأكد من صحة البيانات تلقائيًا.'
                        : '* Coming soon: “Test PayMob connection” button.'}
                    </p>
                  </section>
                )}

                {activeTab === 'loyalty' && (
                  <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 md:p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? 'إعدادات برنامج الولاء (Loyalty)' : 'Loyalty program'}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr
                          ? 'فعّل برنامج الولاء وحدّد قواعد تجميع واستبدال النقاط للعملاء.'
                          : 'Enable the loyalty program and define points rules.'}
                      </p>
                    </div>

                    <form onSubmit={saveLoyaltySettings} className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2 flex items-center gap-2">
                        <input
                          id="is_active"
                          type="checkbox"
                          name="is_active"
                          checked={loyalty.is_active}
                          onChange={handleLoyaltyChange}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-200 font-semibold">
                          {isAr ? 'تفعيل برنامج الولاء للعملاء' : 'Enable loyalty program'}
                        </label>
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'كل كام جنيه = نقطة واحدة؟' : 'How many EGP per point?'}
                        </label>
                        <input
                          type="number"
                          name="points_per_egp"
                          value={loyalty.points_per_egp}
                          onChange={handleLoyaltyChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'قيمة النقطة بالجنيه' : 'EGP per point'}
                        </label>
                        <input
                          type="number"
                          name="egp_per_point"
                          value={loyalty.egp_per_point}
                          onChange={handleLoyaltyChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'أقل عدد نقاط للاستبدال' : 'Min points to redeem'}
                        </label>
                        <input
                          type="number"
                          name="min_points_to_redeem"
                          value={loyalty.min_points_to_redeem}
                          onChange={handleLoyaltyChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                          {isAr ? 'مدة صلاحية النقاط (بالشهور)' : 'Points expiry (months)'}
                        </label>
                        <input
                          type="number"
                          name="expiry_months"
                          value={loyalty.expiry_months}
                          onChange={handleLoyaltyChange}
                          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                          placeholder={isAr ? 'اتركه فارغًا = لا تنتهي' : 'Empty = no expiry'}
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end gap-2">
                        <button
                          type="submit"
                          disabled={savingLoyalty}
                          className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {savingLoyalty ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ إعدادات الولاء' : 'Save loyalty')}
                        </button>
                      </div>
                    </form>

                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {isAr
                        ? '* لاحقًا: Dashboard لعرض أفضل العملاء بالنقاط + حركة نقاط تفصيلية.'
                        : '* Coming soon: dashboard for top customers & points history.'}
                    </p>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}