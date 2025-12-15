import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import api from "../lib/api";

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

      <Link to="/reservations" className={itemClass(pathname === "/reservations")}>
        {isAr ? "الحجوزات" : "Reservations"}
      </Link>

      <Link to="/tables" className={itemClass(pathname === "/tables")}>
        <span>{isAr ? "الطاولات" : "Tables"}</span>
        {pathname === "/tables" ? badge : null}
      </Link>

      <Link to="/settings" className={itemClass(pathname === "/settings")}>
        {isAr ? "الإعدادات" : "Settings"}
      </Link>
    </>
  );
}

const STATUS_LABELS = {
  PENDING: "قيد التأكيد",
  CONFIRMED: "مؤكد",
  CANCELLED: "ملغي",
  NO_SHOW: "لم يحضر",
};

const STATUS_COLORS = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-100",
  CONFIRMED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-100",
  NO_SHOW: "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-200",
};

function formatDateTime(dateString, locale) {
  if (!dateString) return "--";
  const d = new Date(dateString);
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TableDetails() {
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

  const { tableId } = useParams();
  const navigate = useNavigate();

  const [table, setTable] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [error, setError] = useState(null);

  const hasQr = useMemo(() => !!(table?.qr_code_url || table?.qr_code_base64), [table]);

  useEffect(() => {
    if (!tableId) return;

    const fetchTable = async () => {
      try {
        setLoadingTable(true);
        const res = await api.get(`/orders/tables/${tableId}/`);
        setTable(res.data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(isAr ? "تعذر تحميل بيانات الطاولة." : "Failed to load table details.");
      } finally {
        setLoadingTable(false);
      }
    };

    const fetchReservations = async () => {
      try {
        setLoadingReservations(true);
        const res = await api.get("/orders/reservations/", {
          params: { table: tableId, page_size: 200, ordering: "-reservation_time" },
        });
        const results = Array.isArray(res.data) ? res.data : res.data.results || [];
        setReservations(results);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingReservations(false);
      }
    };

    fetchTable();
    fetchReservations();
  }, [tableId, isAr]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <h1 className="text-xl font-bold text-primary dark:text-blue-300">MVP POS</h1>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
              {isAr ? "تفاصيل الطاولة" : "Table Details"}
            </p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} />
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
                <div>
                  <h2 className="text-base font-bold text-primary dark:text-blue-300">MVP POS</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5 dark:text-gray-400">
                    {isAr ? "القائمة الرئيسية" : "Main Menu"}
                  </p>
                </div>
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
                  {table ? (isAr ? `تفاصيل الطاولة ${table.number}` : `Table ${table.number} details`) : isAr ? "تفاصيل الطاولة" : "Table details"}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr ? "عرض بيانات الطاولة والحجوزات المرتبطة بها" : "Table info and related reservations"}
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
                className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                onClick={() => navigate(-1)}
              >
                {isAr ? "رجوع" : "Back"}
              </button>
            </div>
          </header>

          <div className="px-4 md:px-8 py-6 space-y-4 max-w-7xl mx-auto w-full">
            {error && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                {error}
              </div>
            )}

            {/* Table info */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
              {loadingTable ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? "جاري تحميل بيانات الطاولة..." : "Loading table..."}</p>
              ) : !table ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? "لم يتم العثور على الطاولة." : "Table not found."}</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "رقم الطاولة" : "Table number"}</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-50">{table.number}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "السعة" : "Capacity"}</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-50">
                        {table.capacity} {isAr ? "أفراد" : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "الحالة" : "Status"}</p>
                      <span
                        className={
                          table.is_available
                            ? "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100"
                            : "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-100"
                        }
                      >
                        {table.is_available ? (isAr ? "متاحة" : "Available") : isAr ? "غير متاحة" : "Unavailable"}
                      </span>
                    </div>

                    <div className="pt-2">
                      <Link
                        to="/tables"
                        className="inline-flex text-xs px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        {isAr ? "عرض كل الطاولات" : "All tables"}
                      </Link>
                    </div>
                  </div>

                  {/* QR */}
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-xs text-gray-500 mb-2 dark:text-gray-400">{isAr ? "QR كود للطاولة" : "Table QR code"}</p>
                    {hasQr ? (
                      <div className="border rounded-2xl p-3 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                        <img
                          src={table.qr_code_url ? table.qr_code_url : `data:image/png;base64,${table.qr_code_base64}`}
                          alt="QR Code"
                          className="w-40 h-40 object-contain"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {isAr ? "لم يتم توليد QR للطاولة بعد." : "QR not generated yet."}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Reservations table */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    {isAr ? "الحجوزات الخاصة بهذه الطاولة" : "Reservations for this table"}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                    {isAr ? "آخر الحجوزات المسجلة على هذه الطاولة." : "Latest reservations for this table."}
                  </p>
                </div>
              </div>

              {loadingReservations ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? "جاري تحميل الحجوزات..." : "Loading reservations..."}</p>
              ) : reservations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{isAr ? "لا توجد حجوزات مسجلة لهذه الطاولة." : "No reservations found."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                        <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                          {isAr ? "العميل" : "Customer"}
                        </th>
                        <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                          {isAr ? "رقم الهاتف" : "Phone"}
                        </th>
                        <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                          {isAr ? "الوقت" : "Time"}
                        </th>
                        <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                          {isAr ? "عدد الأشخاص" : "Party size"}
                        </th>
                        <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                          {isAr ? "الحالة" : "Status"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((r) => (
                        <tr key={r.id} className="border-b border-gray-50 last:border-0 dark:border-slate-800">
                          <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{r.customer_name}</td>
                          <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{r.customer_phone || "-"}</td>
                          <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {formatDateTime(r.reservation_time, isAr ? "ar-EG" : "en-EG")}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{r.party_size}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${STATUS_COLORS[r.status] || ""}`}>
                              {STATUS_LABELS[r.status] || r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
