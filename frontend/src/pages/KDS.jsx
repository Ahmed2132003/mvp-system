// src/pages/KDS.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError, notifyInfo, notifySuccess } from '../lib/notifications';

const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY'];

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);

  // -----------------------------
  // REST: تحميل الطلبات للـ KDS
  // -----------------------------
  const fetchKDSOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/orders/kds/');
      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setOrders(results);
    } catch (err) {
      console.error('خطأ في تحميل طلبات KDS:', err);
      notifyError('حدث خطأ أثناء تحميل طلبات المطبخ، حاول تحديث الصفحة.');
    } finally {
      setLoading(false);
    }
  }, []);

  // -----------------------------
  // Handlers لتحديث الـ state
  // -----------------------------
  const playTone = useCallback((frequency = 920) => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
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
      console.error('تعذر تشغيل صوت الإشعار:', error);
    }
  }, []);

  const statusLabels = useMemo(
    () => ({
      PENDING: 'طلب جديد',
      PREPARING: 'قيد التحضير',
      READY: 'جاهز',
      SERVED: 'تم التسليم',
    }),
    []
  );

  const handleOrderCreated = useCallback(
    (order) => {
      if (!ACTIVE_STATUSES.includes(order.status)) return;

      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        if (exists) {
          return prev.map((o) => (o.id === order.id ? order : o));
        }

        notifySuccess(`طلب جديد #${order.id} وصل إلى المطبخ.`);
        playTone(980);
        return [...prev, order];
      });
    },
    [playTone]
  );

  const handleOrderUpdated = useCallback(
    (order) => {
      setOrders((prev) => {
        const previous = prev.find((o) => o.id === order.id);

        if (!ACTIVE_STATUSES.includes(order.status)) {
          return prev.filter((o) => o.id !== order.id);
        }

        const exists = Boolean(previous);

        if (!exists) {
          notifySuccess(`طلب جديد #${order.id} وصل إلى المطبخ.`);
          playTone(980);
          return [...prev, order];
        }

        if (previous.status !== order.status) {
          const label = statusLabels[order.status] || order.status;
          notifyInfo(`تم تحديث الطلب #${order.id} إلى حالة: ${label}.`);
          playTone(order.status === 'READY' ? 1200 : 860);
        }

        return prev.map((o) => (o.id === order.id ? order : o));
      });
    },
    [playTone, statusLabels]
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
      console.log('✅ KDS WebSocket connected');
      setWsConnected(true);
      notifySuccess('تم الاتصال بشاشة المطبخ بالوقت الحقيقي.');
    };

    ws.onclose = () => {
      console.log('❌ KDS WebSocket disconnected');
      setWsConnected(false);
      notifyInfo('تم فقد الاتصال بالوقت الحقيقي، سيتم عرض البيانات الأخيرة فقط.');
    };

    ws.onerror = (err) => {
      console.error('KDS WebSocket error:', err);
      setWsConnected(false);
      notifyError('حدث خطأ في اتصال شاشة المطبخ بالوقت الحقيقي.');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'order_created') {
          handleOrderCreated(data.order);
        } else if (data.type === 'order_updated') {
          handleOrderUpdated(data.order);
        }
      } catch (e) {
        console.error('خطأ في قراءة رسالة WebSocket:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [fetchKDSOrders, handleOrderCreated, handleOrderUpdated]);

  // -----------------------------
  // تغيير حالة الطلب من الـ UI
  // -----------------------------
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

      await api.patch(`/orders/${orderId}/`, { status: newStatus });

      let msg = '';
      if (newStatus === 'PREPARING') msg = 'تم بدء تحضير الطلب.';
      else if (newStatus === 'READY') msg = 'الطلب جاهز للتقديم.';
      else if (newStatus === 'SERVED') msg = 'تم تسليم الطلب للعميل.';

      if (msg) notifySuccess(msg);
    } catch (err) {
      console.error('خطأ في تحديث حالة الطلب:', err);
      notifyError('فشل تحديث حالة الطلب، تم إعادة تحميل القائمة.');
      fetchKDSOrders();
    }
  };

  // -----------------------------
  // تقسيم الطلبات حسب الحالة
  // -----------------------------
  const grouped = useMemo(() => {
    const byStatus = {
      PENDING: [],
      PREPARING: [],
      READY: [],
    };
    orders.forEach((order) => {
      if (byStatus[order.status]) {
        byStatus[order.status].push(order);
      }
    });
    return byStatus;
  }, [orders]);

  const renderOrderCard = (order, column) => {
    const createdAt = order.created_at ? new Date(order.created_at) : null;
    const timeLabel = createdAt
      ? createdAt.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '--';

    return (
      <div
        key={order.id}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">#{order.id}</p>
            <p className="text-[11px] text-gray-500">
              {order.table_number ? `طاولة ${order.table_number}` : 'بدون طاولة'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-500">{timeLabel}</p>
            <p className="text-[10px] text-gray-400">
              {order.customer_name || 'عميل بدون اسم'}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-2">
          {order.items && order.items.length > 0 ? (
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between text-xs text-gray-800"
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-[11px] text-gray-600">x {item.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-gray-400">لا توجد تفاصيل أصناف متاحة.</p>
          )}
        </div>

        {order.notes && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-2 py-1 text-[11px] text-yellow-800">
            ملاحظة: {order.notes}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-gray-800">{order.total} ج.م</span>

          <div className="flex gap-1">
            {column === 'PENDING' && (
              <button
                type="button"
                onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                className="text-[11px] px-2 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700"
              >
                بدء التحضير
              </button>
            )}

            {column === 'PREPARING' && (
              <button
                type="button"
                onClick={() => updateOrderStatus(order.id, 'READY')}
                className="text-[11px] px-2 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                جاهز للتقديم
              </button>
            )}

            {column === 'READY' && (
              <button
                type="button"
                onClick={() => updateOrderStatus(order.id, 'SERVED')}
                className="text-[11px] px-2 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-900"
              >
                تم التسليم
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderColumn = (title, statusKey, colorClasses) => {
    const list = grouped[statusKey] || [];

    return (
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-2xl">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-[11px] text-gray-500">{list.length} طلب</p>
          </div>
          <span className={`text-[11px] px-2 py-1 rounded-full ${colorClasses}`}>
            {statusKey}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading ? (
            <div className="text-xs text-gray-500 mt-2 text-center">جاري التحميل...</div>
          ) : list.length === 0 ? (
            <div className="text-xs text-gray-400 mt-2 text-center">
              لا توجد طلبات في هذه الحالة حاليًا.
            </div>
          ) : (
            list.map((order) => renderOrderCard(order, statusKey))
          )}
        </div>
      </div>
    );
  };

  // -----------------------------
  // UI عام (نفس ستايل الداشبورد/POS)
  // -----------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen" dir="rtl">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b">
            <h1 className="text-xl font-bold text-primary">MVP POS</h1>
            <p className="text-xs text-gray-500 mt-1">شاشة المطبخ (KDS)</p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <Link
              to="/dashboard"
              className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              الداشبورد
            </Link>

            <Link
              to="/pos"
              className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              شاشة الكاشير (POS)
            </Link>

            <Link
              to="/kds"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700"
            >
              <span>شاشة المطبخ (KDS)</span>
              <span className="text-[10px] bg-blue-100 px-2 py-0.5 rounded-full">
                الآن
              </span>
            </Link>
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500">
            {wsConnected ? 'متصل بالوقت الحقيقي ✅' : 'غير متصل بالـ WebSocket ⚠️'}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col">
          <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                شاشة المطبخ (KDS)
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                متابعة الطلبات الجديدة وتغيير حالتها لحظيًا من داخل المطبخ.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-[11px] px-3 py-1 rounded-full border ${
                  wsConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-red-50 text-red-700 border-red-100'
                }`}
              >
                {wsConnected ? 'متصل بالـ WebSocket' : 'لا يوجد اتصال WebSocket'}
              </span>
            </div>
          </header>

          <div className="px-4 md:px-8 py-4 md:py-6 flex-1 flex flex-col">
            <div className="flex gap-4 h-[calc(100vh-140px)]">
              {renderColumn(
                'جديدة',
                'PENDING',
                'bg-yellow-50 text-yellow-700 border border-yellow-200'
              )}
              {renderColumn(
                'قيد التحضير',
                'PREPARING',
                'bg-blue-50 text-blue-700 border border-blue-200'
              )}
              {renderColumn(
                'جاهزة',
                'READY',
                'bg-emerald-50 text-emerald-700 border border-emerald-200'
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
