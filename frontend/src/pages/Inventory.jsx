import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';
import { useStore } from '../hooks/useStore';

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalValue: 0,
  });

  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');

  const { selectedStoreId } = useStore();

  // حالة مودال تعديل المخزون
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    movement_type: 'IN',
    quantity: '',
    reason: '',
  });
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (search) params.item_name = search;
      if (statusFilter === 'low') params.status = 'low';
      if (statusFilter === 'out') params.status = 'out';
      if (branchFilter) params.branch = branchFilter;

      const res = await api.get('/inventory/', { params });

      const results = Array.isArray(res.data) ? res.data : res.data.results || [];

      setInventory(results);

      // حساب الـ KPIs
      let totalItems = results.length;
      let lowStockCount = results.filter((row) => row.is_low).length;
      let outOfStockCount = results.filter((row) => row.quantity === 0).length;
      let totalValue = 0;

      results.forEach((row) => {
        const qty = row.quantity || 0;
        const unitPrice = row.item?.cost_price ?? row.item?.unit_price ?? 0;
        totalValue += qty * Number(unitPrice);
      });

      setStats({
        totalItems,
        lowStockCount,
        outOfStockCount,
        totalValue,
      });
    } catch (err) {
      console.error('خطأ في تحميل بيانات المخزون:', err);
      const msg = 'حدث خطأ أثناء تحميل بيانات المخزون';
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      fetchInventory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, branchFilter]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchBranches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  const fetchBranches = async () => {
    if (!selectedStoreId) {
      setBranches([]);
      return;
    }

    try {
      setBranchesLoading(true);
      const res = await api.get('/branches/', {
        params: { store_id: selectedStoreId },
      });

      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setBranches(data);
    } catch (err) {
      console.error('خطأ في تحميل الفروع المتاحة:', err);
      notifyError('تعذر تحميل الفروع المتاحة');
    } finally {
      setBranchesLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInventory();
  };

  const openAdjustModal = (entry) => {
    setSelectedEntry(entry);
    setAdjustForm({
      movement_type: 'IN',
      quantity: '',
      reason: '',
    });
    setAdjustError(null);
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEntry) return;

    const qty = Number(adjustForm.quantity);

    if (!qty || qty <= 0) {
      const msg = 'الكمية لازم تكون رقم أكبر من صفر';
      setAdjustError(msg);
      notifyError(msg);
      return;
    }

    try {
      setSavingAdjust(true);
      setAdjustError(null);

      await api.post(`/inventory/${selectedEntry.id}/adjust-stock/`, {
        movement_type: adjustForm.movement_type,
        change: qty,
        reason: adjustForm.reason || undefined,
      });

      notifySuccess('تم تعديل المخزون بنجاح');
      setAdjustModalOpen(false);
      setSelectedEntry(null);
      await fetchInventory();
    } catch (err) {
      console.error('خطأ في تعديل المخزون:', err);
      const msg =
        err.response?.data?.detail ||
        'حدث خطأ أثناء تعديل المخزون. تأكد من الإعدادات والكمية.';
      setAdjustError(msg);
      notifyError(msg);
    } finally {
      setSavingAdjust(false);
    }
  };

  const kpis = [
    {
      id: 1,
      label: 'عدد أصناف المخزون',
      value: stats.totalItems,
    },
    {
      id: 2,
      label: 'أصناف منخفضة المخزون',
      value: stats.lowStockCount,
    },
    {
      id: 3,
      label: 'أصناف نفدت بالكامل',
      value: stats.outOfStockCount,
    },
    {
      id: 4,
      label: 'قيمة المخزون التقديرية',
      value: `${stats.totalValue.toLocaleString('ar-EG', {
        maximumFractionDigits: 0,
      })} ج.م`,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen" dir="rtl">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b">
            <h1 className="text-xl font-bold text-primary">MVP POS</h1>
            <p className="text-xs text-gray-500 mt-1">لوحة إدارة النظام</p>
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
              to="/inventory"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700"
            >
              <span>إدارة المخزون</span>
              <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full">الآن</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              الإعدادات
            </Link>

            <Link
              to="/users/create"
              className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              إدارة المستخدمين
            </Link>
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500">
            نسخة تجريبية • جاهز للانطلاق 🚀
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900">إدارة المخزون</h2>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                راقب كميات الأصناف وتابع الحالات الحرجة في كل الفروع
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setTimeout(fetchInventory, 0);
                }}
                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">كل الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              {branchesLoading && (
                <span className="text-[11px] text-gray-500">يتم تحميل الفروع...</span>
              )}
              
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  O
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800">Owner</p>
                  <p className="text-[11px] text-gray-500">إدارة المخزون</p>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6">
            {/* حالة التحميل / الخطأ */}
            {loading && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl">
                جاري تحميل بيانات المخزون...
              </div>
            )}

            {error && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl">
                {error}
              </div>
            )}

            {/* KPIs */}
            {!loading && (
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2"
                  >
                    <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                  </div>
                ))}
              </section>
            )}

            {/* Filters */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row md:items-center gap-3">
              <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث باسم الصنف..."
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="submit"
                  className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  بحث
                </button>
              </form>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">حالة المخزون:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setTimeout(fetchInventory, 0);
                  }}
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">الكل</option>
                  <option value="low">منخفض</option>
                  <option value="out">منتهي</option>
                </select>
              </div>
            </section>

            {/* Inventory table */}
            {!loading && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">قائمة المخزون</h3>
                    <p className="text-[11px] text-gray-500 mt-1">
                      كل صنف مع كميته الحالية وحد إعادة الطلب في كل فرع
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-gray-50 text-gray-600">
                    {inventory.length} صفوف معروضة
                  </span>
                </div>

                {inventory.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    لا توجد بيانات مخزون مطابقة للفلاتر الحالية.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            الصنف
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            التصنيف
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            الفرع
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            الكمية
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            حد إعادة الطلب
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            الحالة
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            آخر تحديث
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            إجراءات
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map((row) => {
                          const isOut = row.quantity === 0;
                          const isLow = row.is_low;

                          let statusLabel = 'مستقر';
                          let statusClass = 'bg-emerald-50 text-emerald-700';

                          if (isOut) {
                            statusLabel = 'منتهي';
                            statusClass = 'bg-red-50 text-red-700';
                          } else if (isLow) {
                            statusLabel = 'منخفض';
                            statusClass = 'bg-amber-50 text-amber-700';
                          }

                          const updatedAt = row.last_updated
                            ? new Date(row.last_updated).toLocaleString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })
                            : '--';

                          return (
                            <tr
                              key={row.id}
                              className="border-b border-gray-50 hover:bg-gray-50/60"
                            >
                              <td className="py-2 px-2 whitespace-nowrap font-semibold text-gray-800">
                                {row.item?.name || 'غير محدد'}
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap text-gray-600">
                                {row.item?.category_name || '-'}
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap text-gray-600">
                                {row.branch_name || '-'}
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap text-gray-800">
                                {row.quantity}
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap text-gray-800">
                                {row.min_stock}
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${statusClass}`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap text-gray-600">
                                {updatedAt}
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  className="text-[11px] px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700"
                                  onClick={() => openAdjustModal(row)}
                                >
                                  تعديل المخزون
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="mt-4 text-[11px] text-gray-400">
                  * لاحقًا: هنضيف شاشة كاملة لتاريخ الحركات وربطها بالجرد والشراء.
                </p>
              </section>
            )}

            {/* مودال تعديل المخزون */}
            {adjustModalOpen && selectedEntry && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 p-5" dir="rtl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    تعديل مخزون الصنف
                  </h3>
                  <p className="text-[11px] text-gray-500 mb-3">
                    {selectedEntry.item?.name} – {selectedEntry.branch_name}
                  </p>

                  <div className="mb-3 text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                    <p>الكمية الحالية: {selectedEntry.quantity}</p>
                    <p>حد إعادة الطلب: {selectedEntry.min_stock}</p>
                  </div>

                  {adjustError && (
                    <div className="mb-3 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl">
                      {adjustError}
                    </div>
                  )}

                  <form onSubmit={handleAdjustSubmit} className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-gray-600 mb-1">
                          نوع الحركة
                        </label>
                        <select
                          value={adjustForm.movement_type}
                          onChange={(e) =>
                            setAdjustForm((prev) => ({
                              ...prev,
                              movement_type: e.target.value,
                            }))
                          }
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <option value="IN">إضافة للمخزون</option>
                          <option value="OUT">خصم من المخزون</option>
                        </select>
                      </div>

                      <div className="w-32">
                        <label className="block text-[11px] text-gray-600 mb-1">
                          الكمية
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={adjustForm.quantity}
                          onChange={(e) =>
                            setAdjustForm((prev) => ({
                              ...prev,
                              quantity: e.target.value,
                            }))
                          }
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                          placeholder="مثال: 5"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        السبب (اختياري)
                      </label>
                      <input
                        type="text"
                        value={adjustForm.reason}
                        onChange={(e) =>
                          setAdjustForm((prev) => ({
                            ...prev,
                            reason: e.target.value,
                          }))
                        }
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="مثال: جرد، هالك، تصحيح..."
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                        onClick={() => {
                          setAdjustModalOpen(false);
                          setSelectedEntry(null);
                          setAdjustError(null);
                        }}
                      >
                        إلغاء
                      </button>

                      <button
                        type="submit"
                        disabled={savingAdjust}
                        className="text-xs px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {savingAdjust ? 'جارٍ الحفظ...' : 'حفظ التعديل'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
