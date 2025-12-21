// src/pages/Reports.jsx
import React, { useEffect, useState } from "react";
import api from "../lib/api";

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

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthInput(date) {
  return date.toISOString().slice(0, 7);
}

function formatYearInput(date) {
  return date.getFullYear().toString();
}

export default function Reports() {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

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

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [periodStats, setPeriodStats] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState(null);

  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);

  const [expenseFilters, setExpenseFilters] = useState({
    periodType: "month",
    periodValue: formatMonthInput(today),
  });
  const [expenses, setExpenses] = useState(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState(null);

  // Toast
  const [toast, setToast] = useState({
    open: false,
    message: "",
    type: "success", // success | error
  });

  const showToast = (message, type = "success") => {
    setToast({ open: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 3000);
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/reports/sales/", {
        params: {
          from: filters.from,
          to: filters.to,
          group_by: filters.groupBy,
        },
      });

      setData(res.data);
      showToast("تم تحديث تقرير المبيعات بنجاح.", "success");
    } catch (err) {
      console.error("خطأ في تحميل تقرير المبيعات:", err);
      const msg = "حدث خطأ أثناء تحميل التقرير. حاول مرة أخرى.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriodStats = async () => {
    try {
      setPeriodLoading(true);
      setPeriodError(null);

      const params = {
        period_type: periodFilters.periodType,
        limit: periodFilters.limit,
      };

      if (periodFilters.periodType === "day") {
        params.created_at__date = periodFilters.periodValue;
      } else {
        params.period_value = periodFilters.periodValue;
      }

      const res = await api.get("/reports/sales/period-stats/", {
        params,
      });

      setPeriodStats(res.data);
      showToast("تم تحديث إحصائيات الفترة بنجاح.", "success");
    } catch (err) {
      console.error("خطأ في تحميل إحصائيات الفترة:", err);
      const msg = "حدث خطأ أثناء تحميل إحصائيات الفترة. حاول مرة أخرى.";
      setPeriodError(msg);
      showToast(msg, "error");
    } finally {
      setPeriodLoading(false);
    }
  };

  const buildPeriodParams = (prefix, preset, start, end) => {
    if (preset === "custom") {
      return {
        [`${prefix}_start`]: start,
        [`${prefix}_end`]: end,
      };
    }
    return { [`${prefix}_preset`]: preset };
  };

  const fetchComparison = async () => {
    try {
      setCompareLoading(true);
      setCompareError(null);

      const params = {
        limit: compareFilters.limit,
        ...buildPeriodParams(
          "period_a",
          compareFilters.periodAPreset,
          compareFilters.periodAStart,
          compareFilters.periodAEnd
        ),
        ...buildPeriodParams(
          "period_b",
          compareFilters.periodBPreset,
          compareFilters.periodBStart,
          compareFilters.periodBEnd
        ),
      };

      const res = await api.get("/reports/sales/compare/", { params });
      setComparison(res.data);
      showToast("تم تحديث مقارنة الفترات بنجاح.", "success");
    } catch (err) {
      console.error("خطأ في تحميل مقارنة الفترات:", err);
      const msg = "حدث خطأ أثناء تحميل مقارنة الفترات. حاول مرة أخرى.";
      setCompareError(msg);
      showToast(msg, "error");
    } finally {
      setCompareLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      setExpenseLoading(true);
      setExpenseError(null);

      const res = await api.get("/reports/expenses/", {
        params: {
          period_type: expenseFilters.periodType,
          period_value: expenseFilters.periodValue,
        },
      });

      setExpenses(res.data);
      showToast("تم تحديث إجمالي المصروفات.", "success");
    } catch (err) {
      console.error("خطأ في تحميل المصروفات:", err);
      const msg = "حدث خطأ أثناء تحميل المصروفات. حاول مرة أخرى.";
      setExpenseError(msg);
      showToast(msg, "error");
    } finally {
      setExpenseLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    fetchPeriodStats();
    fetchComparison();
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handlePeriodTypeChange = (e) => {
    const newType = e.target.value;
    let nextValue = periodFilters.periodValue;

    if (newType === "day") {
      nextValue = formatDateInput(today);
    } else if (newType === "month") {
      nextValue = formatMonthInput(today);
    } else {
      nextValue = formatYearInput(today);
    }

    setPeriodFilters((prev) => ({
      ...prev,
      periodType: newType,
      periodValue: nextValue,
    }));
  };

  const handlePeriodFilterChange = (e) => {
    const { name, value } = e.target;
    setPeriodFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleComparePresetChange = (name, value) => {
    setCompareFilters((prev) => {
      const prefix = name === "periodAPreset" ? "periodA" : "periodB";
      const next = { ...prev, [name]: value };

      if (value === "custom") {
        next[`${prefix}Start`] =
          prev[`${prefix}Start`] || formatDateInput(thirtyDaysAgo);
        next[`${prefix}End`] = prev[`${prefix}End`] || formatDateInput(today);
      }
      return next;
    });
  };

  const handleCompareInputChange = (e) => {
    const { name, value } = e.target;
    setCompareFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleExpenseTypeChange = (e) => {
    const newType = e.target.value;
    let nextValue = expenseFilters.periodValue;

    if (newType === "day") {
      nextValue = formatDateInput(today);
    } else if (newType === "month") {
      nextValue = formatMonthInput(today);
    } else {
      nextValue = formatYearInput(today);
    }

    setExpenseFilters((prev) => ({
      ...prev,
      periodType: newType,
      periodValue: nextValue,
    }));
  };

  const handleExpenseFilterChange = (e) => {
    const { name, value } = e.target;
    setExpenseFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchReport();
  };


  const handleApplyPeriodFilters = (e) => {
    e.preventDefault();
    fetchPeriodStats();
  };

  const handleApplyComparison = (e) => {
    e.preventDefault();
    fetchComparison();
  };

  const handleApplyExpenses = (e) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleExportCsv = () => {
    if (!data || !data.series || data.series.length === 0) {
      showToast("لا توجد بيانات لتصديرها.", "error");
      return;      
    }

    const header = ["date", "total_sales", "orders"];
    const rows = data.series.map((row) => [
      row.date,
      row.total_sales,
      row.orders,
    ]);

    const csvContent = [header, ...rows]
      .map((r) => r.join(","))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `sales_report_${filters.from}_${filters.to}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("تم تنزيل ملف CSV لتقرير المبيعات.", "success");
  };

  const summary = data?.summary || {
    total_sales: 0,
    total_orders: 0,
    avg_ticket: 0,
  };
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
    {
      name: "إجمالي المبيعات",
      period_a: comparisonData.period_a.total_sales || 0,
      period_b: comparisonData.period_b.total_sales || 0,
    },
    {
      name: "عدد الطلبات",
      period_a: comparisonData.period_a.total_orders || 0,
      period_b: comparisonData.period_b.total_orders || 0,
    },
    {
      name: "متوسط قيمة الطلب",
      period_a: comparisonData.period_a.avg_order_value || 0,
      period_b: comparisonData.period_b.avg_order_value || 0,
    },
  ];
  const deltaRows = [
    { key: "total_sales", label: "إجمالي المبيعات" },
    { key: "total_orders", label: "عدد الطلبات" },
    { key: "avg_order_value", label: "متوسط قيمة الطلب" },
  ];
  const expenseData =
    expenses || {
      period_type: expenseFilters.periodType,
      period_value: expenseFilters.periodValue,
      payroll_total: 0,
      purchase_total: 0,
      total_expense: 0,
    };

  const renderProductTable = (products) =>
    products.length === 0 ? (
      <p className="text-sm text-gray-500">لا توجد بيانات كافية.</p>
    ) : (      
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-right py-2">المنتج</th>
            <th className="text-right py-2">الكمية</th>
            <th className="text-right py-2">عدد البنود</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={`${product.product_id}-${product.name}`}
              className="border-b last:border-0"
            >
              <td className="py-2">{product.name}</td>
              <td className="py-2">{product.total_quantity}</td>
              <td className="py-2">{product.order_lines}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  const pieColors = ["#0ea5e9", "#22c55e", "#eab308", "#f97316", "#ef4444"];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* لو عندك نفس الـNavbar / Sidebar بتاعة Dashboard، ممكن تحطها هنا */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
            تقارير المبيعات
          </h1>
        </div>

        {/* Filters */}
        <form
          onSubmit={handleApplyFilters}
          className="grid gap-4 md:grid-cols-4 mb-6 bg-white shadow rounded-lg p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">من تاريخ</label>
            <input
              type="date"
              name="from"
              value={filters.from}
              onChange={handleFilterChange}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">إلى تاريخ</label>
            <input
              type="date"
              name="to"
              value={filters.to}
              onChange={handleFilterChange}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">التجميع حسب</label>
            <select
              name="groupBy"
              value={filters.groupBy}
              onChange={handleFilterChange}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="day">اليوم</option>
              <option value="month">الشهر</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              تطبيق الفلتر
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-100"
            >
              تصدير CSV
            </button>
          </div>
        </form>

        {/* Expense summary */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">إجمالي المصروفات (رواتب + مشتريات)</h2>
          </div>

          <form onSubmit={handleApplyExpenses} className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">نوع الفترة</label>
              <select
                name="periodType"
                value={expenseFilters.periodType}
                onChange={handleExpenseTypeChange}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="day">اليوم</option>
                <option value="month">الشهر</option>
                <option value="year">السنة</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">قيمة الفترة</label>
              {expenseFilters.periodType === "day" && (
                <input
                  type="date"
                  name="periodValue"
                  value={expenseFilters.periodValue}
                  onChange={handleExpenseFilterChange}
                  className="border rounded px-2 py-1 text-sm"
                />
              )}
              {expenseFilters.periodType === "month" && (
                <input
                  type="month"
                  name="periodValue"
                  value={expenseFilters.periodValue}
                  onChange={handleExpenseFilterChange}
                  className="border rounded px-2 py-1 text-sm"
                />
              )}
              {expenseFilters.periodType === "year" && (
                <input
                  type="number"
                  name="periodValue"
                  min="2000"
                  value={expenseFilters.periodValue}
                  onChange={handleExpenseFilterChange}
                  className="border rounded px-2 py-1 text-sm"
                />
              )}
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                تحديث المصروفات
              </button>
            </div>
          </form>

          {expenseLoading && (
            <p className="mt-4 text-gray-600 text-sm">جاري تحميل بيانات المصروفات...</p>
          )}
          {expenseError && (
            <p className="mt-4 text-red-600 text-sm">{expenseError}</p>
          )}

          {!expenseLoading && !expenseError && (
            <div className="grid gap-4 md:grid-cols-3 mt-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">الفترة</p>
                <p className="text-sm font-semibold text-gray-800">
                  {expenseData.period_type === "day"
                    ? "اليوم"
                    : expenseData.period_type === "month"
                      ? "الشهر"
                      : "السنة"}{" "}
                  - {expenseData.period_value}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">إجمالي الرواتب</p>
                <p className="text-lg font-semibold text-gray-800">
                  {expenseData.payroll_total?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  جنيه
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">إجمالي المشتريات</p>
                <p className="text-lg font-semibold text-gray-800">
                  {expenseData.purchase_total?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  جنيه
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 md:col-span-3">
                <p className="text-xs text-gray-600 mb-1">إجمالي المصروفات</p>
                <p className="text-xl font-bold text-blue-800">
                  {expenseData.total_expense?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  جنيه
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Period stats filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              إحصائيات الفترة (يوم / شهر / سنة)              
            </h2>
          </div>
          <form
            onSubmit={handleApplyPeriodFilters}
            className="grid gap-4 md:grid-cols-5"
          >
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                نوع الفترة
              </label>
              <select
                name="periodType"
                value={periodFilters.periodType}
                onChange={handlePeriodTypeChange}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="day">اليوم</option>
                <option value="month">الشهر</option>
                <option value="year">السنة</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                قيمة الفترة
              </label>
              {periodFilters.periodType === "day" && (
                <input
                  type="date"
                  name="periodValue"
                  value={periodFilters.periodValue}
                  onChange={handlePeriodFilterChange}
                  className="border rounded px-2 py-1 text-sm"
                />
              )}
              {periodFilters.periodType === "month" && (
                <input
                  type="month"
                  name="periodValue"
                  value={periodFilters.periodValue}
                  onChange={handlePeriodFilterChange}
                  className="border rounded px-2 py-1 text-sm"
                />
              )}
              {periodFilters.periodType === "year" && (
                <input
                  type="number"
                  name="periodValue"
                  min="2000"
                  value={periodFilters.periodValue}
                  onChange={handlePeriodFilterChange}
                  className="border rounded px-2 py-1 text-sm"
                />
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">الحد</label>
              <input
                type="number"
                name="limit"
                min="1"
                value={periodFilters.limit}
                onChange={handlePeriodFilterChange}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                تحديث الإحصائيات
              </button>
            </div>
          </form>

          {periodLoading && (
            <p className="mt-4 text-gray-600 text-sm">جاري تحميل إحصائيات الفترة...</p>
          )}
          {periodError && (
            <p className="mt-4 text-red-600 text-sm">{periodError}</p>
          )}

          {!periodLoading && !periodError && (
            <>
              <div className="grid gap-4 md:grid-cols-3 mt-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">الفترة</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {periodData.period_type === "day"
                      ? "اليوم"
                      : periodData.period_type === "month"
                        ? "الشهر"
                        : "السنة"}{" "}
                    - {periodData.period_value}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">إجمالي المبيعات</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {periodData.total_sales?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    جنيه
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">عدد العناصر</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {periodFilters.limit} في الأعلى والأسفل
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2 mt-6">
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    أعلى المنتجات مبيعًا
                  </h3>
                  {periodData.top_products.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      لا توجد بيانات كافية لعرض المنتجات الأعلى.
                    </p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={periodData.top_products}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="total_quantity"
                            name="الكمية المباعة"
                            fill="#0ea5e9"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    أقل المنتجات مبيعًا
                  </h3>
                  {periodData.bottom_products.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      لا توجد بيانات كافية لعرض المنتجات الأقل.
                    </p>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-right py-2">المنتج</th>
                            <th className="text-right py-2">الكمية</th>
                            <th className="text-right py-2">عدد البنود</th>
                          </tr>
                        </thead>
                        <tbody>
                          {periodData.bottom_products.map((product) => (
                            <tr key={product.product_id} className="border-b last:border-0">
                              <td className="py-2">{product.name}</td>
                              <td className="py-2">{product.total_quantity}</td>
                              <td className="py-2">{product.order_lines}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Compare two periods */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">مقارنة فترتين</h2>
          </div>

          <form
            onSubmit={handleApplyComparison}
            className="grid gap-4 lg:grid-cols-3"
          >
            <div className="flex flex-col gap-2 border rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600">الفترة A</p>
              <select
                name="periodAPreset"
                value={compareFilters.periodAPreset}
                onChange={(e) => handleComparePresetChange("periodAPreset", e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="today">اليوم</option>
                <option value="yesterday">أمس</option>
                <option value="current_week">الأسبوع الحالي</option>
                <option value="previous_week">الأسبوع السابق</option>
                <option value="current_month">الشهر الحالي</option>
                <option value="previous_month">الشهر السابق</option>
                <option value="custom">مخصص</option>
              </select>
              {compareFilters.periodAPreset === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">من</label>
                    <input
                      type="date"
                      name="periodAStart"
                      value={compareFilters.periodAStart}
                      onChange={handleCompareInputChange}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">إلى</label>
                    <input
                      type="date"
                      name="periodAEnd"
                      value={compareFilters.periodAEnd}
                      onChange={handleCompareInputChange}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600">الفترة B</p>
              <select
                name="periodBPreset"
                value={compareFilters.periodBPreset}
                onChange={(e) => handleComparePresetChange("periodBPreset", e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="today">اليوم</option>
                <option value="yesterday">أمس</option>
                <option value="current_week">الأسبوع الحالي</option>
                <option value="previous_week">الأسبوع السابق</option>
                <option value="current_month">الشهر الحالي</option>
                <option value="previous_month">الشهر السابق</option>
                <option value="custom">مخصص</option>
              </select>
              {compareFilters.periodBPreset === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">من</label>
                    <input
                      type="date"
                      name="periodBStart"
                      value={compareFilters.periodBStart}
                      onChange={handleCompareInputChange}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600">إلى</label>
                    <input
                      type="date"
                      name="periodBEnd"
                      value={compareFilters.periodBEnd}
                      onChange={handleCompareInputChange}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  حد المنتجات
                </label>
                <input
                  type="number"
                  name="limit"
                  min="1"
                  value={compareFilters.limit}
                  onChange={handleCompareInputChange}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 self-start"
              >
                تحديث المقارنة
              </button>
            </div>
          </form>

          {compareLoading && (
            <p className="mt-4 text-gray-600 text-sm">
              جاري تحميل بيانات المقارنة...
            </p>
          )}
          {compareError && (
            <p className="mt-4 text-red-600 text-sm">{compareError}</p>
          )}

          {!compareLoading && !compareError && (
            <>
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">الفترة A</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {comparisonData.period_a.label} ({comparisonData.period_a.start} →{" "}
                    {comparisonData.period_a.end})
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-2">
                    {comparisonData.period_a.total_sales?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    جنيه
                  </p>
                  <p className="text-xs text-gray-600">
                    الطلبات: {comparisonData.period_a.total_orders} | متوسط الطلب:{" "}
                    {comparisonData.period_a.avg_order_value?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    جنيه
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">الفترة B</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {comparisonData.period_b.label} ({comparisonData.period_b.start} →{" "}
                    {comparisonData.period_b.end})
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-2">
                    {comparisonData.period_b.total_sales?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    جنيه
                  </p>
                  <p className="text-xs text-gray-600">
                    الطلبات: {comparisonData.period_b.total_orders} | متوسط الطلب:{" "}
                    {comparisonData.period_b.avg_order_value?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    جنيه
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 mt-4">
                {deltaRows.map((row) => {
                  const delta = comparisonData.deltas[row.key] || {};
                  const pct = delta.percentage;
                  return (
                    <div key={row.key} className="bg-white border rounded-lg p-4 shadow-sm">
                      <p className="text-xs text-gray-500 mb-1">{row.label}</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {delta.absolute?.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {row.key === "total_orders" ? "طلب" : "جنيه"}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-600" : "text-gray-600"
                        }`}
                      >
                        {pct === null
                          ? "لا يمكن حساب النسبة (لا توجد بيانات للفترة B)"
                          : `${pct?.toLocaleString("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}%`}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-6 lg:grid-cols-2 mt-6">
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    مقارنة المؤشرات الرئيسية
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="period_a"
                          name={`الفترة A (${comparisonData.period_a.label})`}
                          fill="#0ea5e9"
                        />
                        <Bar
                          dataKey="period_b"
                          name={`الفترة B (${comparisonData.period_b.label})`}
                          fill="#22c55e"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    قائمة الفروقات
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2">المؤشر</th>
                        <th className="text-right py-2">الفترة A</th>
                        <th className="text-right py-2">الفترة B</th>
                        <th className="text-right py-2">الفارق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deltaRows.map((row) => {
                        const delta = comparisonData.deltas[row.key] || {};
                        const aValue = comparisonData.period_a[row.key];
                        const bValue = comparisonData.period_b[row.key];
                        return (
                          <tr key={`delta-row-${row.key}`} className="border-b last:border-0">
                            <td className="py-2">{row.label}</td>
                            <td className="py-2">
                              {aValue?.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2">
                              {bValue?.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2">
                              {delta.absolute?.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              {delta.percentage !== null &&
                                delta.percentage !== undefined &&
                                ` (${delta.percentage?.toLocaleString("en-US", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}%)`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2 mt-6">
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    أعلى المنتجات - الفترة A
                  </h3>
                  {renderProductTable(comparisonData.period_a.top_products)}
                </div>
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    أعلى المنتجات - الفترة B
                  </h3>
                  {renderProductTable(comparisonData.period_b.top_products)}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2 mt-6">
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    أقل المنتجات - الفترة A
                  </h3>
                  {renderProductTable(comparisonData.period_a.bottom_products)}
                </div>
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    أقل المنتجات - الفترة B
                  </h3>
                  {renderProductTable(comparisonData.period_b.bottom_products)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Loading / Error */}
        {loading && <p className="mb-4 text-gray-600">جاري تحميل التقرير...</p>}
        {error && (
          <p className="mb-4 text-red-600 text-sm">
            {error}                                   
          </p>
        )}

        {!loading && !error && (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="bg-white shadow rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">إجمالي المبيعات</p>
                <p className="text-xl font-semibold text-gray-800">
                  {summary.total_sales?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  جنيه
                </p>
              </div>
              <div className="bg-white shadow rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">عدد الطلبات</p>
                <p className="text-xl font-semibold text-gray-800">
                  {summary.total_orders}
                </p>
              </div>
              <div className="bg-white shadow rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">
                  متوسط قيمة الفاتورة
                </p>
                <p className="text-xl font-semibold text-gray-800">
                  {summary.avg_ticket?.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  جنيه
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2 mb-6">
              {/* Sales over time */}
              <div className="bg-white shadow rounded-lg p-4">
                <h2 className="text-sm font-semibold mb-3 text-gray-800">
                  المبيعات على مدار الوقت
                </h2>
                {series.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    لا توجد بيانات كافية لعرض الرسم البياني.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="total_sales"
                          name="إجمالي المبيعات"
                        />
                        <Line
                          type="monotone"
                          dataKey="orders"
                          name="عدد الطلبات"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Top items */}
              <div className="bg-white shadow rounded-lg p-4">
                <h2 className="text-sm font-semibold mb-3 text-gray-800">
                  أعلى الأصناف مبيعًا
                </h2>
                {topItems.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    لا توجد بيانات كافية لعرض الأصناف.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topItems}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="qty_sold" name="الكمية المباعة" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Payment breakdown + Table */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Payment breakdown */}
              <div className="bg-white shadow rounded-lg p-4">
                <h2 className="text-sm font-semibold mb-3 text-gray-800">
                  توزيع المدفوعات حسب الوسيلة
                </h2>
                {paymentBreakdown.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    لا توجد بيانات مدفوعات كافية.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          dataKey="amount"
                          nameKey="gateway"
                          outerRadius={80}
                          label
                        >
                          {paymentBreakdown.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={pieColors[index % pieColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Table (series) */}
              <div className="bg-white shadow rounded-lg p-4 overflow-auto">
                <h2 className="text-sm font-semibold mb-3 text-gray-800">
                  تفاصيل حسب الفترة
                </h2>
                {series.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    لا توجد بيانات لعرضها.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2">التاريخ</th>
                        <th className="text-right py-2">إجمالي المبيعات</th>
                        <th className="text-right py-2">عدد الطلبات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.map((row) => (
                        <tr key={row.date} className="border-b last:border-0">
                          <td className="py-2">{row.date}</td>
                          <td className="py-2">
                            {row.total_sales.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            جنيه
                          </td>
                          <td className="py-2">{row.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast.open && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`max-w-xs rounded-2xl shadow-lg px-4 py-3 text-sm border-l-4 ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                : "bg-red-50 border-red-500 text-red-800"
            }`}
          >
            <p className="font-semibold mb-1">
              {toast.type === "success" ? "تم بنجاح" : "حدث خطأ"}
            </p>
            <p>{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
