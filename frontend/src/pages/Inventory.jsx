import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';
import { useStore } from '../hooks/useStore';
import { useAuth } from '../hooks/useAuth';

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');

  const [addBranchModalOpen, setAddBranchModalOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '' });
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [createBranchError, setCreateBranchError] = useState(null);

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(''); // client-side filter

  const { selectedStoreId } = useStore();
  const { user } = useAuth();

  const canManageInventory = useMemo(
    () => user?.is_superuser || ['OWNER', 'MANAGER'].includes(user?.role),
    [user]
  );

  // لما نبدّل الفرع الرئيسي، نفرّغ الفلاتر المرتبطة عشان ما يفضلش ماسك قيمة قديمة
  useEffect(() => {
    setBranchFilter('');
    setCategoryFilter('');
    setSearch('');
    setStatusFilter('all');
  }, [selectedStoreId]);

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

  const fetchCategories = async () => {
    if (!selectedStoreId) {
      setCategories([]);
      return;
    }

    try {
      setCategoriesLoading(true);
      // غالبًا عندك endpoint للكاتيجوري ضمن inventory app
      // لو مسارك مختلف عدّل السطر ده فقط.
      const res = await api.get('/inventory/categories/', {
        params: { store_id: selectedStoreId },
      });

      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCategories(data);
    } catch (err) {
      console.error('خطأ في تحميل التصنيفات:', err);
      // مش هنوقف الصفحة لو categories فشلت — دي تحسين UX
      notifyError('تعذر تحميل التصنيفات');
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();

    if (!selectedStoreId) {
      notifyError('اختر متجرًا قبل إضافة الفروع.');
      return;
    }

    if (!newBranch.name.trim()) {
      setCreateBranchError('اسم الفرع مطلوب');
      return;
    }

    try {
      setCreatingBranch(true);
      setCreateBranchError(null);

      await api.post(
        '/branches/',
        {
          name: newBranch.name.trim(),
          address: newBranch.address.trim() || null,
          phone: newBranch.phone.trim() || null,
        },
        { params: { store_id: selectedStoreId } }
      );

      notifySuccess('تم إضافة الفرع بنجاح');
      setAddBranchModalOpen(false);
      setNewBranch({ name: '', address: '', phone: '' });
      fetchBranches();
    } catch (err) {
      console.error('خطأ في إضافة الفرع:', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.name?.[0] ||
        'تعذر إضافة الفرع. برجاء المحاولة مرة أخرى.';
      setCreateBranchError(msg);
      notifyError(msg);
    } finally {
      setCreatingBranch(false);
    }
  };

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

      const res = await api.get('/inventory/inventory/', { params });

      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setInventory(results);
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
      fetchBranches();
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  useEffect(() => {
    if (selectedStoreId) fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter]);

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

      await api.post(`/inventory/inventory/${selectedEntry.id}/adjust-stock/`, {
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

  // فلترة Client-side للـ Category (عشان ما نعتمدش على باك إند جديد)
  const visibleInventory = useMemo(() => {
    if (!categoryFilter) return inventory;

    return inventory.filter((row) => {
      const rowCatId = row?.item?.category; // غالبًا ID
      const rowCatName = row?.item?.category_name || '';
      // نقبل بالـ id أو الاسم (لو frontend بيرجع name فقط)
      return String(rowCatId) === String(categoryFilter) || rowCatName === categoryFilter;
    });
  }, [inventory, categoryFilter]);

  // حساب KPIs على البيانات الظاهرة (بعد الفلاتر)
  const stats = useMemo(() => {
    const results = visibleInventory;

    const totalItems = results.length;
    const lowStockCount = results.filter((row) => row.is_low).length;
    const outOfStockCount = results.filter((row) => Number(row.quantity || 0) === 0).length;

    let totalUnits = 0;
    let totalSaleValue = 0;
    let totalCostValue = 0;
    let totalFallbackValue = 0;

    results.forEach((row) => {
      const qty = Number(row.quantity || 0);
      totalUnits += qty;

      const unitPrice = Number(row.item?.unit_price ?? 0);
      const costPrice = Number(row.item?.cost_price ?? 0);
      const fallbackPrice = Number(row.item?.cost_price ?? row.item?.unit_price ?? 0);

      totalSaleValue += qty * unitPrice;
      totalCostValue += qty * costPrice;
      totalFallbackValue += qty * fallbackPrice;
    });

    return {
      totalItems,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      totalSaleValue,
      totalCostValue,
      totalFallbackValue,
    };
  }, [visibleInventory]);

  const kpis = useMemo(() => {
    const base = [
      { id: 1, label: 'عدد الأصناف الظاهرة', value: stats.totalItems },
      { id: 2, label: 'إجمالي عدد الوحدات', value: stats.totalUnits },
      { id: 3, label: 'أصناف منخفضة المخزون', value: stats.lowStockCount },
      { id: 4, label: 'أصناف نفدت بالكامل', value: stats.outOfStockCount },
      {
        id: 5,
        label: 'قيمة المخزون (حسب آخر سعر معروف)',
        value: `${stats.totalFallbackValue.toLocaleString('ar-EG', {
          maximumFractionDigits: 0,
        })} ج.م`,
      },
      {
        id: 6,
        label: 'قيمة المخزون بسعر البيع',
        value: `${stats.totalSaleValue.toLocaleString('ar-EG', {
          maximumFractionDigits: 0,
        })} ج.م`,
      },
    ];

    if (canManageInventory) {
      base.push({
        id: 7,
        label: 'تكلفة شراء المخزون الحالية (COGS)',
        value: `${stats.totalCostValue.toLocaleString('ar-EG', {
          maximumFractionDigits: 0,
        })} ج.م`,
      });
    }

    return base;
  }, [stats, canManageInventory]);

  // ملخص Categories (محسوب من المخزون الظاهر + دمج مع categories endpoint لو موجود)
  const categorySummary = useMemo(() => {
    // map by category name (عرض)
    const map = new Map();

    visibleInventory.forEach((row) => {
      const catName = row?.item?.category_name || 'بدون تصنيف';
      const qty = Number(row.quantity || 0);
      const sale = Number(row.item?.unit_price ?? 0) * qty;
      const cost = Number(row.item?.cost_price ?? 0) * qty;

      const current = map.get(catName) || {
        name: catName,
        itemsCount: 0,
        totalQty: 0,
        saleValue: 0,
        costValue: 0,
      };

      current.itemsCount += 1;
      current.totalQty += qty;
      current.saleValue += sale;
      current.costValue += cost;

      map.set(catName, current);
    });

    // ترتيب: أعلى قيمة بيع أولًا
    return Array.from(map.values()).sort((a, b) => b.saleValue - a.saleValue);
  }, [visibleInventory]);

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
                كل الأصناف + قيم البيع/الشراء + ملخص التصنيفات
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
                title="فلتر الفرع"
              >
                <option value="">كل الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                title="فلتر التصنيف"
              >
                <option value="">كل التصنيفات</option>
                {/* لو categories endpoint شغال هنستخدمه */}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.items_count ?? 0})
                  </option>
                ))}
                {/* fallback: لو categories فاضية، المستخدم يقدر يفلتر من الملخص تحت */}
              </select>

              {canManageInventory && (
                <button
                  type="button"
                  onClick={() => {
                    setAddBranchModalOpen(true);
                    setCreateBranchError(null);
                  }}
                  className="text-sm px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition"
                >
                  إضافة فرع
                </button>
              )}

              {(branchesLoading || categoriesLoading) && (
                <span className="text-[11px] text-gray-500">
                  {branchesLoading ? 'تحميل الفروع...' : ''}
                  {branchesLoading && categoriesLoading ? ' • ' : ''}                  
                  {categoriesLoading ? 'تحميل التصنيفات...' : ''}
                </span>
              )}

              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  {(user?.name || user?.email || 'U')?.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800">
                    {user?.is_superuser ? 'Superuser' : user?.role || 'User'}
                  </p>
                  <p className="text-[11px] text-gray-500">Inventory</p>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6">
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

            {/* Category summary */}
            {!loading && categorySummary.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">ملخص التصنيفات</h3>
                    <p className="text-[11px] text-gray-500 mt-1">
                      عدد الأصناف + إجمالي الكمية + القيم داخل كل Category (حسب الفلاتر الحالية)
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700"
                    onClick={() => setCategoryFilter('')}
                    title="إلغاء فلتر التصنيف"
                  >
                    إلغاء فلتر التصنيف
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {categorySummary.slice(0, 8).map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setCategoryFilter(c.name)} // fallback by name
                      className="text-right bg-gray-50 hover:bg-gray-100 transition rounded-2xl border border-gray-100 p-4"
                      title="اضغط لفلترة الجدول بهذا التصنيف"
                    >
                      <p className="text-xs font-semibold text-gray-900">{c.name}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        أصناف: {c.itemsCount} • وحدات: {c.totalQty}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-2">
                        قيمة البيع:{' '}
                        <span className="font-semibold">
                          {c.saleValue.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
                        </span>
                      </p>
                      {canManageInventory && (
                        <p className="text-[11px] text-gray-600 mt-1">
                          تكلفة الشراء:{' '}
                          <span className="font-semibold">
                            {c.costValue.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م
                          </span>
                        </p>
                      )}
                    </button>
                  ))}
                </div>

                {categorySummary.length > 8 && (
                  <p className="mt-3 text-[11px] text-gray-400">
                    * يتم عرض أعلى 8 تصنيفات حسب قيمة البيع. (تقدر تضغط على أي تصنيف للفلترة)
                  </p>
                )}
              </section>
            )}

            {/* Inventory table */}
            {!loading && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">قائمة المخزون</h3>
                    <p className="text-[11px] text-gray-500 mt-1">
                      كل صنف مع كميته + قيم البيع/الشراء + حد إعادة الطلب في كل فرع
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-gray-50 text-gray-600">
                    {visibleInventory.length} صفوف معروضة
                  </span>
                </div>

                {visibleInventory.length === 0 ? (
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
                            سعر البيع
                          </th>
                          {canManageInventory && (
                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                              تكلفة الشراء
                            </th>
                          )}

                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            الكمية
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            حد إعادة الطلب
                          </th>

                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            قيمة المخزون (بيع)
                          </th>
                          {canManageInventory && (
                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                              قيمة المخزون (شراء)
                            </th>
                          )}

                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            الحالة
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                            آخر تحديث
                          </th>
                          {canManageInventory && (
                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                              إجراءات
                            </th>
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {visibleInventory.map((row) => {
                          const qty = Number(row.quantity || 0);
                          const isOut = qty === 0;
                          const isLow = row.is_low;

                          const salePrice = Number(row.item?.unit_price ?? 0);
                          const costPrice = Number(row.item?.cost_price ?? 0);

                          const saleTotal = salePrice * qty;
                          const costTotal = costPrice * qty;

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
                                {row.item?.category_name || 'بدون تصنيف'}
                              </td>

                              <td className="py-2 px-2 whitespace-nowrap text-gray-600">
                                {row.branch_name || '-'}
                              </td>

                              <td className="py-2 px-2 whitespace-nowrap text-gray-800">
                                {salePrice.toLocaleString('ar-EG', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                ج.م
                              </td>

                              {canManageInventory && (
                                <td className="py-2 px-2 whitespace-nowrap text-gray-800">
                                  {costPrice.toLocaleString('ar-EG', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  ج.م
                                </td>
                              )}

                              <td className="py-2 px-2 whitespace-nowrap text-gray-800">
                                {qty}
                              </td>

                              <td className="py-2 px-2 whitespace-nowrap text-gray-800">
                                {row.min_stock}
                              </td>

                              <td className="py-2 px-2 whitespace-nowrap text-gray-800">
                                {saleTotal.toLocaleString('ar-EG', {
                                  maximumFractionDigits: 0,
                                })}{' '}
                                ج.م
                              </td>

                              {canManageInventory && (
                                <td className="py-2 px-2 whitespace-nowrap text-gray-800">
                                  {costTotal.toLocaleString('ar-EG', {
                                    maximumFractionDigits: 0,
                                  })}{' '}
                                  ج.م
                                </td>
                              )}

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

                              {canManageInventory && (
                                <td className="py-2 px-2 whitespace-nowrap">
                                  <button
                                    type="button"
                                    className="text-[11px] px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700"
                                    onClick={() => openAdjustModal(row)}
                                  >
                                    تعديل المخزون
                                  </button>
                                </td>
                              )}
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

            {/* مودال إضافة فرع */}
            {addBranchModalOpen && canManageInventory && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 p-5" dir="rtl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">إضافة فرع جديد</h3>
                  <p className="text-[11px] text-gray-500 mb-4">
                    سيتم ربط الفرع بالمتجر الحالي، ولن يظهر هذا الزر لموظفي الكاشير.
                  </p>

                  {createBranchError && (
                    <div className="mb-3 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl">
                      {createBranchError}
                    </div>
                  )}

                  <form onSubmit={handleCreateBranch} className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">اسم الفرع</label>
                      <input
                        type="text"
                        value={newBranch.name}
                        onChange={(e) =>
                          setNewBranch((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="مثال: فرع التجمع الخامس"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">العنوان (اختياري)</label>
                      <input
                        type="text"
                        value={newBranch.address}
                        onChange={(e) =>
                          setNewBranch((prev) => ({ ...prev, address: e.target.value }))
                        }
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="العنوان التفصيلي للفرع"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">رقم الهاتف (اختياري)</label>
                      <input
                        type="text"
                        value={newBranch.phone}
                        onChange={(e) =>
                          setNewBranch((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="01xxxxxxxxx"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAddBranchModalOpen(false);
                          setCreateBranchError(null);
                        }}
                        className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                        disabled={creatingBranch}
                      >
                        إلغاء
                      </button>

                      <button
                        type="submit"
                        className="text-sm px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-60"
                        disabled={creatingBranch}
                      >
                        {creatingBranch ? 'جارٍ الحفظ...' : 'حفظ الفرع'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* مودال تعديل المخزون */}
            {adjustModalOpen && selectedEntry && canManageInventory && (
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
