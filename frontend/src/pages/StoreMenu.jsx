// src/pages/StoreMenu.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';
import { openInvoicePrintWindow } from '../lib/invoice';

export default function StoreMenu() {
  const { storeId } = useParams();

  // ============ Theme & Lang (نفس الداشبورد) ============
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'ar'
  );

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

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  // ============ State الأساسي ============
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [trendingItems, setTrendingItems] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [cart, setCart] = useState([]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [orderType, setOrderType] = useState('IN_STORE'); // IN_STORE | DELIVERY
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH | PAYMOB
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [reservingTableId, setReservingTableId] = useState(null);

  const defaultReservationLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [tableFilters, setTableFilters] = useState({
    datetime: defaultReservationLocal(),
    partySize: 2,
    duration: 60,
  });

  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);
  const [activeOrderId, setActiveOrderId] = useState(null);  
  const wsRef = useRef(null);
  const lastAnnouncedStatusRef = useRef(null);
  const audioContextRef = useRef(null);
  const expiryTimeoutRef = useRef(null);

  const ORDER_STORAGE_TTL_MS = 60 * 60 * 1000;
  const orderStorageKey = useMemo(
    () => (storeId ? `customer_order_store_${storeId}` : 'customer_order_store'),
    [storeId]
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const branchParam = params.get('branch');
    if (branchParam) {
      setSelectedBranchId(branchParam);
    }
  }, []);

  // ============ Fetch menu from API ============
  const fetchMenu = useCallback(
    async (branchId = null) => {
      try {
        setLoading(true);
        setError(null);

        const targetBranchId = branchId || selectedBranchId || null;

        const res = await api.get(`/orders/public/store/${storeId}/menu/`, {
          params: targetBranchId ? { branch_id: targetBranchId } : undefined,
        });
        setStore(res.data.store);
        const fetchedBranches = res.data.branches || [];

        setItems(res.data.items || []);
        setTrendingItems(res.data.trending_items || []);
        setBranches(fetchedBranches);

        const backendBranchId = res.data.branch?.id
          ? String(res.data.branch.id)
          : null;
        const requestedBranchId = targetBranchId ? String(targetBranchId) : null;
        const branchIds = new Set(
          fetchedBranches.map((branch) => String(branch.id))
        );

        let nextBranchId =
          requestedBranchId || backendBranchId || (fetchedBranches[0]?.id ? String(fetchedBranches[0].id) : null);

        if (nextBranchId && !branchIds.has(nextBranchId)) {
          nextBranchId = fetchedBranches.length
            ? String(fetchedBranches[0].id)
            : null;
        }

        if (nextBranchId && nextBranchId !== String(selectedBranchId)) {
          setSelectedBranchId(nextBranchId);
        }
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
    },
    [storeId, isAr, selectedBranchId]
  );

  useEffect(() => {
    if (storeId) fetchMenu(selectedBranchId);
  }, [storeId, fetchMenu, selectedBranchId]);

  useEffect(() => {
    loadPersistedOrder();
  }, [loadPersistedOrder]);

  useEffect(() => {
    const resumeAudio = () => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };
    window.addEventListener('pointerdown', resumeAudio, { once: true });
    return () => window.removeEventListener('pointerdown', resumeAudio);
  }, []);

  useEffect(() => {
    return () => {
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
      }
    };
  }, []);

  const reservationIso = useMemo(
    () => (tableFilters.datetime ? new Date(tableFilters.datetime).toISOString() : null),
    [tableFilters.datetime]
  );

  const fetchTablesAvailability = useCallback(
    async () => {
      if (!storeId || !selectedBranchId) return;
      try {
        setTablesLoading(true);
        const res = await api.get(`/orders/public/store/${storeId}/tables/`, {
          params: {
            branch_id: selectedBranchId,
            time: reservationIso || undefined,
            duration: tableFilters.duration,
            party_size: tableFilters.partySize,
          },
        });
        setTables(res.data?.tables || []);
      } catch (err) {
        console.error('خطأ في تحميل الطاولات:', err);
        const msg = isAr ? 'تعذر تحميل الطاولات المتاحة للفرع.' : 'Failed to load branch tables.';
        notifyError(msg);
        setTables([]);
      } finally {
        setTablesLoading(false);
      }
    },
    [storeId, selectedBranchId, reservationIso, tableFilters.duration, tableFilters.partySize, isAr]
  );

  useEffect(() => {
    if (selectedBranchId) {
      fetchTablesAvailability();
    }
  }, [selectedBranchId, fetchTablesAvailability]);

  // ✅ لو PayMob مش enabled رجع CASH تلقائي
  useEffect(() => {
    if (store && !store.paymob_enabled && paymentMethod === 'PAYMOB') {
      setPaymentMethod('CASH');
      notifyError(isAr ? 'PayMob غير متاح لهذا الفرع.' : 'PayMob is not available for this store.');
    }
  }, [store, paymentMethod, isAr]);

  useEffect(() => {
    if (orderType !== 'DELIVERY') {
      setDeliveryAddress('');
    }
  }, [orderType]);

  // ============ التصنيفات ============
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category_name) set.add(item.category_name);
    });
    return Array.from(set);
  }, [items]);

  const selectedBranch = useMemo(
    () => branches.find((b) => String(b.id) === String(selectedBranchId)) || null,
    [branches, selectedBranchId]
  );

  const currentStatus = useMemo(
    () => liveStatus || successOrder?.status || null,
    [liveStatus, successOrder]
  );

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

  const handleClearCart = (preserveSuccess = false) => {
    setCart([]);
    setNotes('');
    setDeliveryAddress('');
    if (!preserveSuccess) {
      setSuccessOrder(null);
      setActiveOrderId(null);
      setLiveStatus(null);
      if (orderStorageKey) {
        localStorage.removeItem(orderStorageKey);
      }
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
      }
    }
  };

  const handleTableFilterChange = (key, value) => {
    setTableFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpenTableMenu = (tableId) => {
    const target = `/table/${tableId}/menu${selectedBranchId ? `?branch=${selectedBranchId}` : ''}`;
    window.open(target, '_blank');
  };

  const handleReserveTable = async (tableId) => {
    if (!reservationIso) {
      notifyError(isAr ? 'حدد وقت الحجز أولًا.' : 'Select reservation time first.');
      return;
    }
    try {
      setReservingTableId(tableId);
      await api.post(`/orders/public/store/${storeId}/reservation/`, {
        table: tableId,
        branch_id: selectedBranchId,
        reservation_time: reservationIso,
        duration: Number(tableFilters.duration) || 60,
        party_size: Number(tableFilters.partySize) || 1,
        customer_name: customerName || 'Guest',
        customer_phone: customerPhone || '',
        notes,
      });
      notifySuccess(isAr ? 'تم حجز الطاولة بنجاح.' : 'Table reserved successfully.');
      fetchTablesAvailability();
    } catch (err) {
      console.error('reservation error:', err);
      const msg =
        err?.response?.data?.detail ||
        (isAr ? 'تعذر حجز الطاولة، حاول مرة أخرى.' : 'Could not reserve the table, please try again.');
      notifyError(msg);
    } finally {
      setReservingTableId(null);
    }
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, row) => sum + row.subtotal, 0),
    [cart]
  );
  const total = subtotal;

  const loadInvoice = useCallback(
    async (invoiceNumber) => {
      if (!invoiceNumber) return null;
      try {
        setInvoiceLoading(true);
        const res = await api.get(`/orders/public/invoices/${invoiceNumber}/`);
        setInvoiceDetails(res.data);
        return res.data;
      } catch (err) {
        console.error('خطأ في تحميل الفاتورة:', err);
        notifyError(
          isAr
            ? 'تعذر تحميل الفاتورة. حاول مرة أخرى.'
            : 'Could not load invoice. Please try again.'
        );
        return null;
      } finally {
        setInvoiceLoading(false);
      }
    },
    [isAr]
  );

  // ============ إرسال الطلب ============
  const handleSubmitOrder = async () => {
    setInvoiceDetails(null);

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
      notifyError(isAr ? 'PayMob غير متاح لهذا الفرع.' : 'PayMob is not available for this الفرع.');
      setPaymentMethod('CASH');
      return;
    }

    setSubmitting(true);
    setSuccessOrder(null);

    try {
      const payload = {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
        notes,
        order_type: orderType,
        payment_method: paymentMethod,        
        delivery_address:
          orderType === 'DELIVERY' ? deliveryAddress.trim() : null,
        branch_id: selectedBranchId ? Number(selectedBranchId) : null,
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
      setActiveOrderId(res.data.id);
      setLiveStatus(res.data.status);
      lastAnnouncedStatusRef.current = res.data.status;
      persistOrder(res.data, res.data.status, res.data.status);      
      if (res.data.invoice_number) {
        await loadInvoice(res.data.invoice_number);
      }
      handleClearCart(true);

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
        console.warn('Speech synthesis unavailable', error);
      }
    },
    [isAr]
  );

  const loadPersistedOrder = useCallback(async () => {
    if (!orderStorageKey) return;
    try {
      const raw = localStorage.getItem(orderStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.expiresAt || parsed.expiresAt < Date.now()) {
        localStorage.removeItem(orderStorageKey);
        return;
      }
      const remainingMs = parsed.expiresAt - Date.now();
      if (remainingMs > 0) {
        if (expiryTimeoutRef.current) {
          clearTimeout(expiryTimeoutRef.current);
        }
        expiryTimeoutRef.current = setTimeout(() => {
          localStorage.removeItem(orderStorageKey);
          setSuccessOrder(null);
          setActiveOrderId(null);
          setLiveStatus(null);
        }, remainingMs);
      }

      if (parsed.order?.id) {
        setSuccessOrder(parsed.order);
        setActiveOrderId(parsed.order.id);
        setLiveStatus(parsed.status || parsed.order.status || null);
        lastAnnouncedStatusRef.current =
          parsed.lastAnnouncedStatus || parsed.order.status || null;

        if (parsed.order.invoice_number) {
          await loadInvoice(parsed.order.invoice_number);
        }
      }
    } catch {
      localStorage.removeItem(orderStorageKey);
    }
  }, [loadInvoice, orderStorageKey]);

  const playTone = useCallback((frequency = 880) => {
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
      console.warn('Notification tone failed', error);
    }
  }, []);

  const persistOrder = useCallback(
    (order, status, lastAnnounced) => {
      if (!order?.id || !orderStorageKey) return;
      const payload = {
        expiresAt: Date.now() + ORDER_STORAGE_TTL_MS,
        order,
        status: status || order.status || null,
        lastAnnouncedStatus: lastAnnounced || order.status || null,
      };
      localStorage.setItem(orderStorageKey, JSON.stringify(payload));
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
      }
      expiryTimeoutRef.current = setTimeout(() => {
        localStorage.removeItem(orderStorageKey);
        setSuccessOrder(null);
        setActiveOrderId(null);
        setLiveStatus(null);
      }, ORDER_STORAGE_TTL_MS);
    },
    [orderStorageKey, ORDER_STORAGE_TTL_MS]
  );

  const handleKdsOrderEvent = useCallback(
    (order) => {
      if (!order || !activeOrderId || order.id !== activeOrderId) return;
      setLiveStatus(order.status);
      const shouldAnnounce =
        ['PREPARING', 'READY', 'SERVED', 'PAID'].includes(order.status) &&
        lastAnnouncedStatusRef.current !== order.status;

      if (
        shouldAnnounce
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
        playTone(order.status === 'READY' ? 1200 : 880);
        speakStatus(phrase);
        lastAnnouncedStatusRef.current = order.status;
      }

      setSuccessOrder((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, status: order.status, total: order.total ?? prev.total };
        persistOrder(updated, order.status, lastAnnouncedStatusRef.current);
        return updated;
      });
    },
    [activeOrderId, isAr, persistOrder, playTone, speakStatus]
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
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-20 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50 truncate">
                {store.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {store.address && (
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                    {store.address}
                  </p>
                )}
                {selectedBranch && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100">
                    {isAr ? `الفرع: ${selectedBranch.name}` : `Branch: ${selectedBranch.name}`}
                  </span>
                )}
              </div>
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
              {currentStatus && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-600/60 dark:bg-amber-900/20 dark:text-amber-100">
                  {isAr ? 'الحالة: ' : 'Status: '}
                  {formatStatusLabel(currentStatus)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-600 dark:text-gray-300">
                  {isAr ? 'الفرع' : 'Branch'}
                </label>
                <select
                  value={selectedBranchId || ''}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                  className="text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-gray-100"
                >
                  {!selectedBranchId && <option value="">{isAr ? 'اختر الفرع' : 'Select branch'}</option>}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* نوع الطلب */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-600 dark:text-gray-300">
                  {isAr ? 'نوع الطلب' : 'Order type'}
                </label>
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
              <input
                type="email"
                placeholder={isAr ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl px-3 py-3 text-[11px] text-gray-600 dark:text-gray-300 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                      {isAr ? 'طاولات الفرع' : 'Branch tables'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isAr ? 'اعرض الطاولات واحجزها بالوقت المناسب ثم افتح منيو الطاولة.' : 'View branch tables, reserve a slot, then open the table menu.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchTablesAvailability}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-[11px]"
                  >
                    <span className="text-sm">🔄</span>
                    <span>{isAr ? 'تحديث الطاولات' : 'Refresh tables'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isAr ? 'موعد الحجز' : 'Reservation time'}
                    </span>
                    <input
                      type="datetime-local"
                      value={tableFilters.datetime}
                      onChange={(e) => handleTableFilterChange('datetime', e.target.value)}
                      className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isAr ? 'عدد الأفراد' : 'Party size'}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={tableFilters.partySize}
                      onChange={(e) => handleTableFilterChange('partySize', Number(e.target.value) || 1)}
                      className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isAr ? 'المدة (دقائق)' : 'Duration (mins)'}
                    </span>
                    <input
                      type="number"
                      min={15}
                      value={tableFilters.duration}
                      onChange={(e) => handleTableFilterChange('duration', Number(e.target.value) || 60)}
                      className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {tablesLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? 'جاري تحميل الطاولات...' : 'Loading tables...'}</p>
                  ) : tables.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? 'لا توجد طاولات لهذا الفرع.' : 'No tables for this branch.'}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {tables.map((table) => {
                        const available = table.available_at_time ?? table.is_available;
                        return (
                          <div
                            key={table.id}
                            className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {isAr ? `طاولة ${table.number}` : `Table ${table.number}`}
                                </p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {isAr ? `السعة: ${table.capacity} أفراد` : `Capacity: ${table.capacity} guests`}
                                </p>
                                {table.branch_name && (
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {isAr ? `فرع: ${table.branch_name}` : `Branch: ${table.branch_name}`}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`text-[11px] px-2 py-1 rounded-full border ${available ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800'}`}
                              >
                                {available ? (isAr ? 'متاحة' : 'Available') : (isAr ? 'غير متاحة' : 'Unavailable')}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenTableMenu(table.id)}
                                className="flex-1 px-3 py-2 rounded-xl text-[12px] font-semibold bg-blue-600 text-white hover:bg-blue-700"
                              >
                                {isAr ? 'فتح منيو الطاولة' : 'Open table menu'}
                              </button>
                              <button
                                type="button"
                                disabled={!available || reservingTableId === table.id}
                                onClick={() => handleReserveTable(table.id)}
                                className="px-3 py-2 rounded-xl text-[12px] font-semibold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-900/30"
                              >
                                {reservingTableId === table.id
                                  ? (isAr ? 'جارٍ الحجز...' : 'Reserving...')
                                  : available
                                    ? (isAr ? 'حجز' : 'Reserve')
                                    : (isAr ? 'غير متاح' : 'Unavailable')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-center text-[11px] text-gray-500 dark:text-gray-400 bg-blue-50/60 dark:bg-slate-950 border border-blue-100 dark:border-slate-800 rounded-2xl px-3 py-3 space-y-2">
                <span className="font-semibold text-gray-800 dark:text-gray-100">
                  {isAr ? 'روابط المشاركة' : 'Shareable links'}
                </span>
                <span className="truncate text-gray-700 dark:text-gray-200">
                  {`${window.location.origin}/store/${storeId}/menu`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}/store/${storeId}/menu`).then(
                      () => notifySuccess(isAr ? 'تم نسخ الرابط' : 'Link copied'),
                      () => notifyError(isAr ? 'تعذر نسخ الرابط' : 'Could not copy link')
                    )
                  }
                  className="self-start px-3 py-1.5 rounded-lg bg-white border border-blue-100 text-blue-700 text-[11px] hover:bg-blue-100 dark:bg-slate-900 dark:border-slate-700 dark:text-blue-200"
                >
                  {isAr ? 'نسخ الرابط' : 'Copy link'}
                </button>
              </div>
            </div>
          </section>

          {/* المنتجات الترندي */}
          {trendingItems.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  {isAr ? 'الأكثر طلبًا في الفرع' : 'Trending in branch'}
                </p>
                {selectedBranch && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {isAr ? `الفرع: ${selectedBranch.name}` : `Branch: ${selectedBranch.name}`}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {trendingItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddToCart(item)}
                    className="text-right bg-blue-50/50 dark:bg-slate-950 hover:bg-blue-100 dark:hover:bg-slate-800 border border-blue-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-500 rounded-2xl p-3 flex flex-col justify-between min-h-[100px]"
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
            </section>
          )}

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
            <section className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100 rounded-2xl p-4 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  {isAr ? 'تم استلام طلبك بنجاح 🎉' : 'Your order has been received 🎉'}
                </p>
              {currentStatus && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white/70 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100">
                  {formatStatusLabel(currentStatus)}
                </span>
              )}
            </div>
            <p>{isAr ? 'رقم الطلب' : 'Order number'}: #{successOrder.id}</p>
            {selectedBranch && (
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-100/80">
                {isAr ? `الفرع: ${selectedBranch.name}` : `Branch: ${selectedBranch.name}`}
              </p>
            )}
            {successOrder?.invoice_number && (
              <p>
                {isAr ? 'رقم الفاتورة: ' : 'Invoice: '}
                {successOrder.invoice_number}
              </p>
            )}
            <p>
              {isAr ? 'الإجمالي: ' : 'Total: '}
              {numberFormatter.format(Number(successOrder.total || 0))} {isAr ? 'ج.م' : 'EGP'}
            </p>
            {invoiceLoading && (
              <p className="text-[11px] text-gray-500 dark:text-gray-300">
                {isAr ? 'جارِ تجهيز الفاتورة...' : 'Preparing your invoice...'}
              </p>
            )}
            {invoiceDetails && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openInvoicePrintWindow(invoiceDetails, isAr)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-blue-100 text-blue-700 text-[11px] hover:bg-blue-100 dark:bg-slate-900 dark:border-blue-800 dark:text-blue-200"
                >
                  {isAr ? 'حفظ/طباعة الفاتورة' : 'Save / Print invoice'}
                </button>
              </div>
            )}
            <p className="text-xs mt-2 text-emerald-700/80 dark:text-emerald-100/80">
              {isAr
                ? 'نقوم بتحديث الحالة تلقائيًا، وسنرسل لك تنبيهًا صوتيًا عند جاهزية الطلب.'
                : 'Status updates arrive automatically with voice alerts when ready.'}
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
  );
}
