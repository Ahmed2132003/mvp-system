// src/pages/CustomerMenu.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';

export default function CustomerMenu() {
  const { tableId } = useParams();

  // =====================
  // Theme & Language (نفس نظام الداشبورد)
  // =====================
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'ar' // العميل غالبًا عربي
  );
  const isAr = lang === 'ar';

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG'),
    [isAr]
  );

  // تطبيق الثيم على <html>
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // تطبيق اللغة والاتجاه على <html>
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setLanguage = (lng) => {
    setLang(lng);
  };

  // =====================
  // State الأساسي للمينيو
  // =====================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [store, setStore] = useState(null);
  const [table, setTable] = useState(null);
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [trendingItems, setTrendingItems] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderType, setOrderType] = useState('IN_STORE');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const wsRef = useRef(null);
  const lastAnnouncedStatusRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const branchParam = params.get('branch');
    if (branchParam) {
      setSelectedBranchId(branchParam);
    }
  }, []);

  // =====================
  // جلب بيانات المينيو من الـ API
  // =====================
  const fetchMenu = useCallback(
    async (branchId = null) => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get(`/orders/public/table/${tableId}/menu/`, {
          params: branchId ? { branch_id: branchId } : undefined,
        });
        setStore(res.data.store);
        setTable(res.data.table);
        setItems(res.data.items || []);
        setTrendingItems(res.data.trending_items || []);
        setBranches(res.data.branches || []);

        if (!selectedBranchId && res.data.branches?.length) {
          setSelectedBranchId(String(res.data.branches[0].id));
        }
      } catch (err) {
        console.error('خطأ في تحميل المينيو:', err);
        const msg = isAr
          ? 'حدث خطأ أثناء تحميل قائمة الطعام، برجاء إبلاغ الكاشير.'
          : 'An error occurred while loading the menu. Please inform the cashier.';
        setError(msg);
        notifyError(msg);
      } finally {
        setLoading(false);
      }
    },
    [tableId, isAr, selectedBranchId]
  );

  useEffect(() => {
    if (tableId) {
      fetchMenu(selectedBranchId);
    }
  }, [tableId, fetchMenu, selectedBranchId]);

  // =====================
  // التصنيفات
  // =====================
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category_name) {
        set.add(item.category_name);        
      }
    });
    return Array.from(set);
  }, [items]);

  const currentStatus = useMemo(
    () => liveStatus || successOrder?.status || null,
    [liveStatus, successOrder]
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => String(b.id) === String(selectedBranchId)) || null,
    [branches, selectedBranchId]
  );

  // احترم تفعيل PayMob للفرع
  useEffect(() => {
    if (store && !store.paymob_enabled && paymentMethod === 'PAYMOB') {
      setPaymentMethod('CASH');
      notifyError(
        isAr ? 'PayMob غير متاح لهذا الفرع.' : 'PayMob is not available for this store.'
      );
    }
  }, [isAr, paymentMethod, store]);

  useEffect(() => {
    if (orderType !== 'DELIVERY') {
      setDeliveryAddress('');
    }
  }, [orderType]);

  // =====================
  // فلترة الأصناف
  // =====================
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

  // =====================
  // إدارة السلة
  // =====================
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

  const handleClearCart = (preserveSuccess = false) => {
    setCart([]);
    setNotes('');
    setDeliveryAddress('');
    if (!preserveSuccess) {
      setSuccessOrder(null);
      setActiveOrderId(null);
      setLiveStatus(null);
    }
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, row) => sum + row.subtotal, 0),
    [cart]
  );

  const total = subtotal;

  // =====================
  // إرسال الطلب
  // =====================
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
      notifyError(isAr ? 'برجاء إدخال عنوان التوصيل.' : 'Please enter delivery address.');
      return;
    }

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
        delivery_address: orderType === 'DELIVERY' ? deliveryAddress.trim() : null,
        branch_id: selectedBranchId ? Number(selectedBranchId) : null,
        items: cart.map((row) => ({
          item: row.itemId,
          quantity: row.quantity,
        })),
      };

      const res = await api.post(
        `/orders/public/table/${tableId}/order/`,
        payload
      );
      setSuccessOrder(res.data);
      setActiveOrderId(res.data.id);
      setLiveStatus(res.data.status);
      lastAnnouncedStatusRef.current = res.data.status;
      handleClearCart(true);

      notifySuccess(
        isAr
          ? `تم إرسال الطلب بنجاح! رقم الطلب #${res.data.id}`
          : `Order sent successfully! Order #${res.data.id}`          
      );
    } catch (err) {
      console.error('خطأ في إرسال الطلب:', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        (isAr
          ? 'حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى أو أبلغ الكاشير.'
          : 'An error occurred while sending the order. Please try again or inform the cashier.');
      notifyError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatStatusLabel = useCallback(
    (status) => {
      const map = {
        PENDING: isAr ? 'جديد' : 'Pending',
        PREPARING: isAr ? 'قيد التحضير' : 'Preparing',
        READY: isAr ? 'جاهز' : 'Ready',
        SERVED: isAr ? 'تم التقديم' : 'Served',
        PAID: isAr ? 'مدفوع' : 'Paid',
        CANCELLED: isAr ? 'ملغي' : 'Cancelled',
      };
      return map[status] || status || (isAr ? 'غير معروف' : 'Unknown');
    },
    [isAr]
  );

  const speakStatus = useCallback(
    (text) => {
      try {
        if ('speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = isAr ? 'ar-EG' : 'en-US';
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        }
      } catch (error) {
        console.warn('Speech synthesis not available', error);
      }
    },
    [isAr]
  );

  const handleKdsOrderEvent = useCallback(
    (order) => {
      if (!order || !activeOrderId || order.id !== activeOrderId) return;
      setLiveStatus(order.status);
      setSuccessOrder((prev) =>
        prev ? { ...prev, status: order.status, total: order.total ?? prev.total } : prev
      );

      if (
        ['PREPARING', 'READY', 'SERVED', 'PAID'].includes(order.status) &&
        lastAnnouncedStatusRef.current !== order.status
      ) {
        const phrase =
          order.status === 'READY'
            ? isAr
              ? 'طلبك جاهز للاستلام.'
              : 'Your order is ready.'
            : order.status === 'PREPARING'
              ? isAr
                ? 'طلبك قيد التحضير.'
                : 'Your order is being prepared.'
              : order.status === 'PAID'
                ? isAr
                  ? 'تم تسجيل الدفع. شكرًا!'
                  : 'Payment recorded. Thank you!'
                : isAr
                  ? 'تم تقديم الطلب.'
                  : 'Order served.';

        notifySuccess(phrase);
        speakStatus(phrase);
        lastAnnouncedStatusRef.current = order.status;
      }
    },
    [activeOrderId, isAr, speakStatus]
  );

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/kds/`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'order_created' || data.type === 'order_updated') {
          handleKdsOrderEvent(data.order);
        }
      } catch (error) {
        console.error('KDS message parse error:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [handleKdsOrderEvent]);

  useEffect(() => {
    if (!activeOrderId && successOrder?.id) {
      setActiveOrderId(successOrder.id);
      setLiveStatus(successOrder.status);
    }
  }, [activeOrderId, successOrder]);

  // =====================
  // Screens: Loading / Error
  // =====================
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <p className="text-sm text-gray-500 dark:text-gray-300">
          {isAr
            ? 'جاري تحميل قائمة الطعام...'
            : 'Loading menu...'}
        </p>
      </div>
    );
  }

  if (error || !store || !table) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-slate-950"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-red-100 dark:border-red-800 p-6 max-w-sm text-center">
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            {error ||
              (isAr
                ? 'QR غير صالح أو الطاولة غير متاحة.'
                : 'Invalid QR code or table is not available.')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isAr
              ? 'برجاء التواصل مع الكاشير أو موظف الاستقبال لمساعدتك.'
              : 'Please contact the cashier or receptionist for assistance.'}
          </p>
        </div>
      </div>
    );
  }

  // =====================
  // Main UI
  // =====================
  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50 flex flex-col"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-50 truncate">
              {store.name}
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {isAr
                ? `طاولة رقم ${table.number} • السعة ${table.capacity} أفراد`
                : `Table #${table.number} • Capacity ${table.capacity} guests`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right text-[11px] text-gray-500 dark:text-gray-400">
              <p>{isAr ? 'مرحبًا بك 👋' : 'Welcome 👋'}</p>            
              <p>
                {isAr
                  ? 'اطلب بسهولة وسنجهز لك طلبك'
                  : 'Order easily and we’ll prepare it for you'}
              </p>
            </div>

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
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 p-1.5 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? (
                <span className="flex items-center gap-1 text-[11px]">␊
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

            {store?.id && (
              <Link
                to={`/store/${store.id}/menu${selectedBranchId ? `?branch=${selectedBranchId}` : ''}`}
                className="hidden sm:inline-flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-700"
              >
                {isAr ? 'منيو الفرع العامة' : 'Store menu'}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pt-3 pb-28">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* بيانات الطلب */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                {isAr ? 'بيانات الطلب' : 'Order details'}
              </p>

              {currentStatus && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-600/60 dark:bg-amber-900/20 dark:text-amber-100">
                  {isAr ? 'حالة الطلب: ' : 'Order status: '}
                  {formatStatusLabel(currentStatus)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-600 dark:text-gray-300">
                  {isAr ? 'اختر الفرع' : 'Choose branch'}
                </label>
                <select
                  value={selectedBranchId || ''}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                  className="text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-gray-100"
                >
                  {!selectedBranchId && <option value="">{isAr ? 'اختر الفرع' : 'Select branch'}</option>}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-600 dark:text-gray-300">
                  {isAr ? 'نوع الطلب' : 'Order type'}
                </label>
                <div className="flex rounded-full border border-gray-200 overflow-hidden dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setOrderType('IN_STORE')}
                    className={`px-3 py-1 text-[11px] ${
                      orderType === 'IN_STORE'
                        ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {isAr ? 'داخل المكان' : 'In store'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('DELIVERY')}
                    className={`px-3 py-1 text-[11px] ${
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

            {orderType === 'DELIVERY' && (
              <textarea
                placeholder={isAr ? 'عنوان التوصيل بالتفصيل' : 'Delivery address (details)'}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={2}
                className="w-full text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none dark:text-gray-100"
              />
            )}

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
                {store?.paymob_enabled && (
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
              {!store?.paymob_enabled && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {isAr ? 'الدفع الإلكتروني غير مفعل لهذا الفرع' : 'Online payment is disabled for this store'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={isAr ? 'اسمك (اختياري)' : 'Your name (optional)'}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-gray-100"
              />
              <input
                type="text"
                placeholder={isAr ? 'رقم الموبايل (اختياري)' : 'Mobile number (optional)'}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-gray-100"
              />
            </div>
            <textarea
              placeholder={
                isAr
                  ? 'ملاحظات على الطلب (بدون سكر، زيادة جبنة، ...)'
                  : 'Notes on the order (no sugar, extra cheese, ...)'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none dark:text-gray-100"
            />
          </section>

          {/* المنتجات الترندي */}
          {trendingItems.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                  {isAr ? 'الأكثر طلبًا في الفرع' : 'Trending in this branch'}
                </p>
                {selectedBranch && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {isAr ? `الفرع: ${selectedBranch.name}` : `Branch: ${selectedBranch.name}`}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {trendingItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddToCart(item)}
                    className="text-right bg-blue-50/60 dark:bg-slate-950 hover:bg-blue-100 dark:hover:bg-slate-800 border border-blue-100 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between min-h-[90px]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {item.name}
                      </p>
                      {item.category_name && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.category_name}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                      {numberFormatter.format(Number(item.unit_price || 0))}{' '}
                      {isAr ? 'ج.م' : 'EGP'}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* البحث + الفلاتر */}          
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-3">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                placeholder={
                  isAr
                    ? 'ابحث عن مشروب أو طبق...'
                    : 'Search for a drink or dish...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-gray-100"
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
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-3">
            {filteredItems.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                {isAr
                  ? 'لا توجد أصناف مطابقة حاليًا.'
                  : 'No matching items at the moment.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddToCart(item)}
                    className="text-right bg-gray-50 dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-500 rounded-2xl p-3 flex flex-col justify-between min-h-[90px]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {item.name}
                      </p>
                      {item.category_name && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.category_name}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                      {numberFormatter.format(Number(item.unit_price || 0))}{' '}
                      {isAr ? 'ج.م' : 'EGP'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* رسالة نجاح بعد الطلب */}
          {successOrder && (
            <section className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100 rounded-2xl p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  {isAr
                    ? 'تم استلام طلبك بنجاح 🎉'
                    : 'Your order has been received 🎉'}
                </p>
                {currentStatus && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white/70 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100">
                    {formatStatusLabel(currentStatus)}
                  </span>
                )}
              </div>
              <p>
                {isAr ? 'رقم الطلب' : 'Order number'}: #{successOrder.id}
              </p>
              {selectedBranch && (
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-100/80">
                  {isAr ? `الفرع: ${selectedBranch.name}` : `Branch: ${selectedBranch.name}`}
                </p>
              )}
              <p>
                {isAr ? 'الإجمالي: ' : 'Total: '}
                {numberFormatter.format(Number(successOrder.total || 0))}{' '}
                {isAr ? 'ج.م' : 'EGP'}
              </p>
              <p className="text-[11px] mt-1">
                {isAr
                  ? 'نقوم بتحديث الحالة تلقائيًا. ستصلك تنبيهات صوتية عند تجهيز الطلب.'
                  : 'We update the status automatically. You will get voice alerts when the order is prepared.'}
              </p>
            </section>
          )}          
        </div>
      </main>

      {/* سلة الطلب أسفل الشاشة */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 p-3">
            {cart.length === 0 ? (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
                {isAr
                  ? 'أضف منتجات إلى السلة لبدء الطلب.'
                  : 'Add items to the cart to start your order.'}
              </p>
            ) : (
              <>
                <div className="max-h-32 overflow-y-auto mb-2 border border-gray-100 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {cart.map((row) => (
                        <tr
                          key={row.itemId}
                          className="border-b border-gray-50 dark:border-slate-800 last:border-0"
                        >
                          <td className="py-1 px-2 text-right">
                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                              {row.name}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              {numberFormatter.format(row.unitPrice)}{' '}
                              {isAr ? 'ج.م' : 'EGP'}
                            </div>
                          </td>
                          <td className="py-1 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeQuantity(row.itemId, -1)
                                }
                                className="w-5 h-5 rounded-full border border-gray-300 dark:border-slate-700 flex items-center justify-center text-[11px] hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-100"
                              >
                                -
                              </button>
                              <span className="w-5 text-center text-[11px] font-semibold text-gray-800 dark:text-gray-100">
                                {row.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeQuantity(row.itemId, 1)
                                }
                                className="w-5 h-5 rounded-full border border-blue-500 flex items-center justify-center text-[11px] text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-1 px-2 text-left text-gray-800 dark:text-gray-100 whitespace-nowrap">
                            {numberFormatter.format(row.subtotal)}{' '}
                            {isAr ? 'ج.م' : 'EGP'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="text-gray-600 dark:text-gray-300">
                    {isAr
                      ? `${cart.length} صنف في السلة`
                      : `${cart.length} items in cart`}
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
                  className="w-full py-2 rounded-2xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting
                    ? isAr
                      ? 'جاري إرسال الطلب...'
                      : 'Sending order...'
                    : isAr
                      ? 'إرسال الطلب للمطبخ'
                      : 'Send order to kitchen'}
                </button>

                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={submitting || cart.length === 0}
                  className="w-full mt-1 py-1.5 rounded-2xl text-[11px] font-medium border border-red-100 dark:border-red-800 text-red-500 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                >
                  {isAr ? 'إفراغ السلة' : 'Clear cart'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
