// src/pages/StoreMenu.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';

// =====================
// Sidebar Navigation (نفس الداشبورد)
// =====================
function SidebarNav({ lang, current }) {
  const isAr = lang === 'ar';

  const itemClass = (path) =>
    `flex items-center justify-between px-3 py-2 rounded-xl text-sm transition ${
      current === path
        ? 'font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-slate-800'
    }`;

  return (
    <>
      <Link to="/dashboard" className={itemClass('/dashboard')}>
        <span>{isAr ? 'الداشبورد' : 'Dashboard'}</span>
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

export default function StoreMenu() {
  const { storeId } = useParams();

  // ============ Theme & Lang (نفس الداشبورد) ============
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'ar'
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAr = lang === 'ar';

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG'),
    [isAr]
  );

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

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  // ============ State الأساسي ============
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [orderType, setOrderType] = useState('IN_STORE'); // IN_STORE | DELIVERY
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH | PAYMOB
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);

  // ============ Fetch menu from API ============
  const fetchMenu = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get(`/orders/public/store/${storeId}/menu/`);
      setStore(res.data.store);
      setItems(res.data.items || []);
    } catch (err) {
      console.error('خطأ في تحميل منيو الفرع:', err);
      const msg = isAr
        ? 'حدث خطأ أثناء تحميل قائمة الفرع، برجاء المحاولة لاحقًا.'
        : 'An error occurred while loading the store menu. Please try again later.';
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  }, [storeId, isAr]);

  useEffect(() => {
    if (storeId) fetchMenu();
  }, [storeId, fetchMenu]);

  // ✅ لو PayMob مش enabled رجع CASH تلقائي
  useEffect(() => {
    if (store && !store.paymob_enabled && paymentMethod === 'PAYMOB') {
      setPaymentMethod('CASH');
      notifyError(isAr ? 'PayMob غير متاح لهذا الفرع.' : 'PayMob is not available for this store.');
    }
  }, [store, paymentMethod, isAr]);

  // ============ التصنيفات ============
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category_name) set.add(item.category_name);
    });
    return Array.from(set);
  }, [items]);

  // ============ فلترة ============
  const filteredItems = useMemo(() => {
    let list = items;

    if (selectedCategory !== 'ALL') {
      list = list.filter(
        (item) =>
          item.category_name === selectedCategory ||
          item.category_id === selectedCategory
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q))
      );
    }

    return list;
  }, [items, selectedCategory, searchTerm]);

  // ============ إدارة السلة ============
  const handleAddToCart = (item) => {
    const price = Number(item.unit_price || 0);

    setCart((prev) => {
      const existing = prev.find((row) => row.itemId === item.id);
      if (existing) {
        return prev.map((row) =>
          row.itemId === item.id
            ? {
                ...row,
                quantity: row.quantity + 1,
                subtotal: (row.quantity + 1) * row.unitPrice,
              }
            : row
        );
      }

      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          unitPrice: price,
          quantity: 1,
          subtotal: price,
        },
      ];
    });
  };

  const handleChangeQuantity = (itemId, delta) => {
    setCart((prev) =>
      prev
        .map((row) => {
          if (row.itemId !== itemId) return row;
          const newQty = row.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...row,
            quantity: newQty,
            subtotal: newQty * row.unitPrice,
          };
        })
        .filter(Boolean)
    );
  };

  const handleClearCart = () => {
    setCart([]);
    setNotes('');
    setDeliveryAddress('');
    setSuccessOrder(null);
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, row) => sum + row.subtotal, 0),
    [cart]
  );
  const total = subtotal;

  // ============ إرسال الطلب ============
  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      notifyError(
        isAr
          ? 'السلة فارغة، أضف منتج واحد على الأقل قبل الإرسال.'
          : 'Your cart is empty. Please add at least one item before sending the order.'
      );
      return;
    }

    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      notifyError(
        isAr ? 'برجاء إدخال عنوان التوصيل.' : 'Please enter delivery address.'
      );
      return;
    }

    // ✅ حماية إضافية: منع PAYMOB لو مش enabled
    if (paymentMethod === 'PAYMOB' && !store?.paymob_enabled) {
      notifyError(isAr ? 'PayMob غير متاح لهذا الفرع.' : 'PayMob is not available for this store.');
      setPaymentMethod('CASH');
      return;
    }

    setSubmitting(true);
    setSuccessOrder(null);

    try {
      const payload = {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        notes,
        order_type: orderType,
        payment_method: paymentMethod,
        delivery_address:
          orderType === 'DELIVERY' ? deliveryAddress.trim() : null,
        items: cart.map((row) => ({
          item: row.itemId,
          quantity: row.quantity,
        })),
      };

      const res = await api.post(
        `/orders/public/store/${storeId}/order/`,
        payload
      );

      setSuccessOrder(res.data);
      handleClearCart();

      notifySuccess(
        isAr
          ? `تم إرسال الطلب بنجاح! رقم الطلب #${res.data.id}`
          : `Order sent successfully! Order #${res.data.id}`
      );

      // ⚠️ مبدئيًا، الدفع عبر PayMob هيكون خطوة منفصلة قدام
    } catch (err) {
      console.error('خطأ في إرسال الطلب:', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        (isAr
          ? 'حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى.'
          : 'An error occurred while sending the order. Please try again.');
      notifyError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ============ Screens: Loading / Error ============
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <p className="text-sm text-gray-500 dark:text-gray-300">
          {isAr ? 'جاري تحميل منيو الفرع...' : 'Loading store menu...'}
        </p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-slate-950"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-red-100 dark:border-red-800 p-6 max-w-sm text-center">
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            {error ||
              (isAr
                ? 'الرابط غير صالح أو الفرع غير متاح.'
                : 'Invalid link or store is not available.')}
          </p>
        </div>
      </div>
    );
  }

  // ============ UI ============
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
              {isAr ? 'منيو الطلبات (QR)' : 'Store menu (QR)'}
            </p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} current="/store-menu" />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {isAr ? 'نسخة تجريبية • جاهز للانطلاق 🚀' : 'Beta version • Ready to launch 🚀'}
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
                  <span className="sr-only">{isAr ? 'إغلاق القائمة' : 'Close menu'}</span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <SidebarNav lang={lang} current="/store-menu" />
              </nav>

              <div className="px-4 py-3 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
                {isAr ? 'نسخة تجريبية • جاهز للانطلاق 🚀' : 'Beta version • Ready to launch 🚀'}
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

              <div className="min-w-0">
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50 truncate">
                  {store.name}
                </h2>
                {store.address && (
                  <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400 truncate">
                    {store.address}
                  </p>
                )}
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

              {/* Badge paymob */}
              <span
                className={`hidden sm:inline-flex items-center px-2 py-1 rounded-full text-[11px] border ${
                  store.paymob_enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800'
                    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700'
                }`}
              >
                {store.paymob_enabled
                  ? (isAr ? 'PayMob متاح' : 'PayMob enabled')
                  : (isAr ? 'PayMob غير متاح' : 'PayMob disabled')}
              </span>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-4 max-w-5xl mx-auto w-full">
            {/* بيانات العميل + نوع الطلب + الدفع */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  {isAr ? 'بيانات الطلب' : 'Order details'}
                </p>

                {/* نوع الطلب */}
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-gray-500 dark:text-gray-400">
                    {isAr ? 'نوع الطلب:' : 'Order type:'}
                  </span>
                  <div className="flex rounded-full border border-gray-200 overflow-hidden dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setOrderType('IN_STORE')}
                      className={`px-3 py-1 ${
                        orderType === 'IN_STORE'
                          ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {isAr ? 'داخل المطعم' : 'In store'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('DELIVERY')}
                      className={`px-3 py-1 ${
                        orderType === 'DELIVERY'
                          ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {isAr ? 'دليفري' : 'Delivery'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={isAr ? 'اسمك (اختياري)' : 'Your name (optional)'}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder={isAr ? 'رقم الموبايل (اختياري)' : 'Mobile number (optional)'}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                />
              </div>

              {orderType === 'DELIVERY' && (
                <textarea
                  placeholder={isAr ? 'عنوان التوصيل بالتفصيل' : 'Delivery address (details)'}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none dark:text-gray-100"
                />
              )}

              <textarea
                placeholder={
                  isAr
                    ? 'ملاحظات على الطلب (بدون سكر، زيادة جبنة، ...)'
                    : 'Notes (no sugar, extra cheese, ...)'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none dark:text-gray-100"
              />

              {/* طريقة الدفع */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-gray-500 dark:text-gray-400">
                  {isAr ? 'طريقة الدفع:' : 'Payment method:'}
                </span>
                <div className="flex rounded-full border border-gray-200 overflow-hidden dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`px-3 py-1 ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {isAr ? 'عند الاستلام' : 'Cash'}
                  </button>

                  {/* ✅ PayMob يظهر فقط لو enabled */}
                  {store.paymob_enabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('PAYMOB')}
                      className={`px-3 py-1 ${
                        paymentMethod === 'PAYMOB'
                          ? 'bg-blue-600 text-white dark:bg-blue-500'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      PayMob
                    </button>
                  )}
                </div>

                {!store.paymob_enabled && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    {isAr ? '* الدفع الإلكتروني غير متاح لهذا الفرع' : '* Online payment is disabled for this store'}
                  </span>
                )}
              </div>
            </section>

            {/* البحث + الفلاتر */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  placeholder={isAr ? 'ابحث عن مشروب أو طبق...' : 'Search for a drink or dish...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-full text-[11px] border ${
                    selectedCategory === 'ALL'
                      ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                      : 'bg-white text-gray-700 border-gray-200 dark:bg-slate-950 dark:text-gray-100 dark:border-slate-700'
                  }`}
                >
                  {isAr ? 'كل الأصناف' : 'All items'}
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-[11px] border ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                        : 'bg-white text-gray-700 border-gray-200 dark:bg-slate-950 dark:text-gray-100 dark:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>

            {/* قائمة الأصناف */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  {isAr ? 'لا توجد أصناف مطابقة حاليًا.' : 'No matching items at the moment.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      className="text-right bg-gray-50 dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-500 rounded-2xl p-3 flex flex-col justify-between min-h-[100px]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {item.name}
                        </p>
                        {item.category_name && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                            {item.category_name}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 text-sm font-bold text-blue-700 dark:text-blue-300">
                        {numberFormatter.format(Number(item.unit_price || 0))} {isAr ? 'ج.م' : 'EGP'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* رسالة نجاح بعد الطلب */}
            {successOrder && (
              <section className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100 rounded-2xl p-4 text-sm">
                <p className="font-semibold mb-1">
                  {isAr ? 'تم استلام طلبك بنجاح 🎉' : 'Your order has been received 🎉'}
                </p>
                <p>{isAr ? 'رقم الطلب' : 'Order number'}: #{successOrder.id}</p>
                <p>
                  {isAr ? 'الإجمالي: ' : 'Total: '}
                  {numberFormatter.format(Number(successOrder.total || 0))} {isAr ? 'ج.م' : 'EGP'}
                </p>
                <p className="text-xs mt-2 text-emerald-700/80 dark:text-emerald-100/80">
                  {isAr
                    ? 'برجاء انتظار تجهيز الطلب، وسيتم التواصل معك / خدمتك حسب نوع الطلب.'
                    : 'Please wait while we prepare your order; we will serve or deliver it according to your selection.'}
                </p>
              </section>
            )}
          </div>

          {/* سلة الطلب أسفل الشاشة */}
          <div className="fixed bottom-0 left-0 right-0 z-30">
            <div className="max-w-5xl mx-auto px-4 pb-3">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 p-3">
                {cart.length === 0 ? (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
                    {isAr ? 'أضف منتجات إلى السلة لبدء الطلب.' : 'Add items to the cart to start your order.'}
                  </p>
                ) : (
                  <>
                    <div className="max-h-36 overflow-y-auto mb-2 border border-gray-100 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-[11px]">
                        <tbody>
                          {cart.map((row) => (
                            <tr
                              key={row.itemId}
                              className="border-b border-gray-50 dark:border-slate-800 last:border-0"
                            >
                              <td className="py-2 px-2 text-right">
                                <div className="font-semibold text-gray-800 dark:text-gray-100">
                                  {row.name}
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {numberFormatter.format(row.unitPrice)} {isAr ? 'ج.م' : 'EGP'}
                                </div>
                              </td>

                              <td className="py-2 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleChangeQuantity(row.itemId, -1)}
                                    className="w-6 h-6 rounded-full border border-gray-300 dark:border-slate-700 flex items-center justify-center text-[12px] hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-100"
                                  >
                                    -
                                  </button>
                                  <span className="w-6 text-center text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                                    {row.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleChangeQuantity(row.itemId, 1)}
                                    className="w-6 h-6 rounded-full border border-blue-500 flex items-center justify-center text-[12px] text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              <td className="py-2 px-2 text-left text-gray-800 dark:text-gray-100 whitespace-nowrap">
                                {numberFormatter.format(row.subtotal)} {isAr ? 'ج.م' : 'EGP'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        {isAr ? `${cart.length} صنف في السلة` : `${cart.length} items in cart`}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-50">
                        {isAr ? 'المجموع: ' : 'Total: '}
                        {numberFormatter.format(total)} {isAr ? 'ج.م' : 'EGP'}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={submitting || cart.length === 0}
                      onClick={handleSubmitOrder}
                      className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting
                        ? (isAr ? 'جاري إرسال الطلب...' : 'Sending order...')
                        : (isAr ? 'تأكيد الطلب' : 'Confirm order')}
                    </button>

                    <button
                      type="button"
                      onClick={handleClearCart}
                      disabled={submitting || cart.length === 0}
                      className="w-full mt-1 py-2 rounded-2xl text-[12px] font-medium border border-red-100 dark:border-red-800 text-red-500 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                    >
                      {isAr ? 'إفراغ السلة' : 'Clear cart'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
