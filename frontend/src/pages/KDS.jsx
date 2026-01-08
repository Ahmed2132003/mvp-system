// src/pages/KDS.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useStore } from '../hooks/useStore';
import { notifyError, notifyInfo, notifySuccess } from '../lib/notifications';
import BrandMark from '../components/layout/BrandMark';

const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY'];

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

      {/* Active */}
      <Link
        to="/kds"
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
      >
        <span>{isAr ? 'المطبخ والبار' : 'KDS'}</span>
        <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
          {isAr ? 'الآن' : 'Now'}
        </span>
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

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);

  const { stores, storesLoading, storesError, selectedStoreId, selectStore } = useStore();

  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  // theme & language (مثل Dashboard)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAr = lang === 'ar';
  const numberFormatter = new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG');

  const t = useMemo(
    () => ({
      title: isAr ? 'شاشة المطبخ (KDS)' : 'Kitchen Display System (KDS)',
      subtitle: isAr
        ? 'متابعة الطلبات الجديدة وتغيير حالتها لحظيًا من داخل المطبخ.'
        : 'Track new orders and update their status in real time from the kitchen.',
      realtimeOn: isAr ? 'متصل بالوقت الحقيقي ✅' : 'Real-time connected ✅',
      realtimeOff: isAr ? 'غير متصل بالـ WebSocket ⚠️' : 'WebSocket disconnected ⚠️',
      wsOn: isAr ? 'متصل بالـ WebSocket' : 'WebSocket connected',
      wsOff: isAr ? 'لا يوجد اتصال WebSocket' : 'No WebSocket connection',
      store: isAr ? 'اختيار المتجر' : 'Select store',
      branch: isAr ? 'اختيار الفرع' : 'Select branch',
      allBranches: isAr ? 'كل الفروع (حسب الصلاحيات)' : 'All branches (by permissions)',
      loadingStores: isAr ? 'جارٍ تحميل المتاجر...' : 'Loading stores...',
      noStores: isAr ? 'لا توجد متاجر متاحة' : 'No stores available',
      loadingBranches: isAr ? 'جاري تحميل الفروع...' : 'Loading branches...',
      noBranches: isAr ? 'لا توجد فروع لهذا المتجر.' : 'No branches for this store.',
      refresh: isAr ? 'تحديث' : 'Refresh',
      kdsConnectedToast: isAr
        ? 'تم الاتصال بشاشة المطبخ بالوقت الحقيقي.'
        : 'Connected to KDS real-time updates.',
      kdsDisconnectedToast: isAr
        ? 'تم فقد الاتصال بالوقت الحقيقي، سيتم عرض البيانات الأخيرة فقط.'
        : 'Real-time connection lost; showing last known data.',
      kdsErrorToast: isAr ? 'حدث خطأ في اتصال شاشة المطبخ بالوقت الحقيقي.' : 'Real-time connection error.',
      loadError: isAr
        ? 'حدث خطأ أثناء تحميل طلبات المطبخ، حاول تحديث الصفحة.'
        : 'Failed to load KDS orders. Please refresh.',
      branchesError: isAr ? 'تعذر تحميل الفروع المتاحة لهذا المتجر.' : 'Could not load branches.',
      orderNew: isAr ? 'طلب جديد' : 'New order',
      orderPreparing: isAr ? 'قيد التحضير' : 'Preparing',
      orderReady: isAr ? 'جاهز' : 'Ready',
      orderServed: isAr ? 'تم التسليم' : 'Served',
      colNew: isAr ? 'جديدة' : 'New',
      colPreparing: isAr ? 'قيد التحضير' : 'Preparing',
      colReady: isAr ? 'جاهزة' : 'Ready',
      ordersCount: (n) => (isAr ? `${n} طلب` : `${n} orders`),
      emptyState: isAr ? 'لا توجد طلبات في هذه الحالة حاليًا.' : 'No orders in this column right now.',
      loadingState: isAr ? 'جاري التحميل...' : 'Loading...',
      noItems: isAr ? 'لا توجد تفاصيل أصناف متاحة.' : 'No item details available.',
      note: isAr ? 'ملاحظة' : 'Note',
      withoutTable: isAr ? 'بدون طاولة' : 'No table',
      table: (n) => (isAr ? `طاولة ${n}` : `Table ${n}`),
      unknownCustomer: isAr ? 'عميل بدون اسم' : 'Unnamed customer',
      startPreparing: isAr ? 'بدء التحضير' : 'Start preparing',
      markReady: isAr ? 'جاهز للتقديم' : 'Mark ready',
      markServed: isAr ? 'تم التسليم' : 'Mark served',
      msgStartPreparing: isAr ? 'تم بدء تحضير الطلب.' : 'Order preparation started.',
      msgReady: isAr ? 'الطلب جاهز للتقديم.' : 'Order is ready.',
      msgServed: isAr ? 'تم تسليم الطلب للعميل.' : 'Order served.',
      msgUpdateFailed: isAr
        ? 'فشل تحديث حالة الطلب، تم إعادة تحميل القائمة.'
        : 'Failed to update order status; list reloaded.',
      currency: isAr ? 'ج.م' : 'EGP',
    }),
    [isAr]
  );

  // تطبيق الثيم على <html> + حفظه
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // تطبيق اللغة والاتجاه على <html> + حفظها
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  useEffect(() => {
    const resumeAudio = () => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };
    window.addEventListener('pointerdown', resumeAudio, { once: true });
    return () => window.removeEventListener('pointerdown', resumeAudio);
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  // -----------------------------
  // REST: تحميل الطلبات للـ KDS
  // -----------------------------
  const fetchKDSOrders = useCallback(async () => {
    if (!selectedStoreId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = { store_id: selectedStoreId };
      if (selectedBranchId) params.branch = selectedBranchId;

      const res = await api.get('/orders/kds/', { params });
      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setOrders(results);
    } catch (err) {
      console.error('KDS load error:', err);
      notifyError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, selectedStoreId, t.loadError]);

  // -----------------------------
  // تحميل الفروع المتاحة للستور الحالي
  // -----------------------------
  const fetchBranches = useCallback(async () => {
    if (!selectedStoreId) {
      setBranches([]);
      setSelectedBranchId('');
      return;
    }

    const storageKey = `kds_branch_${selectedStoreId}`;

    try {
      setBranchesLoading(true);
      const res = await api.get('/branches/', { params: { store_id: selectedStoreId } });
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setBranches(data);

      const savedBranch = localStorage.getItem(storageKey);

      setSelectedBranchId((current) => {
        if (current === '') return '';
        if (current && data.some((b) => String(b.id) === String(current))) return String(current);
        if (savedBranch === '') return '';
        if (savedBranch && data.some((b) => String(b.id) === String(savedBranch))) return String(savedBranch);
        const firstId = data[0]?.id ? String(data[0].id) : '';
        return firstId;
      });
    } catch (err) {
      console.error('Branches load error:', err);
      notifyError(t.branchesError);
      setBranches([]);
      setSelectedBranchId('');
    } finally {
      setBranchesLoading(false);
    }
  }, [selectedStoreId, t.branchesError]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (!selectedStoreId) return;

    const storageKey = `kds_branch_${selectedStoreId}`;
    if (selectedBranchId) localStorage.setItem(storageKey, selectedBranchId);
    else localStorage.removeItem(storageKey);
  }, [selectedBranchId, selectedStoreId]);

  const orderMatchesContext = useCallback(
    (order) => {
      const sameStore = selectedStoreId ? String(order.store) === String(selectedStoreId) : true;
      const sameBranch = selectedBranchId ? String(order.branch) === String(selectedBranchId) : true;
      return sameStore && sameBranch;
    },
    [selectedBranchId, selectedStoreId]
  );

  // -----------------------------
  // صوت إشعار
  // -----------------------------
  const playTone = useCallback((frequency = 920) => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      gainNode.gain.value = 0.08;
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (error) {
      console.error('Notification sound failed:', error);
    }
  }, []);

  const statusLabels = useMemo(
    () => ({
      PENDING: t.orderNew,
      PREPARING: t.orderPreparing,
      READY: t.orderReady,
      SERVED: t.orderServed,
    }),
    [t.orderNew, t.orderPreparing, t.orderReady, t.orderServed]
  );

  const handleOrderCreated = useCallback(
    (order) => {
      if (!orderMatchesContext(order)) return;
      if (!ACTIVE_STATUSES.includes(order.status)) return;

      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        if (exists) return prev.map((o) => (o.id === order.id ? order : o));

        notifySuccess(`${t.orderNew} #${order.id}`);
        playTone(980);
        return [...prev, order];
      });
    },
    [orderMatchesContext, playTone, t.orderNew]
  );

  const handleOrderUpdated = useCallback(
    (order) => {
      if (!orderMatchesContext(order)) return;

      setOrders((prev) => {
        const previous = prev.find((o) => o.id === order.id);

        if (!ACTIVE_STATUSES.includes(order.status)) {
          return prev.filter((o) => o.id !== order.id);
        }

        const exists = Boolean(previous);
        if (!exists) {
          notifySuccess(`${t.orderNew} #${order.id}`);
          playTone(980);
          return [...prev, order];
        }

        if (previous.status !== order.status) {
          const label = statusLabels[order.status] || order.status;
          notifyInfo(isAr ? `تم تحديث الطلب #${order.id} إلى حالة: ${label}.` : `Order #${order.id} updated: ${label}.`);
          playTone(order.status === 'READY' ? 1200 : 860);
        }

        return prev.map((o) => (o.id === order.id ? order : o));
      });
    },
    [orderMatchesContext, playTone, statusLabels, t.orderNew, isAr]
  );

  // -----------------------------
  // WebSocket: اتصال لايف
  // -----------------------------
  useEffect(() => {
    fetchKDSOrders();

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/kds/`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      notifySuccess(t.kdsConnectedToast);
    };

    ws.onclose = () => {
      setWsConnected(false);
      notifyInfo(t.kdsDisconnectedToast);
    };

    ws.onerror = (err) => {
      console.error('KDS WebSocket error:', err);
      setWsConnected(false);
      notifyError(t.kdsErrorToast);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'order_created') handleOrderCreated(data.order);
        else if (data.type === 'order_updated') handleOrderUpdated(data.order);
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [
    fetchKDSOrders,
    handleOrderCreated,
    handleOrderUpdated,
    t.kdsConnectedToast,
    t.kdsDisconnectedToast,
    t.kdsErrorToast,
  ]);

  // -----------------------------
  // تغيير حالة الطلب من الـ UI
  // -----------------------------
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));

      await api.patch(
        `/orders/${orderId}/`,
        { status: newStatus },
        {
          params: {
            ...(selectedStoreId ? { store_id: selectedStoreId } : {}),
            ...(selectedBranchId ? { branch: selectedBranchId } : {}),
          },
        }
      );

      let msg = '';
      if (newStatus === 'PREPARING') msg = t.msgStartPreparing;
      else if (newStatus === 'READY') msg = t.msgReady;
      else if (newStatus === 'SERVED') msg = t.msgServed;

      if (msg) notifySuccess(msg);
    } catch (err) {
      console.error('Order status update failed:', err);
      notifyError(t.msgUpdateFailed);
      fetchKDSOrders();
    }
  };

  // -----------------------------
  // تقسيم الطلبات حسب الحالة
  // -----------------------------
  const grouped = useMemo(() => {
    const byStatus = { PENDING: [], PREPARING: [], READY: [] };
    orders.forEach((order) => {
      if (byStatus[order.status]) byStatus[order.status].push(order);
    });
    return byStatus;
  }, [orders]);

  const renderOrderCard = (order, column) => {
    const createdAt = order.created_at ? new Date(order.created_at) : null;
    const timeLabel = createdAt
      ? createdAt.toLocaleTimeString(isAr ? 'ar-EG' : 'en-EG', { hour: '2-digit', minute: '2-digit' })
      : '--';

    const tableLabel = order.table_number ? t.table(order.table_number) : t.withoutTable;

    return (
      <div
        key={order.id}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-50">#{order.id}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {tableLabel}
              {order.branch_name ? ` • ${order.branch_name}` : ''}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{timeLabel}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{order.customer_name || t.unknownCustomer}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-2 dark:border-slate-800">
          {order.items && order.items.length > 0 ? (
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-xs text-gray-800 dark:text-gray-100">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-300">x {item.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{t.noItems}</p>
          )}
        </div>

        {order.notes && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-2 py-1 text-[11px] text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
            {t.note}: {order.notes}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
            {numberFormatter.format(order.total || 0)} {t.currency}
          </span>

          <div className="flex gap-1">
            {column === 'PENDING' && (
              <button
                type="button"
                onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                className="text-[11px] px-2 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700"
              >
                {t.startPreparing}
              </button>
            )}

            {column === 'PREPARING' && (
              <button
                type="button"
                onClick={() => updateOrderStatus(order.id, 'READY')}
                className="text-[11px] px-2 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {t.markReady}
              </button>
            )}

            {column === 'READY' && (
              <button
                type="button"
                onClick={() => updateOrderStatus(order.id, 'SERVED')}
                className="text-[11px] px-2 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-900 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                {t.markServed}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderColumn = (title, statusKey, badgeClasses) => {
    const list = grouped[statusKey] || [];

    return (
      <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t.ordersCount(list.length)}</p>
          </div>
          <span className={`text-[11px] px-2 py-1 rounded-full ${badgeClasses}`}>{statusKey}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">{t.loadingState}</div>
          ) : list.length === 0 ? (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">{t.emptyState}</div>
          ) : (
            list.map((order) => renderOrderCard(order, statusKey))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <BrandMark subtitle={isAr ? 'شاشة المطبخ والبار (KDS)' : 'Kitchen & Bar (KDS)'} />
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {wsConnected ? t.realtimeOn : t.realtimeOff}
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
                <SidebarNav lang={lang} />
              </nav>

              <div className="px-4 py-3 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
                {wsConnected ? t.realtimeOn : t.realtimeOff}
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
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">{t.title}</h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">{t.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Store selector (desktop) */}
              <div className="hidden md:block">
                <label className="sr-only" htmlFor="kds-store-switcher">
                  {t.store}
                </label>
                <select
                  id="kds-store-switcher"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                  value={selectedStoreId || ''}
                  onChange={(e) => selectStore(e.target.value || null)}
                  disabled={storesLoading || !stores.length}
                >
                  {storesLoading && <option>{t.loadingStores}</option>}
                  {!storesLoading && stores.length === 0 && <option>{t.noStores}</option>}
                  {!storesLoading &&
                    stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                </select>
                {storesError && <p className="text-xs text-red-600 mt-1">{storesError}</p>}
              </div>

              {/* Branch selector (desktop) */}
              <div className="hidden md:block">
                <label className="sr-only" htmlFor="kds-branch-switcher">
                  {t.branch}
                </label>
                <select
                  id="kds-branch-switcher"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  disabled={!selectedStoreId || branchesLoading || branches.length === 0}
                >
                  <option value="">{t.allBranches}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {branchesLoading && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{t.loadingBranches}</p>}
                {!branchesLoading && selectedStoreId && branches.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{t.noBranches}</p>
                )}
              </div>

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

              {/* WS badge */}
              <span
                className={`text-[11px] px-3 py-1 rounded-full border ${
                  wsConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-900/60'
                    : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900/60'
                }`}
              >
                {wsConnected ? t.wsOn : t.wsOff}
              </span>

              {/* Refresh */}
              <button
                type="button"
                onClick={fetchKDSOrders}
                className="hidden sm:inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
              >
                {t.refresh}
              </button>
            </div>
          </header>

          {/* Mobile filters row */}
          <div className="md:hidden px-4 pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                value={selectedStoreId || ''}
                onChange={(e) => selectStore(e.target.value || null)}
                disabled={storesLoading || !stores.length}
              >
                {storesLoading && <option>{t.loadingStores}</option>}
                {!storesLoading && stores.length === 0 && <option>{t.noStores}</option>}
                {!storesLoading &&
                  stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
              </select>

              <select
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                disabled={!selectedStoreId || branchesLoading || branches.length === 0}
              >
                <option value="">{t.allBranches}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={fetchKDSOrders}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
              >
                {t.refresh}
              </button>

              <span
                className={`text-[11px] px-3 py-1 rounded-full border ${
                  wsConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-900/60'
                    : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900/60'
                }`}
              >
                {wsConnected ? t.wsOn : t.wsOff}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto w-full flex-1">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderColumn(
                t.colNew,
                'PENDING',
                'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-900/60'
              )}
              {renderColumn(
                t.colPreparing,
                'PREPARING',
                'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-900/60'
              )}
              {renderColumn(
                t.colReady,
                'READY',
                'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-900/60'
              )}
            </section>

            <div className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
              {isAr
                ? 'تلميح: يمكنك ترك الشاشة مفتوحة على تابلت/موبايل داخل المطبخ لمتابعة الطلبات لحظيًا.'
                : 'Tip: Keep this screen open on a tablet/phone in the kitchen to follow orders in real time.'}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
