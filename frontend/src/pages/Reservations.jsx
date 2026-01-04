import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../lib/api";
import BrandMark from "../components/layout/BrandMark";

// =====================
// Shared Sidebar Nav (same dashboard style)
// =====================
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
        <span>{isAr ? "الحجوزات" : "Reservations"}</span>
        {pathname === "/reservations" ? badge : null}
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

// =====================
// Reservation constants
// =====================
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

// ------------------------
// Helpers
// ------------------------
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}
function getMonthDaysGrid(currentDate) {
  const start = startOfMonth(currentDate);
  const startDay = (start.getDay() + 6) % 7; // Monday=0 style (for Arabic UI)

  const firstCell = new Date(start);
  firstCell.setDate(start.getDate() - startDay);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstCell);
    d.setDate(firstCell.getDate() + i);
    days.push(d);
  }
  return days;
}
function formatDateKey(date) {
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD
}
function formatTime(dateString, locale) {
  if (!dateString) return "--";
  const d = new Date(dateString);
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------
export default function Reservations() {
  // theme & language (same dashboard logic)
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

  // reservations state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableTables, setAvailableTables] = useState([]);
  const [createData, setCreateData] = useState({
    customer_name: "",
    customer_phone: "",
    party_size: 2,
    table: "",
    reservation_time: "",
    notes: "",
  });

  // Toast
  const [toast, setToast] = useState({ open: false, message: "", type: "success" });
  const showToast = useCallback((message, type = "success") => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, open: false })), 3000);
  }, []);

  // ------------------------
  // Fetch month reservations
  // ------------------------
  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      const from = startOfMonth(currentDate).toISOString();
      const to = endOfMonth(currentDate).toISOString();

      const res = await api.get("/orders/reservations/", {
        params: {
          from,
          to,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          page_size: 200,
        },
      });

      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setReservations(results);
      setError(null);
    } catch (err) {
      console.error(err);
      const msg = isAr ? "خطأ أثناء تحميل الحجوزات." : "Failed to load reservations.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [currentDate, statusFilter, showToast, isAr]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // ------------------------
  // Group by day
  // ------------------------
  const reservationsByDay = useMemo(() => {
    const map = {};
    reservations.forEach((r) => {
      const key = formatDateKey(new Date(r.reservation_time));
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [reservations]);

  const daysGrid = useMemo(() => getMonthDaysGrid(currentDate), [currentDate]);

  const monthName = currentDate.toLocaleDateString(isAr ? "ar-EG" : "en-EG", {
    month: "long",
    year: "numeric",
  });

  // ------------------------
  // Fetch available tables
  // ------------------------
  const getAvailableTables = async (datetime, partySize) => {
    try {
      const res = await api.get("/orders/reservations/available-tables/", {
        params: { time: datetime, party_size: partySize, duration: 60 },
      });
      setAvailableTables(res.data || []);
    } catch (err) {
      console.error("available-tables error:", err);
      const msg = isAr ? "تعذر تحميل الطاولات المتاحة." : "Failed to load available tables.";
      showToast(msg, "error");
      setAvailableTables([]);
    }
  };

  // ------------------------
  // Create reservation
  // ------------------------
  const createReservation = async () => {
    try {
      if (!createData.customer_name || !createData.customer_phone || !createData.reservation_time || !createData.table) {
        showToast(isAr ? "من فضلك أكمل البيانات المطلوبة." : "Please fill required fields.", "error");
        return;
      }

      await api.post("/orders/reservations/", createData);
      setShowCreateModal(false);
      await fetchReservations();
      showToast(isAr ? "تم إنشاء الحجز بنجاح." : "Reservation created successfully.", "success");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        (isAr ? "تعذر إنشاء الحجز." : "Failed to create reservation.");
      showToast(msg, "error");
    }
  };

  // ------------------------
  // Update reservation status
  // ------------------------
  const updateStatus = async (status) => {
    try {
      await api.patch(`/orders/reservations/${selectedReservation.id}/`, {
        status,
        table: selectedReservation.table,
      });
      setSelectedReservation(null);
      await fetchReservations();
      showToast(isAr ? "تم تحديث حالة الحجز بنجاح." : "Reservation updated successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast(isAr ? "خطأ أثناء تحديث الحالة." : "Failed to update reservation.", "error");
    }
  };

  const daysOfWeek = isAr
    ? ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]
    : ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <BrandMark subtitle={isAr ? "إدارة الحجوزات" : "Reservations Management"} />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {isAr ? "تم تطوير هذا السيستم بواسطة كريتفيتي كود" : "تم تطوير هذا السيستم بواسطة كريتفيتي كود"}
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
                {isAr ? "تم تطوير هذا السيستم بواسطة كريتفيتي كود" : "تم تطوير هذا السيستم بواسطة كريتفيتي كود"}
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
                  {isAr ? "الحجوزات" : "Reservations"}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr ? "عرض وإدارة حجوزات الطاولات" : "View and manage table reservations"}
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

              <Link
                to="/tables"
                className="hidden sm:inline-flex px-3 py-2 text-xs rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
              >
                {isAr ? "الطاولات" : "Tables"}
              </Link>

              <button
                className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  setShowCreateModal(true);
                  setAvailableTables([]);
                  setCreateData({
                    customer_name: "",
                    customer_phone: "",
                    party_size: 2,
                    table: "",
                    reservation_time: "",
                    notes: "",
                  });
                }}
              >
                + {isAr ? "إنشاء حجز جديد" : "New Reservation"}
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-4 max-w-7xl mx-auto w-full">
            {/* Loading / Error */}
            {loading && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                {isAr ? "جاري تحميل الحجوزات..." : "Loading reservations..."}
              </div>
            )}

            {error && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                {error}
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
                  onClick={() =>
                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
                  }
                >
                  {isAr ? "الشهر السابق" : "Prev month"}
                </button>

                <button
                  className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
                  onClick={() => setCurrentDate(new Date())}
                >
                  {isAr ? "اليوم" : "Today"}
                </button>

                <button
                  className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
                  onClick={() =>
                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
                  }
                >
                  {isAr ? "الشهر التالي" : "Next month"}
                </button>
              </div>

              <div className="flex items-center gap-2 justify-between md:justify-end">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                >
                  <option value="ALL">{isAr ? "كل الحالات" : "All statuses"}</option>
                  <option value="PENDING">{isAr ? "قيد التأكيد" : "Pending"}</option>
                  <option value="CONFIRMED">{isAr ? "مؤكد" : "Confirmed"}</option>
                  <option value="CANCELLED">{isAr ? "ملغي" : "Cancelled"}</option>
                  <option value="NO_SHOW">{isAr ? "لم يحضر" : "No show"}</option>
                </select>

                <div className="font-semibold text-gray-800 dark:text-gray-100">{monthName}</div>
              </div>
            </div>

            {/* Calendar (responsive: scroll on small) */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 md:p-4 dark:bg-slate-900 dark:border-slate-800">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-2 dark:text-gray-400">
                    {daysOfWeek.map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 bg-gray-100 rounded-2xl overflow-hidden dark:bg-slate-800">
                    {daysGrid.map((day, idx) => {
                      const key = formatDateKey(day);
                      const dayReservations = reservationsByDay[key] || [];
                      const inMonth = day.getMonth() === currentDate.getMonth();

                      return (
                        <div
                          key={`${key}-${idx}`}
                          className={`bg-white border border-gray-100 p-2 relative cursor-pointer min-h-[110px] md:min-h-[130px] dark:bg-slate-900 dark:border-slate-800 ${
                            inMonth ? "" : "opacity-60"
                          }`}
                          onClick={() => {
                            setShowCreateModal(true);

                            const iso = new Date(
                              day.getFullYear(),
                              day.getMonth(),
                              day.getDate(),
                              20,
                              0
                            ).toISOString();

                            setCreateData((x) => ({ ...x, reservation_time: iso, party_size: 2, table: "" }));
                            setAvailableTables([]);
                            getAvailableTables(iso, 2);
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-gray-700 dark:text-gray-200">{day.getDate()}</div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500">
                              {dayReservations.length > 0 ? dayReservations.length : ""}
                            </div>
                          </div>

                          {dayReservations.length === 0 ? (
                            <div className="text-[10px] text-gray-300 dark:text-gray-600">
                              {isAr ? "لا حجوزات" : "No reservations"}
                            </div>
                          ) : (
                            dayReservations.slice(0, 4).map((r) => (
                              <div
                                key={r.id}
                                className={`text-[10px] p-1 rounded-lg cursor-pointer mb-1 ${STATUS_COLORS[r.status]}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReservation(r);
                                }}
                              >
                                <div className="flex justify-between gap-2">
                                  <span className="truncate">{r.customer_name}</span>
                                  <span>{formatTime(r.reservation_time, isAr ? "ar-EG" : "en-EG")}</span>
                                </div>
                              </div>
                            ))
                          )}

                          {dayReservations.length > 4 && (
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                              {isAr ? "المزيد..." : "More..."}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Reservation Panel */}
          {selectedReservation && (
            <div className="fixed inset-0 bg-black/40 flex justify-end z-30">
              <div className="w-full max-w-md bg-white h-full shadow-xl flex flex-col dark:bg-slate-900">
                <div className="p-4 border-b flex justify-between items-start dark:border-slate-800">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                      {selectedReservation.customer_name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(selectedReservation.reservation_time, isAr ? "ar-EG" : "en-EG")}
                    </p>
                  </div>

                  <button
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={() => setSelectedReservation(null)}
                  >
                    {isAr ? "إغلاق" : "Close"}
                  </button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto text-sm space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "الحالة" : "Status"}</p>
                    <div
                      className={`inline-block px-2 py-1 rounded-full text-xs mt-1 ${STATUS_COLORS[selectedReservation.status]}`}
                    >
                      {STATUS_LABELS[selectedReservation.status] || selectedReservation.status}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "رقم الطاولة" : "Table"}</p>
                    <p className="text-gray-900 dark:text-gray-50">{selectedReservation.table_number}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "عدد الأشخاص" : "Party size"}</p>
                    <p className="text-gray-900 dark:text-gray-50">{selectedReservation.party_size}</p>
                  </div>

                  {selectedReservation.notes && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? "ملاحظات" : "Notes"}</p>
                      <p className="text-gray-900 dark:text-gray-50">{selectedReservation.notes}</p>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t flex gap-2 justify-end dark:border-slate-800">
                  <button
                    className="px-3 py-2 text-xs rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                    onClick={() => updateStatus("CONFIRMED")}
                  >
                    {isAr ? "تأكيد" : "Confirm"}
                  </button>

                  <button
                    className="px-3 py-2 text-xs rounded-xl border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/30"
                    onClick={() => updateStatus("CANCELLED")}
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>

                  <button
                    className="px-3 py-2 text-xs rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                    onClick={() => updateStatus("NO_SHOW")}
                  >
                    {isAr ? "لم يحضر" : "No show"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Reservation Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-40 px-3">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-5 dark:bg-slate-900">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-50">
                    {isAr ? "إنشاء حجز جديد" : "Create reservation"}
                  </h3>
                  <button
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={() => setShowCreateModal(false)}
                  >
                    {isAr ? "إغلاق" : "Close"}
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    placeholder={isAr ? "اسم العميل" : "Customer name"}
                    value={createData.customer_name}
                    onChange={(e) => setCreateData({ ...createData, customer_name: e.target.value })}
                  />

                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    placeholder={isAr ? "رقم الهاتف" : "Phone number"}
                    value={createData.customer_phone}
                    onChange={(e) => setCreateData({ ...createData, customer_phone: e.target.value })}
                  />

                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    value={createData.party_size}
                    placeholder={isAr ? "عدد الأشخاص" : "Party size"}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setCreateData({ ...createData, party_size: p, table: "" });
                      if (createData.reservation_time) getAvailableTables(createData.reservation_time, p);
                    }}
                  />

                  <input
                    type="datetime-local"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    onChange={(e) => {
                      const iso = new Date(e.target.value).toISOString();
                      setCreateData({ ...createData, reservation_time: iso, table: "" });
                      getAvailableTables(iso, createData.party_size);
                    }}
                  />

                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    value={createData.table}
                    onChange={(e) => setCreateData({ ...createData, table: e.target.value })}
                  >
                    <option value="">{isAr ? "اختر طاولة" : "Select table"}</option>
                    {availableTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {isAr ? `طاولة ${t.number}` : `Table ${t.number}`} — {isAr ? "سعة" : "Cap"}: {t.capacity}
                      </option>
                    ))}
                  </select>

                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                    placeholder={isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}
                    rows={3}
                    value={createData.notes}
                    onChange={(e) => setCreateData({ ...createData, notes: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-5">
                  <button
                    className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    onClick={() => setShowCreateModal(false)}
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>

                  <button
                    className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                    onClick={createReservation}
                  >
                    {isAr ? "حفظ الحجز" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

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