// src/pages/Reports.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { notifyError, notifySuccess } from "../lib/notifications";
import { useStore } from "../hooks/useStore";
import BrandMark from "../components/layout/BrandMark";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// =====================
// Helpers
// =====================
function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}
function formatMonthInput(date) {
  return date.toISOString().slice(0, 7);
}
function formatYearInput(date) {
  return date.getFullYear().toString();
}

// =====================
// Sidebar Navigation (same as Dashboard)
// =====================
function SidebarNav({ lang, currentPath = "/reports" }) {
  const isAr = lang === "ar";

  const baseLink =
    "flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800";
  const activeLink =
    "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200";

  const isActive = (path) => path === currentPath;

  return (
    <>
      <Link to="/dashboard" className={isActive("/dashboard") ? activeLink : baseLink}>
        <span>{isAr ? "الداشبورد" : "Dashboard"}</span>
        {isActive("/dashboard") && (
          <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
            {isAr ? "الآن" : "Now"}
          </span>
        )}
      </Link>

      <Link to="/pos" className={isActive("/pos") ? activeLink : baseLink}>
        {isAr ? "شاشة الكاشير (POS)" : "Cashier Screen (POS)"}
      </Link>

      <Link to="/inventory" className={isActive("/inventory") ? activeLink : baseLink}>
        {isAr ? "إدارة المخزون" : "Inventory Management"}
      </Link>

      <Link to="/attendance" className={isActive("/attendance") ? activeLink : baseLink}>
        {isAr ? "الحضور والانصراف" : "Attendance"}
      </Link>

      <Link to="/reservations" className={isActive("/reservations") ? activeLink : baseLink}>
        {isAr ? "الحجوزات" : "Reservations"}
      </Link>

      <Link to="/reports" className={isActive("/reports") ? activeLink : baseLink}>
        <span>{isAr ? "التقارير" : "Reports"}</span>
        {isActive("/reports") && (
          <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
            {isAr ? "الآن" : "Now"}
          </span>
        )}
      </Link>

      <Link to="/settings" className={isActive("/settings") ? activeLink : baseLink}>
        {isAr ? "الإعدادات" : "Settings"}
      </Link>

      <Link to="/employees" className={isActive("/employees") ? activeLink : baseLink}>
        {isAr ? "الموظفين" : "Employees"}
      </Link>

      <Link to="/accounting" className={isActive("/accounting") ? activeLink : baseLink}>
        {isAr ? "الحسابات" : "Accounting"}
      </Link>

      <Link to="/kds" className={isActive("/kds") ? activeLink : baseLink}>
        {isAr ? "المطبخ والبار" : "KDS"}
      </Link>

      <Link to="/users/create" className={isActive("/users/create") ? activeLink : baseLink}>
        {isAr ? "إدارة المستخدمين" : "User Management"}
      </Link>
    </>
  );
}

