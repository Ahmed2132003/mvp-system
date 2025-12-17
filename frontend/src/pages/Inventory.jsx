import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';
import { useStore } from '../hooks/useStore';
import { useAuth } from '../hooks/useAuth';

// =====================
// Sidebar Navigation
// =====================
function SidebarNav({ lang }) {
  const isAr = lang === 'ar';

  return (
    <>
      <Link
        to="/dashboard"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        <span>{isAr ? 'الداشبورد' : 'Dashboard'}</span>
      </Link>

      <Link
        to="/pos"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'شاشة الكاشير (POS)' : 'Cashier Screen (POS)'}
      </Link>

      <Link
        to="/inventory"
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
      >
        <span>{isAr ? 'إدارة المخزون' : 'Inventory Management'}</span>
        <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
          {isAr ? 'الآن' : 'Now'}
        </span>
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

      {/* ✅ Employees */}
      <Link
        to="/employees"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الموظفين' : 'Employees'}
      </Link>

      {/* ✅ Accounting */}
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

      <button
        type="button"
        className="w-full text-right flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'التقارير' : 'Reports (Soon)'}
      </button>
    </>
  );
}

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
  const [categoryFilter, setCategoryFilter] = useState('');

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    movement_type: 'IN',
    quantity: '',
    reason: '',
  });
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState(null);

  const [me, setMe] = useState(null);

  const {
    stores,
    storesLoading,
    storesError,
    selectedStoreId,
    // eslint-disable-next-line no-unused-vars
    selectedStore,
    selectStore,
  } = useStore();

  const { user } = useAuth();

  // theme & language (زي الداشبورد بالظبط)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAr = lang === 'ar';
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG'),
    [isAr]
  );


  const canManageInventory = useMemo(
    () => user?.is_superuser || ['OWNER', 'MANAGER'].includes(user?.role),
    [user]
  );

  // تطبيق الثيم على <html> + حفظه
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // تطبيق اللغة والاتجاه على <html> + حفظها
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  // لما نبدّل الستور، نفرّغ الفلاتر
  useEffect(() => {
    setBranchFilter('');
    setCategoryFilter('');
    setSearch('');
    setStatusFilter('all');
  }, [selectedStoreId]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  const fetchMe = async () => {
    try {
      const res = await api.get('/auth/me/');
      setMe(res.data);
    } catch  {
      // silent
    }
  };

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
      notifyError(isAr ? 'تعذر تحميل الفروع المتاحة' : 'Failed to load branches');
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
      const res = await api.get('/inventory/categories/', {
        params: { store_id: selectedStoreId },
      });
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCategories(data);
    } catch (err) {
      console.error('خطأ في تحميل التصنيفات:', err);
      notifyError(isAr ? 'تعذر تحميل التصنيفات' : 'Failed to load categories');
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
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
      const msg = isAr ? 'حدث خطأ أثناء تحميل بيانات المخزون' : 'Failed to load inventory';
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchInventory();
      fetchBranches();
      fetchCategories();
    } else {
      setInventory([]);
      setBranches([]);
      setCategories([]);
      setLoading(false);
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

  const handleCreateBranch = async (e) => {
    e.preventDefault();

    if (!selectedStoreId) {
      notifyError(isAr ? 'اختر متجرًا قبل إضافة الفروع.' : 'Select a store before adding branches.');
      return;
    }

    if (!newBranch.name.trim()) {
      setCreateBranchError(isAr ? 'اسم الفرع مطلوب' : 'Branch name is required');
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

      notifySuccess(isAr ? 'تم إضافة الفرع بنجاح' : 'Branch created successfully');
      setAddBranchModalOpen(false);
      setNewBranch({ name: '', address: '', phone: '' });
      fetchBranches();
      // مهم: بعد إضافة فرع، أول GET للمخزون في الباك اند بيعمل bulk_create للـ Inventory
      setTimeout(fetchInventory, 0);
    } catch (err) {
      console.error('خطأ في إضافة الفرع:', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.name?.[0] ||
        (isAr ? 'تعذر إضافة الفرع. برجاء المحاولة مرة أخرى.' : 'Could not create branch. Try again.');
      setCreateBranchError(msg);
      notifyError(msg);
    } finally {
      setCreatingBranch(false);
    }
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
      const msg = isAr ? 'الكمية لازم تكون رقم أكبر من صفر' : 'Quantity must be greater than zero';
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

      notifySuccess(isAr ? 'تم تعديل المخزون بنجاح' : 'Stock adjusted successfully');
      setAdjustModalOpen(false);
      setSelectedEntry(null);
      await fetchInventory();
    } catch (err) {
      console.error('خطأ في تعديل المخزون:', err);
      const msg =
        err.response?.data?.detail ||
        (isAr
          ? 'حدث خطأ أثناء تعديل المخزون. تأكد من الإعدادات والكمية.'
          : 'Failed to adjust stock. Check settings and quantity.');
      setAdjustError(msg);
      notifyError(msg);
    } finally {
      setSavingAdjust(false);
    }
  };

  // ✅ حذف الصنف نفسه (Item)
  const handleDeleteItem = async (row) => {
    const itemId = row?.item?.id;
    const itemName = row?.item?.name || (isAr ? 'الصنف' : 'Item');

    if (!itemId) {
      notifyError(isAr ? 'لا يمكن تحديد الصنف لحذفه' : 'Unable to resolve item to delete');
      return;
    }

    const ok = window.confirm(
      isAr
        ? `هل أنت متأكد أنك تريد حذف الصنف "${itemName}" نهائيًا؟\n(هذا الإجراء لا يمكن التراجع عنه)`
        : `Are you sure you want to permanently delete "${itemName}"?\n(This cannot be undone)`
    );

    if (!ok) return;

    try {
      // مسار الـ ItemViewSet غالبًا: /inventory/items/<id>/
      await api.delete(`/inventory/items/${itemId}/`);
      notifySuccess(isAr ? 'تم حذف الصنف بنجاح' : 'Item deleted successfully');
      await fetchInventory();
      await fetchCategories();
    } catch (err) {
      console.error('خطأ في حذف الصنف:', err);
      const msg =
        err.response?.data?.detail ||
        (isAr ? 'تعذر حذف الصنف. تأكد أنه غير مرتبط ببيانات أخرى.' : 'Failed to delete item. It may be linked to other records.');
      notifyError(msg);
    }
  };

  // فلترة Client-side للـ Category
  const visibleInventory = useMemo(() => {
    if (!categoryFilter) return inventory;

    return inventory.filter((row) => {
      const rowCatId = row?.item?.category;
      const rowCatName = row?.item?.category_name || '';
      return String(rowCatId) === String(categoryFilter) || rowCatName === categoryFilter;
    });
  }, [inventory, categoryFilter]);

  

const tableInventory = useMemo(() => {
  // لو فيه فلتر فرع → نعرض كل السجلات بدون تجميع (عشان المستخدم عارف هو بيشوف فرع واحد)
  if (branchFilter) return visibleInventory;

  // منع تكرار نفس الصنف في أكثر من صف عند عرض كل الفروع
  const map = new Map();

  tableInventory.forEach((row) => {
    const key = row?.item?.id ?? row.id;
    const qty = Number(row.quantity || 0);
    const minStock = Number(row.min_stock || 0);
    const branches = row.branch_name ? [row.branch_name] : [];

    if (!map.has(key)) {
      map.set(key, {
        ...row,
        quantity: qty,
        min_stock: minStock,
        aggregatedBranches: branches,
      });
      return;
    }

    const current = map.get(key);
    current.quantity += qty;
    current.min_stock += minStock;
    current.is_low = current.is_low || row.is_low;
    current.aggregatedBranches = [...current.aggregatedBranches, ...branches];
  });

  return Array.from(map.values()).map((row) => ({
    ...row,
    branch_name: row.aggregatedBranches?.length
      ? Array.from(new Set(row.aggregatedBranches)).join(' / ')
      : row.branch_name || (isAr ? 'كل الفروع' : 'All branches'),
  }));
}, [branchFilter, visibleInventory, isAr]);
const stats = useMemo(() => {
    const results = tableInventory;

    const totalItems = results.length;
    const lowStockCount = results.filter((row) => Number(row.quantity || 0) <= Number(row.min_stock || 0)).length;
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
  }, [tableInventory]);

  const kpis = useMemo(() => {
    const base = [
      {
        id: 1,
        label: isAr ? 'عدد الأصناف الظاهرة' : 'Visible items',
        value: stats.totalItems,
      },
      {
        id: 2,
        label: isAr ? 'إجمالي عدد الوحدات' : 'Total units',
        value: stats.totalUnits,
      },
      {
        id: 3,
        label: isAr ? 'أصناف منخفضة المخزون' : 'Low stock items',
        value: stats.lowStockCount,
      },
      {
        id: 4,
        label: isAr ? 'أصناف نفدت بالكامل' : 'Out of stock items',
        value: stats.outOfStockCount,
      },
      {
        id: 5,
        label: isAr ? 'قيمة المخزون (حسب آخر سعر معروف)' : 'Inventory value (fallback price)',
        value: `${numberFormatter.format(Math.round(stats.totalFallbackValue || 0))} ${
          isAr ? 'ج.م' : 'EGP'
        }`,
      },
      {
        id: 6,
        label: isAr ? 'قيمة المخزون بسعر البيع' : 'Inventory value (sale price)',
        value: `${numberFormatter.format(Math.round(stats.totalSaleValue || 0))} ${
          isAr ? 'ج.م' : 'EGP'
        }`,
      },
    ];

    if (canManageInventory) {
      base.push({
        id: 7,
        label: isAr ? 'تكلفة شراء المخزون الحالية (COGS)' : 'Inventory cost (COGS)',
        value: `${numberFormatter.format(Math.round(stats.totalCostValue || 0))} ${
          isAr ? 'ج.م' : 'EGP'
        }`,
      });
    }

    return base;
  }, [stats, canManageInventory, isAr, numberFormatter]);

  const categorySummary = useMemo(() => {
    const map = new Map();

    tableInventory.forEach((row) => {
      const catName = row?.item?.category_name || (isAr ? 'بدون تصنيف' : 'Uncategorized');
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

    return Array.from(map.values()).sort((a, b) => b.saleValue - a.saleValue);
  }, [tableInventory, isAr]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <h1 className="text-xl font-bold text-primary dark:text-blue-300">MVP POS</h1>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
              {isAr ? 'لوحة تحكم الكافيه / المطعم' : 'Restaurant / Café Dashboard'}
            </p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {isAr ? 'نسخة تجريبية • جاهز للانطلاق 🚀' : 'Beta version • Ready to launch 🚀'}
          </div>
        </aside>

        {/* Sidebar - Mobile (Overlay) */}
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
                  {isAr ? 'إدارة المخزون' : 'Inventory'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr
                    ? 'كل الأصناف + قيم البيع/الشراء + ملخص التصنيفات'
                    : 'All items + sale/cost values + categories summary'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Store switcher (زي الداشبورد) */}
              <div className="hidden md:block">
                <label className="sr-only" htmlFor="store-switcher">
                  {isAr ? 'اختيار الفرع' : 'Select branch'}
                </label>
                <select
                  id="store-switcher"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                  value={selectedStoreId || ''}
                  onChange={(e) => selectStore(e.target.value)}
                  disabled={storesLoading || !stores.length}
                >
                  {storesLoading && <option>{isAr ? 'جارِ التحميل...' : 'Loading...'}</option>}
                  {!storesLoading && stores.length === 0 && (
                    <option>{isAr ? 'لا توجد فروع متاحة' : 'No branches available'}</option>
                  )}
                  {!storesLoading &&
                    stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                </select>
                {storesError && <p className="text-xs text-red-600 mt-1">{storesError}</p>}
              </div>

              {/* Branch filter */}
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setTimeout(fetchInventory, 0);
                }}
                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                title={isAr ? 'فلتر الفرع' : 'Branch filter'}
              >
                <option value="">{isAr ? 'كل الفروع' : 'All branches'}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              {/* Category filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                title={isAr ? 'فلتر التصنيف' : 'Category filter'}
              >
                <option value="">{isAr ? 'كل التصنيفات' : 'All categories'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.items_count ?? 0})
                  </option>
                ))}
              </select>

              {/* Add Branch */}
              {canManageInventory && (
                <button
                  type="button"
                  onClick={() => {
                    setAddBranchModalOpen(true);
                    setCreateBranchError(null);
                  }}
                  className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  <span>➕</span>
                  <span>{isAr ? 'إضافة فرع' : 'Add Branch'}</span>
                </button>
              )}

              {(branchesLoading || categoriesLoading) && (
                <span className="hidden lg:inline text-[11px] text-gray-500 dark:text-gray-400">
                  {branchesLoading ? (isAr ? 'تحميل الفروع...' : 'Loading branches...') : ''}
                  {branchesLoading && categoriesLoading ? ' • ' : ''}
                  {categoriesLoading ? (isAr ? 'تحميل التصنيفات...' : 'Loading categories...') : ''}
                </span>
              )}

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

              {/* User */}
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  {me?.name?.[0]?.toUpperCase() || me?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {me?.name || (me?.is_superuser ? (isAr ? 'سوبر أدمن' : 'Super Admin') : 'User')}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {me?.email || '—'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto w-full">
            {loading && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                {isAr ? 'جاري تحميل بيانات المخزون...' : 'Loading inventory...'}
              </div>
            )}

            {error && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                {error}
              </div>
            )}

            {/* Hint if no branches */}
            {!loading && selectedStoreId && branches.length === 0 && (
              <div className="w-full bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3 rounded-2xl dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {isAr ? 'لا توجد فروع داخل هذا المتجر بعد.' : 'No branches found for this store.'}
                    </p>
                    <p className="text-xs mt-1">
                      {isAr
                        ? 'المخزون عندك مربوط بـ (Item × Branch). لازم تعمل فرع واحد على الأقل عشان الأصناف تظهر في المخزون.'
                        : 'Inventory is generated per (Item × Branch). Create at least one branch to show items in inventory.'}
                    </p>
                  </div>
                  {canManageInventory && (
                    <button
                      type="button"
                      onClick={() => setAddBranchModalOpen(true)}
                      className="shrink-0 text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      {isAr ? 'إضافة فرع' : 'Add Branch'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* KPI cards */}
            {!loading && (
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800"
                  >
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{kpi.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{kpi.value}</p>
                  </div>
                ))}
              </section>
            )}

            {/* Filters */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row md:items-center gap-3 dark:bg-slate-900 dark:border-slate-800">
              <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث باسم الصنف...' : 'Search by item name...'}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                />
                <button
                  type="submit"
                  className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  {isAr ? 'بحث' : 'Search'}
                </button>
              </form>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  {isAr ? 'حالة المخزون:' : 'Stock status:'}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setTimeout(fetchInventory, 0);
                  }}
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                >
                  <option value="all">{isAr ? 'الكل' : 'All'}</option>
                  <option value="low">{isAr ? 'منخفض' : 'Low'}</option>
                  <option value="out">{isAr ? 'منتهي' : 'Out'}</option>
                </select>
              </div>
            </section>

            {/* Category summary */}
            {!loading && categorySummary.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? 'ملخص التصنيفات' : 'Categories summary'}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr
                        ? 'عدد الأصناف + إجمالي الكمية + القيم داخل كل Category (حسب الفلاتر الحالية)'
                        : 'Items count + total qty + values per category (based on current filters)'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                    onClick={() => setCategoryFilter('')}
                    title={isAr ? 'إلغاء فلتر التصنيف' : 'Clear category filter'}
                  >
                    {isAr ? 'إلغاء فلتر التصنيف' : 'Clear category filter'}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {categorySummary.slice(0, 8).map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setCategoryFilter(c.name)}
                      className="text-right bg-gray-50 hover:bg-gray-100 transition rounded-2xl border border-gray-100 p-4 dark:bg-slate-800/70 dark:border-slate-700 dark:hover:bg-slate-800"
                      title={isAr ? 'اضغط لفلترة الجدول بهذا التصنيف' : 'Click to filter by this category'}
                    >
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-50">{c.name}</p>
                      <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                        {isAr ? 'أصناف:' : 'Items:'} {c.itemsCount} • {isAr ? 'وحدات:' : 'Units:'} {c.totalQty}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-2 dark:text-gray-300">
                        {isAr ? 'قيمة البيع:' : 'Sale value:'}{' '}
                        <span className="font-semibold">
                          {numberFormatter.format(Math.round(c.saleValue || 0))} {isAr ? 'ج.م' : 'EGP'}
                        </span>
                      </p>
                      {canManageInventory && (
                        <p className="text-[11px] text-gray-600 mt-1 dark:text-gray-300">
                          {isAr ? 'تكلفة الشراء:' : 'Cost value:'}{' '}
                          <span className="font-semibold">
                            {numberFormatter.format(Math.round(c.costValue || 0))} {isAr ? 'ج.م' : 'EGP'}
                          </span>
                        </p>
                      )}
                    </button>
                  ))}
                </div>

                {categorySummary.length > 8 && (
                  <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
                    {isAr
                      ? '* يتم عرض أعلى 8 تصنيفات حسب قيمة البيع. (تقدر تضغط على أي تصنيف للفلترة)'
                      : '* Showing top 8 categories by sale value. (Click any card to filter)'}
                  </p>
                )}
              </section>
            )}

            {/* Inventory list */}
            {!loading && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? 'قائمة المخزون' : 'Inventory list'}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr
                        ? 'كل صنف مع كميته + قيم البيع/الشراء + حد إعادة الطلب في كل فرع'
                        : 'Each item with qty + sale/cost values + reorder level per branch'}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-gray-200">
                    {tableInventory.length} {isAr ? 'صفوف معروضة' : 'rows'}
                  </span>
                </div>

                {tableInventory.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isAr
                      ? 'لا توجد بيانات مخزون مطابقة للفلاتر الحالية.'
                      : 'No inventory data matches current filters.'}
                  </p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="space-y-2 md:hidden">
                      {tableInventory.map((row) => {
                        const qty = Number(row.quantity || 0);
                        const isOut = qty === 0;
                        const isLow = qty <= Number(row.min_stock || 0);

                        const salePrice = Number(row.item?.unit_price ?? 0);
                        const costPrice = Number(row.item?.cost_price ?? 0);

                        const saleTotal = salePrice * qty;
                        const costTotal = costPrice * qty;

                        let statusLabel = isAr ? 'مستقر' : 'Stable';
                        let statusClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';

                        if (isOut) {
                          statusLabel = isAr ? 'منتهي' : 'Out';
                          statusClass = 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200';
                        } else if (isLow) {
                          statusLabel = isAr ? 'منخفض' : 'Low';
                          statusClass = 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
                        }

                        const updatedAt = row.last_updated
                          ? new Date(row.last_updated).toLocaleString(isAr ? 'ar-EG' : 'en-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })
                          : '--';

                        return (
                          <div
                            key={row.id}
                            className="border border-gray-100 rounded-2xl p-4 bg-gray-50/60 dark:bg-slate-800/70 dark:border-slate-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-50">
                                  {row.item?.name || (isAr ? 'غير محدد' : 'Unknown')}
                                </p>
                                <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                                  {row.item?.category_name || (isAr ? 'بدون تصنيف' : 'Uncategorized')} •{' '}
                                  {row.branch_name || '-'}
                                </p>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-700 dark:text-gray-200">
                              <div className="bg-white rounded-xl border border-gray-100 p-2 dark:bg-slate-900 dark:border-slate-800">
                                <p className="text-gray-500 dark:text-gray-400">{isAr ? 'الكمية' : 'Qty'}</p>
                                <p className="font-semibold">{qty}</p>
                              </div>
                              <div className="bg-white rounded-xl border border-gray-100 p-2 dark:bg-slate-900 dark:border-slate-800">
                                <p className="text-gray-500 dark:text-gray-400">{isAr ? 'حد إعادة الطلب' : 'Reorder'}</p>
                                <p className="font-semibold">{row.min_stock}</p>
                              </div>
                              <div className="bg-white rounded-xl border border-gray-100 p-2 dark:bg-slate-900 dark:border-slate-800">
                                <p className="text-gray-500 dark:text-gray-400">{isAr ? 'قيمة البيع' : 'Sale value'}</p>
                                <p className="font-semibold">
                                  {numberFormatter.format(Math.round(saleTotal || 0))} {isAr ? 'ج.م' : 'EGP'}
                                </p>
                              </div>
                              {canManageInventory && (
                                <div className="bg-white rounded-xl border border-gray-100 p-2 dark:bg-slate-900 dark:border-slate-800">
                                  <p className="text-gray-500 dark:text-gray-400">{isAr ? 'تكلفة الشراء' : 'Cost value'}</p>
                                  <p className="font-semibold">
                                    {numberFormatter.format(Math.round(costTotal || 0))} {isAr ? 'ج.م' : 'EGP'}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isAr ? 'آخر تحديث:' : 'Updated:'} {updatedAt}
                              </p>

                              {canManageInventory && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                                    onClick={() => openAdjustModal(row)}
                                  >
                                    {isAr ? 'تعديل المخزون' : 'Adjust'}
                                  </button>

                                  <button
                                    type="button"
                                    className="text-[11px] px-3 py-1.5 rounded-full border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/30"
                                    onClick={() => handleDeleteItem(row)}
                                  >
                                    {isAr ? 'حذف الصنف' : 'Delete item'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'الصنف' : 'Item'}
                            </th>
                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'التصنيف' : 'Category'}
                            </th>
                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'الفرع' : 'Branch'}
                            </th>

                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'سعر البيع' : 'Sale price'}
                            </th>

                            {canManageInventory && (
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'تكلفة الشراء' : 'Cost price'}
                              </th>
                            )}

                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'الكمية' : 'Qty'}
                            </th>

                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'حد إعادة الطلب' : 'Reorder'}
                            </th>

                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'قيمة المخزون (بيع)' : 'Value (sale)'}
                            </th>

                            {canManageInventory && (
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'قيمة المخزون (شراء)' : 'Value (cost)'}
                              </th>
                            )}

                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'الحالة' : 'Status'}
                            </th>

                            <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                              {isAr ? 'آخر تحديث' : 'Updated'}
                            </th>

                            {canManageInventory && (
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? 'إجراءات' : 'Actions'}
                              </th>
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {tableInventory.map((row) => {
                            const qty = Number(row.quantity || 0);
                            const isOut = qty === 0;
                            const isLow = qty <= Number(row.min_stock || 0);

                        const salePrice = Number(row.item?.unit_price ?? 0);
                            const costPrice = Number(row.item?.cost_price ?? 0);

                            const saleTotal = salePrice * qty;
                            const costTotal = costPrice * qty;

                            let statusLabel = isAr ? 'مستقر' : 'Stable';
                            let statusClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';

                            if (isOut) {
                              statusLabel = isAr ? 'منتهي' : 'Out';
                              statusClass = 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200';
                            } else if (isLow) {
                              statusLabel = isAr ? 'منخفض' : 'Low';
                              statusClass = 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
                            }

                            const updatedAt = row.last_updated
                              ? new Date(row.last_updated).toLocaleString(isAr ? 'ar-EG' : 'en-EG', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                })
                              : '--';

                            return (
                              <tr
                                key={row.id}
                                className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                              >
                                <td className="py-2 px-2 whitespace-nowrap font-semibold text-gray-800 dark:text-gray-100">
                                  {row.item?.name || (isAr ? 'غير محدد' : 'Unknown')}
                                </td>

                                <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  {row.item?.category_name || (isAr ? 'بدون تصنيف' : 'Uncategorized')}
                                </td>

                                <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  {row.branch_name || '-'}
                                </td>

                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {salePrice.toLocaleString(isAr ? 'ar-EG' : 'en-EG', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  {isAr ? 'ج.م' : 'EGP'}
                                </td>

                                {canManageInventory && (
                                  <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                    {costPrice.toLocaleString(isAr ? 'ar-EG' : 'en-EG', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                    {isAr ? 'ج.م' : 'EGP'}
                                  </td>
                                )}

                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {qty}
                                </td>

                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {row.min_stock}
                                </td>

                                <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {numberFormatter.format(Math.round(saleTotal || 0))} {isAr ? 'ج.م' : 'EGP'}
                                </td>

                                {canManageInventory && (
                                  <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                    {numberFormatter.format(Math.round(costTotal || 0))} {isAr ? 'ج.م' : 'EGP'}
                                  </td>
                                )}

                                <td className="py-2 px-2 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </td>

                                <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  {updatedAt}
                                </td>

                                {canManageInventory && (
                                  <td className="py-2 px-2 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="text-[11px] px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                                        onClick={() => openAdjustModal(row)}
                                      >
                                        {isAr ? 'تعديل المخزون' : 'Adjust stock'}
                                      </button>

                                      <button
                                        type="button"
                                        className="text-[11px] px-3 py-1 rounded-full border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/30"
                                        onClick={() => handleDeleteItem(row)}
                                      >
                                        {isAr ? 'حذف الصنف' : 'Delete item'}
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
                  {isAr
                    ? '* لاحقًا: هنضيف شاشة كاملة لتاريخ الحركات وربطها بالجرد والشراء.'
                    : '* Coming soon: full movements history and integration with stocktaking/purchasing.'}
                </p>
              </section>
            )}

            {/* مودال إضافة فرع */}
            {addBranchModalOpen && canManageInventory && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 p-5 dark:bg-slate-900 dark:border dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 dark:text-gray-50">
                    {isAr ? 'إضافة فرع جديد' : 'Add new branch'}
                  </h3>
                  <p className="text-[11px] text-gray-500 mb-4 dark:text-gray-400">
                    {isAr
                      ? 'سيتم ربط الفرع بالمتجر الحالي، ولن يظهر هذا الزر لموظفي الكاشير.'
                      : 'The branch will be linked to the current store. This button is hidden from cashiers.'}
                  </p>

                  {createBranchError && (
                    <div className="mb-3 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                      {createBranchError}
                    </div>
                  )}

                  <form onSubmit={handleCreateBranch} className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                        {isAr ? 'اسم الفرع' : 'Branch name'}
                      </label>
                      <input
                        type="text"
                        value={newBranch.name}
                        onChange={(e) => setNewBranch((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                        placeholder={isAr ? 'مثال: فرع التجمع الخامس' : 'e.g. Fifth Settlement Branch'}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                        {isAr ? 'العنوان (اختياري)' : 'Address (optional)'}
                      </label>
                      <input
                        type="text"
                        value={newBranch.address}
                        onChange={(e) => setNewBranch((prev) => ({ ...prev, address: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                        placeholder={isAr ? 'العنوان التفصيلي للفرع' : 'Branch address'}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                        {isAr ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}
                      </label>
                      <input
                        type="text"
                        value={newBranch.phone}
                        onChange={(e) => setNewBranch((prev) => ({ ...prev, phone: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                        placeholder={isAr ? '01xxxxxxxxx' : '01xxxxxxxxx'}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAddBranchModalOpen(false);
                          setCreateBranchError(null);
                        }}
                        className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                        disabled={creatingBranch}
                      >
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>

                      <button
                        type="submit"
                        className="text-sm px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-60"
                        disabled={creatingBranch}
                      >
                        {creatingBranch ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ الفرع' : 'Save branch')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* مودال تعديل المخزون */}
            {adjustModalOpen && selectedEntry && canManageInventory && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-lg w-full max-w-md mx-4 p-5 dark:bg-slate-900 dark:border dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1 dark:text-gray-50">
                    {isAr ? 'تعديل مخزون الصنف' : 'Adjust item stock'}
                  </h3>
                  <p className="text-[11px] text-gray-500 mb-3 dark:text-gray-400">
                    {selectedEntry.item?.name} – {selectedEntry.branch_name}
                  </p>

                  <div className="mb-3 text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2 dark:bg-slate-800 dark:text-gray-300">
                    <p>
                      {isAr ? 'الكمية الحالية:' : 'Current qty:'} {selectedEntry.quantity}
                    </p>
                    <p>
                      {isAr ? 'حد إعادة الطلب:' : 'Reorder level:'} {selectedEntry.min_stock}
                    </p>
                  </div>

                  {adjustError && (
                    <div className="mb-3 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                      {adjustError}
                    </div>
                  )}

                  <form onSubmit={handleAdjustSubmit} className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                          {isAr ? 'نوع الحركة' : 'Movement type'}
                        </label>
                        <select
                          value={adjustForm.movement_type}
                          onChange={(e) =>
                            setAdjustForm((prev) => ({
                              ...prev,
                              movement_type: e.target.value,
                            }))
                          }
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                        >
                          <option value="IN">{isAr ? 'إضافة للمخزون' : 'Add stock'}</option>
                          <option value="OUT">{isAr ? 'خصم من المخزون' : 'Deduct stock'}</option>
                        </select>
                      </div>

                      <div className="w-32">
                        <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                          {isAr ? 'الكمية' : 'Qty'}
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
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                          placeholder={isAr ? 'مثال: 5' : 'e.g. 5'}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                        {isAr ? 'السبب (اختياري)' : 'Reason (optional)'}
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
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                        placeholder={isAr ? 'مثال: جرد، هالك، تصحيح...' : 'e.g. stocktake, waste, correction...'}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                        onClick={() => {
                          setAdjustModalOpen(false);
                          setSelectedEntry(null);
                          setAdjustError(null);
                        }}
                      >
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>

                      <button
                        type="submit"
                        disabled={savingAdjust}
                        className="text-xs px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {savingAdjust ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديل' : 'Save')}
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
