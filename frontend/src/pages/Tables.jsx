import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../lib/api";
import BrandMark from "../components/layout/BrandMark";

// SidebarNav (same as dashboard)
function SidebarNav({ lang }) {
  const { pathname } = useLocation();
  const isAr = lang === "ar";

  const itemClass = (active) =>
    active
      ? "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
      : "flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800";

  const badge = (
    <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
      {isAr ? "الآن" : "Now"}
    </span>
  );

  return (
    <>
      <Link to="/dashboard" className={itemClass(pathname === "/dashboard")}>
        <span>{isAr ? "الداشبورد" : "Dashboard"}</span>
        {pathname === "/dashboard" ? badge : null}
      </Link>

      <Link to="/pos" className={itemClass(pathname === "/pos")}>
        {isAr ? "شاشة الكاشير (POS)" : "Cashier Screen (POS)"}
      </Link>

      <Link to="/inventory" className={itemClass(pathname === "/inventory")}>
        {isAr ? "إدارة المخزون" : "Inventory Management"}
      </Link>

      <Link to="/attendance" className={itemClass(pathname === "/attendance")}>
        {isAr ? "الحضور والانصراف" : "Attendance"}
      </Link>

      <Link to="/reservations" className={itemClass(pathname === "/reservations")}>
        {isAr ? "الحجوزات" : "Reservations"}
      </Link>

      <Link to="/tables" className={itemClass(pathname === "/tables")}>
        <span>{isAr ? "الطاولات" : "Tables"}</span>
        {pathname === "/tables" ? badge : null}
      </Link>

      <Link to="/reports" className={itemClass(pathname === "/reports")}>
        {isAr ? "التقارير" : "Reports"}
      </Link>

      <Link to="/settings" className={itemClass(pathname === "/settings")}>
        {isAr ? "الإعدادات" : "Settings"}
      </Link>

      <Link to="/users/create" className={itemClass(pathname === "/users/create")}>
        {isAr ? "إدارة المستخدمين" : "User Management"}
      </Link>
    </>
  );
}

export default function TablesPage() {
  // theme & language
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "en");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAr = lang === "ar";

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

  const toggleTheme = () => setTheme((p) => (p === "dark" ? "light" : "dark"));
  const setLanguage = (lng) => setLang(lng);

  // data state
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // modal create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createData, setCreateData] = useState({ number: "", capacity: 4 });

  // toast
  const [toast, setToast] = useState({ open: false, message: "", type: "success" });
  const showToast = (message, type = "success") => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast((p) => ({ ...p, open: false })), 3000);
  };

  const navigate = useNavigate();

  const fetchTables = async () => {
    try {
      setLoading(true);
      const res = await api.get("/orders/tables/", { params: { page_size: 200, ordering: "number" } });
      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setTables(results);
      setError(null);
    } catch (err) {
      console.error(err);
      const msg = isAr ? "حدث خطأ أثناء تحميل الطاولات." : "Failed to load tables.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateTable = async () => {
    if (!createData.number) {
      showToast(isAr ? "اكتب رقم الطاولة أولاً." : "Please enter table number.", "error");
      return;
    }

    try {
      setCreating(true);
      await api.post("/orders/tables/", {
        number: createData.number,
        capacity: Number(createData.capacity) || 4,
      });

      setShowCreateModal(false);
      setCreateData({ number: "", capacity: 4 });
      await fetchTables();
      showToast(isAr ? "تم إنشاء الطاولة بنجاح." : "Table created successfully.", "success");
    } catch (err) {
      console.error("create table error:", err);
      const msg =
        err?.response?.data?.detail ||
        (isAr ? "تعذر إنشاء الطاولة الجديدة، تأكد من الصلاحيات أو البيانات." : "Failed to create table.");
      showToast(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <BrandMark subtitle={isAr ? "إدارة الطاولات" : "Tables Management"} />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {isAr ? " تم تطوير هذا النظام بواسطة شركة كريتيفيتي كود." : "System developed by Creativity Code"}
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
                <SidebarNav lang={lang} />
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
                  {isAr ? "الطاولات" : "Tables"}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr ? "عرض جميع الطاولات وإضافة طاولة جديدة" : "View and add tables"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Language */}
              <div className="flex items-center text-[11px] border border-gray-200 rounded-full overflow-hidden dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-2 py-1 ${
                    !isAr
                      ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("ar")}
                  className={`px-2 py-1 ${
                    isAr
                      ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                      : "text-gray-600 dark:text-gray-300"
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

              <button
                type="button"
                className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setShowCreateModal(true)}
              >
                + {isAr ? "إضافة طاولة جديدة" : "Add table"}
              </button>

              <button
                type="button"
                className="hidden sm:inline-flex px-3 py-2 text-xs rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                onClick={() => navigate(-1)}
              >
                {isAr ? "رجوع" : "Back"}
              </button>
            </div>
          </header>

          <div className="px-4 md:px-8 py-6 space-y-4 max-w-7xl mx-auto w-full">
            {loading && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                {isAr ? "جاري تحميل الطاولات..." : "Loading tables..."}
              </div>
            )}

            {error && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                {error}
              </div>
            )}

            {!loading && !error && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                {tables.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isAr ? "لا توجد طاولات مسجلة حتى الآن." : "No tables yet."}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tables.map((table) => (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => navigate(`/tables/${table.id}`)}
                        className="bg-gray-50/60 rounded-2xl border border-gray-100 p-4 text-right hover:bg-gray-50 hover:border-blue-200 transition dark:bg-slate-800/70 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <p className="text-sm font-semibold text-gray-900 mb-1 dark:text-gray-50">
                          {isAr ? `طاولة ${table.number}` : `Table ${table.number}`}
                        </p>
                        <p className="text-xs text-gray-500 mb-1 dark:text-gray-400">
                          {isAr ? `السعة: ${table.capacity} أفراد` : `Capacity: ${table.capacity}`}
                        </p>
                        <p className="text-xs">
                          <span
                            className={
                              table.is_available
                                ? "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100"
                                : "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-100"
                            }
                          >
                            {table.is_available ? (isAr ? "متاحة" : "Available") : isAr ? "غير متاحة" : "Unavailable"}
                          </span>
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-3">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-50">
                {isAr ? "إضافة طاولة جديدة" : "Add new table"}
              </h3>
              <button
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                placeholder={isAr ? "رقم الطاولة (مثال: 1 أو A1)" : "Table number (e.g. 1 or A1)"}
                value={createData.number}
                onChange={(e) => setCreateData({ ...createData, number: e.target.value })}
                disabled={creating}
              />

              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                placeholder={isAr ? "السعة (عدد الأفراد)" : "Capacity"}
                value={createData.capacity}
                onChange={(e) => setCreateData({ ...createData, capacity: e.target.value })}
                disabled={creating}
              />
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>

              <button
                className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white disabled:opacity-50"
                onClick={handleCreateTable}
                disabled={creating}
              >
                {creating ? (isAr ? "جاري الحفظ..." : "Saving...") : isAr ? "حفظ الطاولة" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.open && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`max-w-xs rounded-2xl shadow-lg px-4 py-3 text-sm border-l-4 ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-600 dark:text-emerald-100"
                : "bg-red-50 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-100"
            }`}
          >
            <p className="font-semibold mb-1">
              {toast.type === "success" ? (isAr ? "تم بنجاح" : "Success") : isAr ? "حدث خطأ" : "Error"}
            </p>
            <p>{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