export default function Reports() {
  // =====================
  // Store selector (same pattern as Dashboard)
  // =====================
  const {
    stores,
    storesLoading,
    storesError,
    selectedStoreId,
    // eslint-disable-next-line no-unused-vars
    selectedStore,
    selectStore,
  } = useStore();

  // =====================
  // Theme & Language (same as Dashboard)
  // =====================
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "en");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAr = lang === "ar";

  const numberFormatter = new Intl.NumberFormat(isAr ? "ar-EG" : "en-EG");

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  const setLanguage = (lng) => setLang(lng);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? "rtl" : "ltr";
  }, [lang, isAr]);

  // =====================
  // Current user (same as Dashboard)
  // =====================
  const [me, setMe] = useState(null);

  const fetchMe = async () => {
    try {
      const res = await api.get("/auth/me/");
      setMe(res.data);
    } catch (err) {
      // keep silent; just log
      console.error("Error loading me:", err);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  // =====================
  // Reports State
  // =====================
  const today = useMemo(() => new Date(), []);
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const [filters, setFilters] = useState({
    from: formatDateInput(thirtyDaysAgo),
    to: formatDateInput(today),
    groupBy: "day",
  });

  const [periodFilters, setPeriodFilters] = useState({
    periodType: "day",
    periodValue: formatDateInput(today),
    limit: 5,
  });

  const [compareFilters, setCompareFilters] = useState({
    periodAPreset: "current_week",
    periodAStart: formatDateInput(thirtyDaysAgo),
    periodAEnd: formatDateInput(today),
    periodBPreset: "previous_week",
    periodBStart: formatDateInput(thirtyDaysAgo),
    periodBEnd: formatDateInput(today),
    limit: 5,
  });

  const [expenseFilters, setExpenseFilters] = useState({
    periodType: "month",
    periodValue: formatMonthInput(today),
  });

  const [inventoryFilters, setInventoryFilters] = useState({
    category: "",
    branch: "",
  });

  const [movementFilters, setMovementFilters] = useState({
    periodType: "month",
    periodValue: formatMonthInput(today),
    branch: "",
  });

  const [data, setData] = useState(null);
  const [periodStats, setPeriodStats] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [inventoryValue, setInventoryValue] = useState(null);
  const [inventoryMovements, setInventoryMovements] = useState(null);

  const [loading, setLoading] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [movementLoading, setMovementLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState(null);
  const [periodErrorMsg, setPeriodErrorMsg] = useState(null);
  const [compareErrorMsg, setCompareErrorMsg] = useState(null);
  const [expenseErrorMsg, setExpenseErrorMsg] = useState(null);
  const [inventoryErrorMsg, setInventoryErrorMsg] = useState(null);
  const [movementErrorMsg, setMovementErrorMsg] = useState(null);

  const [selectedMovementItemId, setSelectedMovementItemId] = useState(null);

  // =====================
  // API helpers
  // =====================
  const withStoreParams = useCallback(
    (params = {}) => {
      // لو عندك store_id مطلوب للباك اند خليها هنا
      // لو مش مطلوب مش هتضر غالبًا
      if (selectedStoreId) return { ...params, store_id: selectedStoreId };
      return params;
    },
    [selectedStoreId]
  );

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await api.get("/reports/sales/", {
        params: withStoreParams({
          from: filters.from,
          to: filters.to,
          group_by: filters.groupBy,
        }),
      });

      setData(res.data);
      notifySuccess(isAr ? "تم تحديث تقرير المبيعات بنجاح." : "Sales report updated successfully.");
    } catch (err) {
      console.error("Sales report error:", err);
      const msg = isAr
        ? "حدث خطأ أثناء تحميل تقرير المبيعات. حاول مرة أخرى."
        : "Error loading sales report. Please try again.";
      setErrorMsg(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.to, filters.groupBy, isAr, withStoreParams]);

  const fetchPeriodStats = useCallback(async () => {
    try {
      setPeriodLoading(true);
      setPeriodErrorMsg(null);

      const params = withStoreParams({
        period_type: periodFilters.periodType,
        limit: periodFilters.limit,
      });

      if (periodFilters.periodType === "day") {
        params.created_at__date = periodFilters.periodValue;
      } else {
        params.period_value = periodFilters.periodValue;
      }

      const res = await api.get("/reports/sales/period-stats/", { params });
      setPeriodStats(res.data);

      notifySuccess(isAr ? "تم تحديث إحصائيات الفترة بنجاح." : "Period stats updated successfully.");
    } catch (err) {
      console.error("Period stats error:", err);
      const msg = isAr
        ? "حدث خطأ أثناء تحميل إحصائيات الفترة. حاول مرة أخرى."
        : "Error loading period stats. Please try again.";
      setPeriodErrorMsg(msg);
      notifyError(msg);
    } finally {
      setPeriodLoading(false);
    }
  }, [periodFilters.periodType, periodFilters.periodValue, periodFilters.limit, isAr, withStoreParams]);

  const buildPeriodParams = (prefix, preset, start, end) => {
    if (preset === "custom") {
      return { [`${prefix}_start`]: start, [`${prefix}_end`]: end };
    }
    return { [`${prefix}_preset`]: preset };
  };

  const fetchComparison = useCallback(async () => {
    try {
      setCompareLoading(true);
      setCompareErrorMsg(null);

      const params = withStoreParams({
        limit: compareFilters.limit,
        ...buildPeriodParams("period_a", compareFilters.periodAPreset, compareFilters.periodAStart, compareFilters.periodAEnd),
        ...buildPeriodParams("period_b", compareFilters.periodBPreset, compareFilters.periodBStart, compareFilters.periodBEnd),
      });

      const res = await api.get("/reports/sales/compare/", { params });
      setComparison(res.data);

      notifySuccess(isAr ? "تم تحديث مقارنة الفترات بنجاح." : "Comparison updated successfully.");
    } catch (err) {
      console.error("Comparison error:", err);
      const msg = isAr
        ? "حدث خطأ أثناء تحميل مقارنة الفترات. حاول مرة أخرى."
        : "Error loading comparison. Please try again.";
      setCompareErrorMsg(msg);
      notifyError(msg);
    } finally {
      setCompareLoading(false);
    }
  }, [
    compareFilters.limit,
    compareFilters.periodAPreset,
    compareFilters.periodAStart,
    compareFilters.periodAEnd,
    compareFilters.periodBPreset,
    compareFilters.periodBStart,
    compareFilters.periodBEnd,
    isAr,
    withStoreParams,
  ]);

  const fetchExpenses = useCallback(async () => {
    try {
      setExpenseLoading(true);
      setExpenseErrorMsg(null);

      const res = await api.get("/reports/expenses/", {
        params: withStoreParams({
          period_type: expenseFilters.periodType,
          period_value: expenseFilters.periodValue,
        }),
      });

      setExpenses(res.data);
      notifySuccess(isAr ? "تم تحديث إجمالي المصروفات." : "Expenses updated successfully.");
    } catch (err) {
      console.error("Expenses error:", err);
      const msg = isAr ? "حدث خطأ أثناء تحميل المصروفات." : "Error loading expenses.";
      setExpenseErrorMsg(msg);
      notifyError(msg);
    } finally {
      setExpenseLoading(false);
    }
  }, [expenseFilters.periodType, expenseFilters.periodValue, isAr, withStoreParams]);

  const fetchInventoryValue = useCallback(async () => {
    try {
      setInventoryLoading(true);
      setInventoryErrorMsg(null);

      const params = withStoreParams({});
      if (inventoryFilters.category) params.category = inventoryFilters.category;
      if (inventoryFilters.branch) params.branch = inventoryFilters.branch;

      const res = await api.get("/reports/inventory/value/", { params });
      setInventoryValue(res.data);
      notifySuccess(isAr ? "تم تحديث قيمة المخزون." : "Inventory value updated.");
    } catch (err) {
      console.error("Inventory value error:", err);
      const msg = isAr ? "تعذر تحميل قيمة المخزون." : "Could not load inventory value.";
      setInventoryErrorMsg(msg);
      notifyError(msg);
    } finally {
      setInventoryLoading(false);
    }
  }, [inventoryFilters.category, inventoryFilters.branch, isAr, withStoreParams]);

  const fetchInventoryMovements = useCallback(async () => {
    try {
      setMovementLoading(true);
      setMovementErrorMsg(null);

      const params = withStoreParams({
        period_type: movementFilters.periodType,
        period_value: movementFilters.periodValue,
      });
      if (movementFilters.branch) params.branch = movementFilters.branch;

      const res = await api.get("/reports/inventory/movements/", { params });
      setInventoryMovements(res.data);

      const firstItemId = res.data?.items?.[0]?.item_id;
      if (firstItemId && !selectedMovementItemId) {
        setSelectedMovementItemId(firstItemId);
      }

      notifySuccess(isAr ? "تم تحديث حركات المخزون." : "Inventory movements updated.");
    } catch (err) {
      console.error("Inventory movements error:", err);
      const msg = isAr ? "تعذر تحميل حركات المخزون." : "Could not load inventory movements.";
      setMovementErrorMsg(msg);
      notifyError(msg);
    } finally {
      setMovementLoading(false);
    }
  }, [movementFilters.periodType, movementFilters.periodValue, movementFilters.branch, isAr, selectedMovementItemId, withStoreParams]);

  // =====================
  // Initial fetch (and when store changes)
  // =====================
  useEffect(() => {
    if (!selectedStoreId) {
      // لو مفيش فرع مختار
      setData(null);
      setPeriodStats(null);
      setComparison(null);
      setExpenses(null);
      setInventoryValue(null);
      setInventoryMovements(null);
      setErrorMsg(null);
      setPeriodErrorMsg(null);
      setCompareErrorMsg(null);
      setExpenseErrorMsg(null);
      setInventoryErrorMsg(null);
      setMovementErrorMsg(null);
      return;
    }

    fetchReport();
    fetchPeriodStats();
    fetchComparison();
    fetchExpenses();
    fetchInventoryValue();
    fetchInventoryMovements();
  }, [
    selectedStoreId,
    fetchReport,
    fetchPeriodStats,
    fetchComparison,
    fetchExpenses,
    fetchInventoryValue,
    fetchInventoryMovements,
  ]);

  // =====================
  // UI handlers
  // =====================
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchReport();
  };

  const handleExportCsv = () => {
    const series = data?.series || [];
    if (!series.length) {
      notifyError(isAr ? "لا توجد بيانات لتصديرها." : "No data to export.");
      return;
    }

    const header = ["date", "total_sales", "orders"];
    const rows = series.map((row) => [row.date, row.total_sales, row.orders]);
    const csvContent = [header, ...rows].map((r) => r.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sales_report_${filters.from}_${filters.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notifySuccess(isAr ? "تم تنزيل ملف CSV لتقرير المبيعات." : "CSV exported successfully.");
  };

  const handlePeriodTypeChange = (e) => {
    const newType = e.target.value;
    let nextValue = periodFilters.periodValue;

    if (newType === "day") nextValue = formatDateInput(today);
    else if (newType === "month") nextValue = formatMonthInput(today);
    else nextValue = formatYearInput(today);

    setPeriodFilters((prev) => ({ ...prev, periodType: newType, periodValue: nextValue }));
  };

  const handlePeriodFilterChange = (e) => {
    const { name, value } = e.target;
    setPeriodFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyPeriodFilters = (e) => {
    e.preventDefault();
    fetchPeriodStats();
  };

  const handleComparePresetChange = (name, value) => {
    setCompareFilters((prev) => {
      const prefix = name === "periodAPreset" ? "periodA" : "periodB";
      const next = { ...prev, [name]: value };

      if (value === "custom") {
        next[`${prefix}Start`] = prev[`${prefix}Start`] || formatDateInput(thirtyDaysAgo);
        next[`${prefix}End`] = prev[`${prefix}End`] || formatDateInput(today);
      }
      return next;
    });
  };

  const handleCompareInputChange = (e) => {
    const { name, value } = e.target;
    setCompareFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyComparison = (e) => {
    e.preventDefault();
    fetchComparison();
  };

  const handleExpenseTypeChange = (e) => {
    const newType = e.target.value;
    let nextValue = expenseFilters.periodValue;

    if (newType === "day") nextValue = formatDateInput(today);
    else if (newType === "month") nextValue = formatMonthInput(today);
    else nextValue = formatYearInput(today);

    setExpenseFilters((prev) => ({ ...prev, periodType: newType, periodValue: nextValue }));
  };

  const handleExpenseFilterChange = (e) => {
    const { name, value } = e.target;
    setExpenseFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyExpenses = (e) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleInventoryFilterChange = (e) => {
    const { name, value } = e.target;
    setInventoryFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyInventoryFilters = (e) => {
    e.preventDefault();
    fetchInventoryValue();
  };

  const handleMovementTypeChange = (e) => {
    const newType = e.target.value;
    let nextValue = movementFilters.periodValue;

    if (newType === "day") nextValue = formatDateInput(today);
    else if (newType === "month") nextValue = formatMonthInput(today);
    else nextValue = formatYearInput(today);

    setMovementFilters((prev) => ({ ...prev, periodType: newType, periodValue: nextValue }));
  };

  const handleMovementFilterChange = (e) => {
    const { name, value } = e.target;
    setMovementFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyMovementFilters = (e) => {
    e.preventDefault();
    fetchInventoryMovements();
  };

  // =====================
  // Derived data
  // =====================
  const summary = data?.summary || { total_sales: 0, total_orders: 0, avg_ticket: 0 };
  const series = data?.series || [];
  const topItems = data?.top_items || [];
  const paymentBreakdown = data?.payment_breakdown || [];

  const periodData =
    periodStats || {
      period_type: periodFilters.periodType,
      period_value: periodFilters.periodValue,
      total_sales: 0,
      top_products: [],
      bottom_products: [],
    };

  const comparisonData =
    comparison || {
      period_a: {
        label: "current_week",
        start: filters.from,
        end: filters.to,
        total_sales: 0,
        total_orders: 0,
        avg_order_value: 0,
        top_products: [],
        bottom_products: [],
      },
      period_b: {
        label: "previous_week",
        start: filters.from,
        end: filters.to,
        total_sales: 0,
        total_orders: 0,
        avg_order_value: 0,
        top_products: [],
        bottom_products: [],
      },
      deltas: {
        total_sales: { absolute: 0, percentage: null },
        total_orders: { absolute: 0, percentage: null },
        avg_order_value: { absolute: 0, percentage: null },
      },
    };

  const comparisonChartData = [
    { name: isAr ? "إجمالي المبيعات" : "Total Sales", period_a: comparisonData.period_a.total_sales || 0, period_b: comparisonData.period_b.total_sales || 0 },
    { name: isAr ? "عدد الطلبات" : "Orders", period_a: comparisonData.period_a.total_orders || 0, period_b: comparisonData.period_b.total_orders || 0 },
    { name: isAr ? "متوسط قيمة الطلب" : "Avg Order Value", period_a: comparisonData.period_a.avg_order_value || 0, period_b: comparisonData.period_b.avg_order_value || 0 },
  ];

  const deltaRows = [
    { key: "total_sales", label: isAr ? "إجمالي المبيعات" : "Total Sales" },
    { key: "total_orders", label: isAr ? "عدد الطلبات" : "Orders" },
    { key: "avg_order_value", label: isAr ? "متوسط قيمة الطلب" : "Avg Order Value" },
  ];

  const expenseData =
    expenses || { period_type: expenseFilters.periodType, period_value: expenseFilters.periodValue, payroll_total: 0, purchase_total: 0, total_expense: 0 };

  const inventoryTotals =
    inventoryValue || { total_cost_value: 0, total_sale_value: 0, total_margin: 0, items: [] };

  const movementSummary =
    inventoryMovements || { period_type: movementFilters.periodType, period_value: movementFilters.periodValue, items: [] };

  const movementItems = useMemo(() => movementSummary.items || [], [movementSummary.items]);

  useEffect(() => {
    if (!movementItems.length) return;
    const exists = movementItems.some((it) => it.item_id === selectedMovementItemId);
    if (!selectedMovementItemId || !exists) setSelectedMovementItemId(movementItems[0].item_id);
  }, [movementItems, selectedMovementItemId]);

  const selectedMovementItem =
    movementItems.find((it) => it.item_id === selectedMovementItemId) || movementItems[0];

  const movementChartData = (selectedMovementItem?.timeline || []).map((row) => ({
    label: row.label,
    incoming: row.incoming,
    outgoing: row.total_outgoing,
    sales: row.sales,
  }));

  const renderProductTable = (products) =>
    !products?.length ? (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {isAr ? "لا توجد بيانات كافية." : "Not enough data."}
      </p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                {isAr ? "المنتج" : "Product"}
              </th>
              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                {isAr ? "الكمية" : "Qty"}
              </th>
              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                {isAr ? "عدد البنود" : "Lines"}
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={`${p.product_id}-${p.name}`}
                className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <td className="py-2 px-2 font-semibold text-gray-800 dark:text-gray-100">{p.name}</td>
                <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{p.total_quantity}</td>
                <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{p.order_lines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const pieColors = ["#0ea5e9", "#22c55e", "#eab308", "#f97316", "#ef4444"];

  // =====================
  // Layout
  // =====================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">     
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <BrandMark
              subtitle={isAr ? "لوحة تحكم الكافيه / المطعم" : "Restaurant / Café Dashboard"}
            />
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} currentPath="/reports" />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {isAr ? "نسخة تجريبية • جاهز للانطلاق 🚀" : "Beta version • Ready to launch 🚀"}
          </div>
        </aside>

        {/* Sidebar - Mobile overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden" aria-modal="true">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative ml-auto h-full w-64 bg-white shadow-xl border-l border-gray-200 flex flex-col dark:bg-slate-900 dark:border-slate-800">
              <div className="px-4 py-4 border-b flex items-center justify-between dark:border-slate-800">
                <BrandMark variant="mobile" subtitle={isAr ? "القائمة الرئيسية" : "Main Menu"} />                
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="inline-flex items-center justify-center rounded-full p-1.5 border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  <span className="sr-only">{isAr ? "إغلاق القائمة" : "Close menu"}</span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <SidebarNav lang={lang} currentPath="/reports" />
              </nav>

              <div className="px-4 py-3 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
                {isAr ? "نسخة تجريبية • جاهز للانطلاق 🚀" : "Beta version • Ready to launch 🚀"}
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
                <span className="sr-only">{isAr ? "فتح القائمة" : "Open menu"}</span>
                <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {isAr ? "التقارير" : "Reports"}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr ? "تحليلات المبيعات والمخزون والمصروفات" : "Sales, inventory and expenses analytics"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {me?.is_superuser && (
                <Link
                  to="/admin/stores/create"
                  className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  <span>➕</span>
                  <span>{isAr ? "إضافة ستور" : "Add Store"}</span>
                </Link>
              )}

              <div className="hidden md:block">
                <label className="sr-only" htmlFor="store-switcher">
                  {isAr ? "اختيار الفرع" : "Select branch"}
                </label>
                <select
                  id="store-switcher"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                  value={selectedStoreId || ""}
                  onChange={(e) => selectStore(e.target.value)}
                  disabled={storesLoading || !stores.length}
                >
                  {storesLoading && <option>{isAr ? "جارِ التحميل..." : "Loading..."}</option>}
                  {!storesLoading && stores.length === 0 && (
                    <option>{isAr ? "لا توجد فروع متاحة" : "No branches available"}</option>
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

              {/* Language switcher */}
              <div className="flex items-center text-[11px] border border-gray-200 rounded-full overflow-hidden dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-2 py-1 ${
                    !isAr ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900" : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("ar")}
                  className={`px-2 py-1 ${
                    isAr ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900" : "text-gray-600 dark:text-gray-300"
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
                {theme === "dark" ? (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span>☀️</span>
                    <span className="hidden sm:inline">{isAr ? "وضع فاتح" : "Light"}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span>🌙</span>
                    <span className="hidden sm:inline">{isAr ? "وضع داكن" : "Dark"}</span>
                  </span>
                )}
              </button>

              {/* User */}
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  {me?.name?.[0]?.toUpperCase() || me?.email?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {me?.name || (me?.is_superuser ? "Super Admin" : "User")}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{me?.email || "—"}</p>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* If no store */}
            {!selectedStoreId && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                {isAr ? "من فضلك اختر فرع أولاً لعرض التقارير." : "Please select a branch first to view reports."}
              </div>
            )}

            {/* Sales report filters */}
            {!!selectedStoreId && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? "تقرير المبيعات" : "Sales Report"}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr ? "فلترة حسب التاريخ والتجميع" : "Filter by date range and grouping"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                    >
                      {isAr ? "تصدير CSV" : "Export CSV"}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleApplyFilters} className="grid gap-3 md:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "من تاريخ" : "From"}
                    </label>
                    <input
                      type="date"
                      name="from"
                      value={filters.from}
                      onChange={handleFilterChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "إلى تاريخ" : "To"}
                    </label>
                    <input
                      type="date"
                      name="to"
                      value={filters.to}
                      onChange={handleFilterChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "التجميع حسب" : "Group by"}
                    </label>
                    <select
                      name="groupBy"
                      value={filters.groupBy}
                      onChange={handleFilterChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    >
                      <option value="day">{isAr ? "اليوم" : "Day"}</option>
                      <option value="month">{isAr ? "الشهر" : "Month"}</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full md:w-auto text-sm font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
                      disabled={loading}
                    >
                      {loading ? (isAr ? "جارِ التحديث..." : "Updating...") : isAr ? "تطبيق الفلتر" : "Apply"}
                    </button>
                  </div>
                </form>

                {errorMsg && (
                  <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                    {errorMsg}
                  </div>
                )}

                {/* KPI cards */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? "إجمالي المبيعات" : "Total Sales"}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(Number(summary.total_sales || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? "عدد الطلبات" : "Orders"}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(Number(summary.total_orders || 0))}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? "متوسط قيمة الفاتورة" : "Avg Ticket"}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(Number(summary.avg_ticket || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid gap-4 lg:grid-cols-2 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? "المبيعات على مدار الوقت" : "Sales over time"}
                      </h4>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        {isAr ? "بيانات حقيقية" : "Live data"}
                      </span>
                    </div>

                    {!series.length ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isAr ? "لا توجد بيانات كافية لعرض الرسم البياني." : "Not enough data to display chart."}
                      </p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
                          <LineChart data={series}>                         
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="total_sales" name={isAr ? "إجمالي المبيعات" : "Total Sales"} />
                            <Line type="monotone" dataKey="orders" name={isAr ? "عدد الطلبات" : "Orders"} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {isAr ? "أعلى الأصناف مبيعًا" : "Top selling items"}
                      </h4>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {isAr ? "أفضل" : "Top"}
                      </span>
                    </div>

                    {!topItems.length ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isAr ? "لا توجد بيانات كافية." : "Not enough data."}
                      </p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
                          <BarChart data={topItems}>                            
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="qty_sold" name={isAr ? "الكمية المباعة" : "Qty sold"} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment + table */}
                <div className="grid gap-4 lg:grid-cols-2 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "توزيع المدفوعات" : "Payment breakdown"}
                    </h4>

                    {!paymentBreakdown.length ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isAr ? "لا توجد بيانات مدفوعات كافية." : "Not enough payment data."}
                      </p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
                          <PieChart>                          
                            <Pie data={paymentBreakdown} dataKey="amount" nameKey="gateway" outerRadius={80} label>
                              {paymentBreakdown.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "تفاصيل حسب الفترة" : "Details by period"}
                    </h4>

                    {!series.length ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isAr ? "لا توجد بيانات لعرضها." : "No data to display."}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? "التاريخ" : "Date"}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? "إجمالي المبيعات" : "Total Sales"}
                              </th>
                              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                {isAr ? "عدد الطلبات" : "Orders"}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {series.map((row) => (
                              <tr
                                key={row.date}
                                className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                              >
                                <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{row.date}</td>
                                <td className="py-2 px-2 text-gray-900 dark:text-gray-50">
                                  {numberFormatter.format(Number(row.total_sales || 0))} {isAr ? "ج.م" : "EGP"}
                                </td>
                                <td className="py-2 px-2 text-gray-700 dark:text-gray-200">
                                  {numberFormatter.format(Number(row.orders || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Inventory value */}
            {!!selectedStoreId && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? "قيمة المخزون" : "Inventory value"}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr ? "فلترة اختيارية حسب التصنيف/الفرع" : "Optional filters by category/branch"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleApplyInventoryFilters} className="grid gap-3 md:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "التصنيف (اختياري)" : "Category (optional)"}
                    </label>
                    <input
                      type="number"
                      name="category"
                      value={inventoryFilters.category}
                      onChange={handleInventoryFilterChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      placeholder={isAr ? "ID التصنيف" : "Category ID"}
                      min="1"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "الفرع (اختياري)" : "Branch (optional)"}
                    </label>
                    <input
                      type="number"
                      name="branch"
                      value={inventoryFilters.branch}
                      onChange={handleInventoryFilterChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      placeholder={isAr ? "ID الفرع" : "Branch ID"}
                      min="1"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="text-sm font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
                      disabled={inventoryLoading}
                    >
                      {inventoryLoading ? (isAr ? "جارِ التحديث..." : "Updating...") : isAr ? "تحديث قيمة المخزون" : "Update"}
                    </button>
                  </div>
                </form>

                {inventoryErrorMsg && (
                  <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                    {inventoryErrorMsg}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? "تكلفة الشراء" : "Cost value"}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(Number(inventoryTotals.total_cost_value || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? "قيمة البيع المحتملة" : "Sale value"}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(Number(inventoryTotals.total_sale_value || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? "هامش الربح المحتمل" : "Margin"}
                    </p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {numberFormatter.format(Number(inventoryTotals.total_margin || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>
                </div>

                {!!inventoryTotals.items?.length && (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">
                            {isAr ? "الصنف" : "Item"}
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">
                            {isAr ? "التصنيف" : "Category"}
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">
                            {isAr ? "الكمية" : "Qty"}
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">
                            {isAr ? "قيمة الشراء" : "Cost"}
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">
                            {isAr ? "قيمة البيع" : "Sale"}
                          </th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">
                            {isAr ? "الهامش" : "Margin"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryTotals.items.map((it) => (
                          <tr
                            key={it.item_id}
                            className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                          >
                            <td className="py-2 px-2 font-semibold text-gray-800 dark:text-gray-100">{it.name}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{it.category_name || (isAr ? "بدون تصنيف" : "Uncategorized")}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{it.quantity}</td>
                            <td className="py-2 px-2 text-gray-900 dark:text-gray-50">
                              {numberFormatter.format(Number(it.cost_value || 0))} {isAr ? "ج.م" : "EGP"}
                            </td>
                            <td className="py-2 px-2 text-gray-900 dark:text-gray-50">
                              {numberFormatter.format(Number(it.sale_value || 0))} {isAr ? "ج.م" : "EGP"}
                            </td>
                            <td className="py-2 px-2 text-gray-900 dark:text-gray-50">
                              {numberFormatter.format(Number(it.margin || 0))} {isAr ? "ج.م" : "EGP"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Inventory movements */}
            {!!selectedStoreId && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? "حركات المخزون ومعدل الاستهلاك" : "Inventory movements & consumption"}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr ? "معدل الاستهلاك = الكمية المباعة ÷ عدد أيام الفترة" : "Consumption rate = sold qty ÷ days in period"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleApplyMovementFilters} className="grid gap-3 md:grid-cols-5">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "نوع الفترة" : "Period type"}
                    </label>
                    <select
                      name="periodType"
                      value={movementFilters.periodType}
                      onChange={handleMovementTypeChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    >
                      <option value="day">{isAr ? "اليوم" : "Day"}</option>
                      <option value="month">{isAr ? "الشهر" : "Month"}</option>
                      <option value="year">{isAr ? "السنة" : "Year"}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "قيمة الفترة" : "Period value"}
                    </label>
                    {movementFilters.periodType === "day" && (
                      <input
                        type="date"
                        name="periodValue"
                        value={movementFilters.periodValue}
                        onChange={handleMovementFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                    {movementFilters.periodType === "month" && (
                      <input
                        type="month"
                        name="periodValue"
                        value={movementFilters.periodValue}
                        onChange={handleMovementFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                    {movementFilters.periodType === "year" && (
                      <input
                        type="number"
                        name="periodValue"
                        min="2000"
                        value={movementFilters.periodValue}
                        onChange={handleMovementFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "الفرع (اختياري)" : "Branch (optional)"}
                    </label>
                    <input
                      type="number"
                      name="branch"
                      value={movementFilters.branch}
                      onChange={handleMovementFilterChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      min="1"
                      placeholder={isAr ? "ID الفرع" : "Branch ID"}
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="text-sm font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
                      disabled={movementLoading}
                    >
                      {movementLoading ? (isAr ? "جارِ التحديث..." : "Updating...") : isAr ? "تحديث الحركات" : "Update"}
                    </button>
                  </div>
                </form>

                {movementErrorMsg && (
                  <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                    {movementErrorMsg}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "الفترة" : "Period"}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {(movementSummary.period_type === "day"
                        ? isAr ? "اليوم" : "Day"
                        : movementSummary.period_type === "month"
                          ? isAr ? "الشهر" : "Month"
                          : isAr ? "السنة" : "Year")}{" "}
                      - {movementSummary.period_value}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "عدد الأصناف" : "Items count"}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{movementItems.length}</p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "معلومة" : "Note"}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-200">
                      {isAr ? "معدل الاستهلاك/يوم يساعدك تتوقع امتى الصنف هيخلص." : "Consumption rate/day helps predict when an item will run out."}
                    </p>
                  </div>
                </div>

                {/* Movements table */}
                <div className="mt-5 overflow-x-auto">
                  {!movementItems.length ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr ? "لا توجد حركات مخزون في الفترة المحددة." : "No movements for the selected period."}
                    </p>
                  ) : (
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "الصنف" : "Item"}</th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "التصنيف" : "Category"}</th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "وارد" : "Incoming"}</th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "صادر (حركات)" : "Outgoing"}</th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "مبيعات" : "Sales"}</th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "صافي التغير" : "Net change"}</th>
                          <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "استهلاك/يوم" : "Consumption/day"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movementItems.map((it) => (
                          <tr
                            key={it.item_id}
                            className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                          >
                            <td className="py-2 px-2 font-semibold text-gray-800 dark:text-gray-100">{it.name}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{it.category_name || (isAr ? "بدون تصنيف" : "Uncategorized")}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{it.incoming}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{it.outgoing}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{it.sales_quantity}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{it.net_change}</td>
                            <td className="py-2 px-2 text-gray-900 dark:text-gray-50">{it.consumption_rate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Movements chart */}
                <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? "الرسم البياني للحركة" : "Movements chart"}
                    </h4>

                    {!!movementItems.length && (
                      <select
                        value={selectedMovementItem?.item_id || ""}
                        onChange={(e) => setSelectedMovementItemId(Number(e.target.value))}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      >
                        {movementItems.map((it) => (
                          <option key={it.item_id} value={it.item_id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {!movementItems.length ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr ? "لا توجد بيانات لعرض الرسم البياني." : "No data to display chart."}
                    </p>
                  ) : !movementChartData.length ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr ? "الصنف المختار بلا حركة في الفترة الحالية." : "Selected item has no movements in this period."}
                    </p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
                        <LineChart data={movementChartData}>                          
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="incoming" name={isAr ? "وارد" : "Incoming"} stroke="#0ea5e9" />
                          <Line type="monotone" dataKey="outgoing" name={isAr ? "إجمالي صادر" : "Outgoing"} stroke="#ef4444" />
                          <Line type="monotone" dataKey="sales" name={isAr ? "مبيعات" : "Sales"} stroke="#22c55e" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Expenses */}
            {!!selectedStoreId && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? "إجمالي المصروفات" : "Total expenses"}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr ? "رواتب + مشتريات" : "Payroll + Purchases"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleApplyExpenses} className="grid gap-3 md:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "نوع الفترة" : "Period type"}
                    </label>
                    <select
                      name="periodType"
                      value={expenseFilters.periodType}
                      onChange={handleExpenseTypeChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    >
                      <option value="day">{isAr ? "اليوم" : "Day"}</option>
                      <option value="month">{isAr ? "الشهر" : "Month"}</option>
                      <option value="year">{isAr ? "السنة" : "Year"}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {isAr ? "قيمة الفترة" : "Period value"}
                    </label>
                    {expenseFilters.periodType === "day" && (
                      <input
                        type="date"
                        name="periodValue"
                        value={expenseFilters.periodValue}
                        onChange={handleExpenseFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                    {expenseFilters.periodType === "month" && (
                      <input
                        type="month"
                        name="periodValue"
                        value={expenseFilters.periodValue}
                        onChange={handleExpenseFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                    {expenseFilters.periodType === "year" && (
                      <input
                        type="number"
                        name="periodValue"
                        min="2000"
                        value={expenseFilters.periodValue}
                        onChange={handleExpenseFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="text-sm font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
                      disabled={expenseLoading}
                    >
                      {expenseLoading ? (isAr ? "جارِ التحديث..." : "Updating...") : isAr ? "تحديث المصروفات" : "Update"}
                    </button>
                  </div>
                </form>

                {expenseErrorMsg && (
                  <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                    {expenseErrorMsg}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "إجمالي الرواتب" : "Payroll total"}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(Number(expenseData.payroll_total || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "إجمالي المشتريات" : "Purchases total"}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(Number(expenseData.purchase_total || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "إجمالي المصروفات" : "Total expense"}</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {numberFormatter.format(Number(expenseData.total_expense || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Period stats */}
            {!!selectedStoreId && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? "إحصائيات الفترة" : "Period stats"}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr ? "أعلى / أقل المنتجات مبيعًا حسب فترة" : "Top / bottom products by selected period"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleApplyPeriodFilters} className="grid gap-3 md:grid-cols-5">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{isAr ? "نوع الفترة" : "Period type"}</label>
                    <select
                      name="periodType"
                      value={periodFilters.periodType}
                      onChange={handlePeriodTypeChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    >
                      <option value="day">{isAr ? "اليوم" : "Day"}</option>
                      <option value="month">{isAr ? "الشهر" : "Month"}</option>
                      <option value="year">{isAr ? "السنة" : "Year"}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{isAr ? "قيمة الفترة" : "Period value"}</label>
                    {periodFilters.periodType === "day" && (
                      <input
                        type="date"
                        name="periodValue"
                        value={periodFilters.periodValue}
                        onChange={handlePeriodFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                    {periodFilters.periodType === "month" && (
                      <input
                        type="month"
                        name="periodValue"
                        value={periodFilters.periodValue}
                        onChange={handlePeriodFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                    {periodFilters.periodType === "year" && (
                      <input
                        type="number"
                        name="periodValue"
                        min="2000"
                        value={periodFilters.periodValue}
                        onChange={handlePeriodFilterChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{isAr ? "الحد" : "Limit"}</label>
                    <input
                      type="number"
                      name="limit"
                      min="1"
                      value={periodFilters.limit}
                      onChange={handlePeriodFilterChange}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="text-sm font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
                      disabled={periodLoading}
                    >
                      {periodLoading ? (isAr ? "جارِ التحديث..." : "Updating...") : isAr ? "تحديث الإحصائيات" : "Update"}
                    </button>
                  </div>
                </form>

                {periodErrorMsg && (
                  <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                    {periodErrorMsg}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "الفترة" : "Period"}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {(periodData.period_type === "day"
                        ? isAr ? "اليوم" : "Day"
                        : periodData.period_type === "month"
                          ? isAr ? "الشهر" : "Month"
                          : isAr ? "السنة" : "Year")}{" "}
                      - {periodData.period_value}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "إجمالي المبيعات" : "Total sales"}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(Number(periodData.total_sales || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? "الحد" : "Limit"}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{periodFilters.limit}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "أعلى المنتجات مبيعًا" : "Top products"}
                    </h4>

                    {!periodData.top_products?.length ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isAr ? "لا توجد بيانات كافية." : "Not enough data."}
                      </p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
                          <BarChart data={periodData.top_products}>                            
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="total_quantity" name={isAr ? "الكمية المباعة" : "Qty sold"} fill="#0ea5e9" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "أقل المنتجات مبيعًا" : "Bottom products"}
                    </h4>
                    {renderProductTable(periodData.bottom_products || [])}
                  </div>
                </div>
              </section>
            )}

            {/* Comparison */}
            {!!selectedStoreId && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {isAr ? "مقارنة فترتين" : "Compare two periods"}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                      {isAr ? "مقارنة المبيعات والطلبات والمتوسط" : "Compare sales, orders and averages"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleApplyComparison} className="grid gap-3 lg:grid-cols-3">
                  {/* Period A */}
                  <div className="flex flex-col gap-2 border border-gray-200 rounded-2xl p-3 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{isAr ? "الفترة A" : "Period A"}</p>
                    <select
                      name="periodAPreset"
                      value={compareFilters.periodAPreset}
                      onChange={(e) => handleComparePresetChange("periodAPreset", e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                    >
                      <option value="today">{isAr ? "اليوم" : "Today"}</option>
                      <option value="yesterday">{isAr ? "أمس" : "Yesterday"}</option>
                      <option value="current_week">{isAr ? "الأسبوع الحالي" : "Current week"}</option>
                      <option value="previous_week">{isAr ? "الأسبوع السابق" : "Previous week"}</option>
                      <option value="current_month">{isAr ? "الشهر الحالي" : "Current month"}</option>
                      <option value="previous_month">{isAr ? "الشهر السابق" : "Previous month"}</option>
                      <option value="custom">{isAr ? "مخصص" : "Custom"}</option>
                    </select>

                    {compareFilters.periodAPreset === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-gray-600 dark:text-gray-300">{isAr ? "من" : "From"}</label>
                          <input
                            type="date"
                            name="periodAStart"
                            value={compareFilters.periodAStart}
                            onChange={handleCompareInputChange}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-gray-600 dark:text-gray-300">{isAr ? "إلى" : "To"}</label>
                          <input
                            type="date"
                            name="periodAEnd"
                            value={compareFilters.periodAEnd}
                            onChange={handleCompareInputChange}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Period B */}
                  <div className="flex flex-col gap-2 border border-gray-200 rounded-2xl p-3 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{isAr ? "الفترة B" : "Period B"}</p>
                    <select
                      name="periodBPreset"
                      value={compareFilters.periodBPreset}
                      onChange={(e) => handleComparePresetChange("periodBPreset", e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                    >
                      <option value="today">{isAr ? "اليوم" : "Today"}</option>
                      <option value="yesterday">{isAr ? "أمس" : "Yesterday"}</option>
                      <option value="current_week">{isAr ? "الأسبوع الحالي" : "Current week"}</option>
                      <option value="previous_week">{isAr ? "الأسبوع السابق" : "Previous week"}</option>
                      <option value="current_month">{isAr ? "الشهر الحالي" : "Current month"}</option>
                      <option value="previous_month">{isAr ? "الشهر السابق" : "Previous month"}</option>
                      <option value="custom">{isAr ? "مخصص" : "Custom"}</option>
                    </select>

                    {compareFilters.periodBPreset === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-gray-600 dark:text-gray-300">{isAr ? "من" : "From"}</label>
                          <input
                            type="date"
                            name="periodBStart"
                            value={compareFilters.periodBStart}
                            onChange={handleCompareInputChange}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-gray-600 dark:text-gray-300">{isAr ? "إلى" : "To"}</label>
                          <input
                            type="date"
                            name="periodBEnd"
                            value={compareFilters.periodBEnd}
                            onChange={handleCompareInputChange}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Limit + submit */}
                  <div className="flex flex-col justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{isAr ? "حد المنتجات" : "Products limit"}</label>
                      <input
                        type="number"
                        name="limit"
                        min="1"
                        value={compareFilters.limit}
                        onChange={handleCompareInputChange}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                      />
                    </div>
                    <button
                      type="submit"
                      className="text-sm font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition self-start disabled:opacity-60"
                      disabled={compareLoading}
                    >
                      {compareLoading ? (isAr ? "جارِ التحديث..." : "Updating...") : isAr ? "تحديث المقارنة" : "Update"}
                    </button>
                  </div>
                </form>

                {compareErrorMsg && (
                  <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                    {compareErrorMsg}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "الفترة A" : "Period A"}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {comparisonData.period_a.label} ({comparisonData.period_a.start} → {comparisonData.period_a.end})
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-2">
                      {numberFormatter.format(Number(comparisonData.period_a.total_sales || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isAr ? "الطلبات" : "Orders"}: {numberFormatter.format(Number(comparisonData.period_a.total_orders || 0))} •{" "}
                      {isAr ? "متوسط الطلب" : "Avg"}: {numberFormatter.format(Number(comparisonData.period_a.avg_order_value || 0))}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "الفترة B" : "Period B"}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {comparisonData.period_b.label} ({comparisonData.period_b.start} → {comparisonData.period_b.end})
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-2">
                      {numberFormatter.format(Number(comparisonData.period_b.total_sales || 0))} {isAr ? "ج.م" : "EGP"}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isAr ? "الطلبات" : "Orders"}: {numberFormatter.format(Number(comparisonData.period_b.total_orders || 0))} •{" "}
                      {isAr ? "متوسط الطلب" : "Avg"}: {numberFormatter.format(Number(comparisonData.period_b.avg_order_value || 0))}
                    </p>
                  </div>
                </div>

                {/* delta cards */}
                <div className="grid gap-4 md:grid-cols-3 mt-4">
                  {deltaRows.map((row) => {
                    const delta = comparisonData.deltas[row.key] || {};
                    const pct = delta.percentage;
                    const isPositive = pct > 0;
                    const isNegative = pct < 0;

                    return (
                      <div key={row.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{row.label}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-1">
                          {numberFormatter.format(Number(delta.absolute || 0))}{" "}
                          {row.key === "total_orders" ? (isAr ? "طلب" : "orders") : isAr ? "ج.م" : "EGP"}
                        </p>
                        <p className={`text-[11px] mt-1 ${isPositive ? "text-emerald-600" : isNegative ? "text-red-600" : "text-gray-500"} dark:text-inherit`}>
                          {pct === null || pct === undefined
                            ? isAr
                              ? "لا يمكن حساب النسبة"
                              : "Cannot calculate percentage"
                            : `${numberFormatter.format(Number(pct))}%`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* comparison chart + deltas table */}
                <div className="grid gap-4 lg:grid-cols-2 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "مقارنة المؤشرات الرئيسية" : "KPI comparison"}
                    </h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
                        <BarChart data={comparisonChartData}>                          
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="period_a" name={isAr ? "الفترة A" : "Period A"} fill="#0ea5e9" />
                          <Bar dataKey="period_b" name={isAr ? "الفترة B" : "Period B"} fill="#22c55e" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "قائمة الفروقات" : "Differences list"}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                            <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "المؤشر" : "Metric"}</th>
                            <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "A" : "A"}</th>
                            <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "B" : "B"}</th>
                            <th className="py-2 px-2 font-semibold text-gray-600 dark:text-gray-200">{isAr ? "الفارق" : "Delta"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deltaRows.map((row) => {
                            const delta = comparisonData.deltas[row.key] || {};
                            const aValue = comparisonData.period_a[row.key];
                            const bValue = comparisonData.period_b[row.key];
                            return (
                              <tr
                                key={`delta-row-${row.key}`}
                                className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                              >
                                <td className="py-2 px-2 font-semibold text-gray-800 dark:text-gray-100">{row.label}</td>
                                <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{numberFormatter.format(Number(aValue || 0))}</td>
                                <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{numberFormatter.format(Number(bValue || 0))}</td>
                                <td className="py-2 px-2 text-gray-900 dark:text-gray-50">
                                  {numberFormatter.format(Number(delta.absolute || 0))}
                                  {delta.percentage !== null && delta.percentage !== undefined
                                    ? ` (${numberFormatter.format(Number(delta.percentage))}%)`
                                    : ""}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* top/bottom tables */}
                <div className="grid gap-4 lg:grid-cols-2 mt-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "أعلى المنتجات - الفترة A" : "Top products - Period A"}
                    </h4>
                    {renderProductTable(comparisonData.period_a.top_products || [])}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "أعلى المنتجات - الفترة B" : "Top products - Period B"}
                    </h4>
                    {renderProductTable(comparisonData.period_b.top_products || [])}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2 mt-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "أقل المنتجات - الفترة A" : "Bottom products - Period A"}
                    </h4>
                    {renderProductTable(comparisonData.period_a.bottom_products || [])}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                      {isAr ? "أقل المنتجات - الفترة B" : "Bottom products - Period B"}
                    </h4>
                    {renderProductTable(comparisonData.period_b.bottom_products || [])}
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
