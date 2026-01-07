import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';
import { renderLocation } from '../lib/location';
import BrandMark from '../components/layout/BrandMark';

const LAST_GPS_KEY = 'attendance:last-gps';

// =====================
// GPS cache helpers
// =====================
function loadLastGps() {
  try {
    const cached = localStorage.getItem(LAST_GPS_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed?.lat && parsed?.lng) return parsed;
  } catch (e) {
    console.warn('[Attendance] Failed to read cached GPS', e);
  }
  return null;
}

function saveLastGps(gps) {
  try {
    localStorage.setItem(
      LAST_GPS_KEY,
      JSON.stringify({ lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy })
    );
  } catch (e) {
    console.warn('[Attendance] Failed to cache GPS', e);
  }
}

async function getGeoLocation() {
  const requestLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('غير مدعوم'));

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });

  const cached = loadLastGps();

  try {
    const live = await requestLocation();
    saveLastGps(live);
    return live;
  } catch (err) {
    if (cached) {
      console.warn('[Attendance] Using cached GPS after error:', err);
      return { ...cached, cached: true };
    }
    throw err;
  }
}

// =====================
// Formatting helpers
// =====================
function fmtDateTime(v, locale = 'ar-EG') {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(v);
  }
}

function fmtMinutes(min, isAr) {
  if (!min) return isAr ? '0 د' : '0 min';
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  if (!h) return isAr ? `${m} د` : `${m} min`;
  if (!m) return isAr ? `${h} س` : `${h} h`;
  return isAr ? `${h} س ${m} د` : `${h} h ${m} min`;
}

function fmtTime(value, locale = 'ar-EG') {
  if (!value) return '—';
  try {
    const d = new Date(`1970-01-01T${value}`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(value);
  }
}

function getResultTimestamp(res) {
  if (!res) return 0;
  const candidate = res.check_out || res.check_in || res.work_date;
  if (!candidate) return 0;
  const ts = new Date(candidate).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

// =====================
// Sidebar Navigation
// =====================
function SidebarNav({ lang }) {
  const isAr = lang === 'ar';

  const base =
    'flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800';

  return (
    <>
      <Link
        to="/dashboard"
        className={base}
      >
        {isAr ? 'الداشبورد' : 'Dashboard'}
      </Link>

      <Link to="/pos" className={base}>
        {isAr ? 'شاشة الكاشير (POS)' : 'Cashier Screen (POS)'}
      </Link>

      <Link to="/inventory" className={base}>
        {isAr ? 'إدارة المخزون' : 'Inventory Management'}
      </Link>

      {/* Active */}
      <Link
        to="/attendance"
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
      >
        <span>{isAr ? 'الحضور والانصراف' : 'Attendance'}</span>
        <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
          {isAr ? 'الآن' : 'Now'}
        </span>
      </Link>

      <Link to="/reservations" className={base}>
        {isAr ? 'الحجوزات' : 'Reservations'}
      </Link>

      <Link to="/reports" className={base}>
        {isAr ? 'التقارير' : 'Reports'}
      </Link>

      <Link to="/settings" className={base}>
        {isAr ? 'الإعدادات' : 'Settings'}
      </Link>

      <Link to="/employees" className={base}>
        {isAr ? 'الموظفين' : 'Employees'}
      </Link>

      <Link to="/accounting" className={base}>
        {isAr ? 'الحسابات' : 'Accounting'}
      </Link>

      <Link to="/users/create" className={base}>
        {isAr ? 'إدارة المستخدمين' : 'User Management'}
      </Link>
    </>
  );
}

export default function EmployeeAttendance() {
  // ==================
  // Theme & language
  // ==================
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAr = lang === 'ar';
  const locale = isAr ? 'ar-EG' : 'en-EG';

  const t = useCallback(
    (ar, en) => (isAr ? ar : en),
    [isAr]
  );

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const toggleTheme = () => setTheme((p) => (p === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  // ==================
  // Attendance state
  // ==================
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);

  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [qrSession, setQrSession] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);

  const monthly = status?.month || {};  
  const salary = Number(status?.employee?.salary) || 0;
  const attendanceValue = Math.max(0, Number(monthly.attendance_value) || 0);
  const totalPenalties = Math.max(0, Number(monthly.penalties) || 0);
  const projectedNetSalary =
    typeof monthly.projected_net_salary === 'number'
      ? Math.max(0, Number(monthly.projected_net_salary))
      : Math.max(0, salary - attendanceValue - totalPenalties);
  const qrBase64 = qrSession?.qr_base64 || status?.employee?.qr_attendance_base64;
  const employeeStore = status?.employee?.store;
  const employeeStoreName = status?.employee?.store_name || employeeStore?.name || '—';
  const employeeStoreId =
    status?.employee?.store_id ??
    employeeStore?.id ??
    (typeof employeeStore === 'string' || typeof employeeStore === 'number' ? employeeStore : '—');

  const fetchMyStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const res = await api.get('/attendance/my-status/');
      setStatus(res.data);
    } catch (e) {
      setStatus(null);
      const msg =
        e?.response?.data?.detail ||
        t('تعذر جلب ملخص الحضور.', 'Failed to load attendance summary.');
      notifyError(msg);
    } finally {
      setStatusLoading(false);
    }
  }, [t]);

  const fetchMyLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const res = await api.get('/attendance/my-logs/', { params: { limit: 15 } });
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        t('تعذر جلب سجلات الحضور.', 'Failed to load attendance logs.');
      setLogsError(msg);
      notifyError(msg);
    } finally {
      setLogsLoading(false);
    }
  }, [t]);

  const fetchQrSession = useCallback(async () => {
    try {
      setQrLoading(true);
      setQrError(null);
      const res = await api.post('/attendance/link/');
      setQrSession(res.data || null);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        t('تعذر إنشاء QR جديد للحضور.', 'Failed to create a new attendance QR.');
      setQrError(msg);
    } finally {
      setQrLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMyStatus();
    fetchMyLogs();
    fetchQrSession();
  }, [fetchMyLogs, fetchMyStatus, fetchQrSession]);

  const buildResultFromLog = useCallback(
    (log) => {
      if (!log) return null;
      const statusType = log.check_out ? 'checkout' : 'checkin';
      const loc = log.location || log.gps;
      let durationMinutes = null;
      if (log.check_in && log.check_out) {
        const diff =
          new Date(log.check_out).getTime() - new Date(log.check_in).getTime();
        if (!Number.isNaN(diff)) durationMinutes = Math.floor(diff / 60000);
      }
      return {
        status: statusType,
        message:
          statusType === 'checkin'
            ? t('آخر تسجيل حضور محفوظ', 'Last saved check-in')
            : t('آخر تسجيل انصراف محفوظ', 'Last saved check-out'),
        work_date: log.work_date,
        check_in: log.check_in,
        check_out: log.check_out,
        is_late: log.is_late,
        late_minutes: log.late_minutes,
        penalty: typeof log.penalty_applied === 'number' ? log.penalty_applied : Number(log.penalty_applied || 0),
        duration_minutes: durationMinutes,
        gps: loc,
        location: loc,
      };
    },
    [t]
  );

  useEffect(() => {
    if (!status) return;
    const log = status.active_log || status.today_log;
    if (!log) return;
    const derived = buildResultFromLog(log);
    if (!derived) return;
    setResult((prev) => {
      const prevTs = getResultTimestamp(prev);
      const newTs = getResultTimestamp(derived);
      if (!prev || newTs >= prevTs) {
        return derived;
      }
      return prev;
    });
  }, [status, buildResultFromLog]);

  const handleSubmit = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);

    try {
      const location = await getGeoLocation();
      if (!location?.lat || !location?.lng) {
        throw new Error(          
          t(
            'تعذر تحديد موقعك. من فضلك فعّل خدمة الموقع وحاول مرة أخرى.',
            'Could not detect your location. Please enable location services and try again.'
          )
        );
      }

      const gpsPayload = {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      };
      const payload = { gps: gpsPayload };
      const usedCachedGps = Boolean(location.cached);

      const res = await api.post('/attendance/check/', payload);
      const recordedLocation = res.data.location || res.data.gps || gpsPayload;

      setResult({
        status: res.data.status,
        message: res.data.message,
        work_date: res.data.work_date,
        check_in: res.data.check_in,
        check_out: res.data.check_out,
        is_late: res.data.is_late,
        late_minutes: res.data.late_minutes,
        penalty: res.data.penalty,
        duration_minutes: res.data.duration_minutes,
        gps: recordedLocation,
        location: recordedLocation,
        usedCachedGps,
      });

      fetchMyStatus();
      fetchMyLogs();

      notifySuccess(res.data.message || t('تم تسجيل العملية بنجاح', 'Recorded successfully'));
      if (usedCachedGps) {
        notifyError(
          t(            
            'تم استخدام آخر موقع محفوظ. يرجى تفعيل خدمة الموقع لتسجيل موقعك الحالي.',
            'Last saved location was used. Please enable location services to record your current position.'
          )
        );
      }
    } catch (err) {
      const statusCode = err?.response?.status;
      const data = err?.response?.data;

      let msg =
        data?.message ||
        data?.detail ||
        err.message ||
        t('حدث خطأ أثناء تسجيل الحضور/الانصراف.', 'Error while recording attendance.');

      if (err?.code === 1) {
        msg = t(
          'تم رفض إذن الموقع. رجاء تفعيل تحديد الموقع للتسجيل.',
          'Location permission denied. Please allow location access to proceed.'
        );
      } else if (err?.message === 'غير مدعوم') {
        msg = t(
          'متصفحك لا يدعم تحديد الموقع أو يحتاج إلى تفعيل HTTPS.',
          'Geolocation is not supported or requires HTTPS.'
        );
      }

      setError(msg);

      if (statusCode === 401) {
        notifyError(t('غير مصرح: برجاء تسجيل الدخول مرة أخرى.', 'Unauthorized: please log in again.'));
      } else {
        notifyError(msg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const isCheckin = result?.status === 'checkin';
  const isCheckout = result?.status === 'checkout';

  // ==================
  // UI
  // ==================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-5 border-b dark:border-slate-800">
            <BrandMark subtitle={t('لوحة تحكم الكافيه / المطعم', 'Restaurant / Café Dashboard')} />
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            <SidebarNav lang={lang} />
          </nav>

          <div className="px-4 py-4 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
            {t('تم تطوير هذا السيستم بواسطة كريتفيتي كود', 'تم تطوير هذا السيستم بواسطة كريتفيتي كود')}
          </div>
        </aside>

        {/* Sidebar - Mobile (Overlay) */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden" aria-modal="true">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative ml-auto h-full w-64 bg-white shadow-xl border-l border-gray-200 flex flex-col dark:bg-slate-900 dark:border-slate-800">
              <div className="px-4 py-4 border-b flex items-center justify-between dark:border-slate-800">
                <BrandMark variant="mobile" subtitle={t('القائمة الرئيسية', 'Main Menu')} />                
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="inline-flex items-center justify-center rounded-full p-1.5 border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  <span className="sr-only">{t('إغلاق القائمة', 'Close menu')}</span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <SidebarNav lang={lang} />
              </nav>

              <div className="px-4 py-3 border-t text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
                {t('تم تطوير هذا السيستم بواسطة كريتفيتي كود', 'تم تطوير هذا السيستم بواسطة كريتفيتي كود')}
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
                <span className="sr-only">{t('فتح القائمة', 'Open menu')}</span>
                <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {t('الحضور والانصراف', 'Attendance')}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {t(
                    'سجل الدخول أو الانصراف مع التحقق بالموقع وحساب التأخير تلقائيًا',
                    'Check in/out with GPS verification and automatic lateness calculation'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick back */}
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex text-xs md:text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {t('← الرجوع للداشبورد', '← Back to Dashboard')}
              </Link>

              {/* Language */}
              <div className="flex items-center text-[11px] border border-gray-200 rounded-full overflow-hidden dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 ${
                    !isAr ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`px-2 py-1 ${
                    isAr ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'
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
                    <span className="hidden sm:inline">{t('وضع فاتح', 'Light')}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span>🌙</span>
                    <span className="hidden sm:inline">{t('وضع داكن', 'Dark')}</span>
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Summary quick card */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm md:text-base font-bold text-gray-900 dark:text-gray-50">
                  {t('تسجيل حضور الموظفين', 'Employee Attendance')}
                </h3>
                <p className="text-[11px] md:text-xs text-gray-500 mt-1 dark:text-gray-400">
                  {t(
                    'يتم التسجيل تلقائيًا عبر QR أو الرابط المولد. يجب تفعيل الموقع وسيتم تسجيل التأخير والخصومات تلقائيًا.',
                    'Check-in/out happens automatically via your QR or generated link. Location must be enabled; lateness and penalties are calculated automatically.'
                  )}
                </p>
              </div>

                <Link
                  to="/dashboard"
                  className="sm:hidden text-xs px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('← رجوع', '← Back')}
                </Link>
              </div>

              {/* Status blocks */}
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {/* Employee card */}
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 dark:bg-slate-800/70 dark:border-slate-700">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-2 dark:text-gray-200">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    {t('بيانات الموظف الحالي', 'Current employee')}
                  </p>

                  {statusLoading ? (
                    <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">
                      {t('جاري تحميل الملخص...', 'Loading summary...')}
                    </p>
                  ) : status ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 mt-2 dark:text-gray-50">
                        {status.employee?.name || '—'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 dark:text-gray-300">
                        {t('الفرع:', 'Branch:')} {employeeStoreName}{' '}
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          (ID: {employeeStoreId})
                        </span>
                      </p>                      
                      <p className="text-xs text-gray-600 mt-1 dark:text-gray-300">␊
                        {t('الراتب اليومي:', 'Daily salary:')} {status.employee?.salary || 0}{' '}
                        {t('ج.م', 'EGP')}
                      </p>
                      {status.active_log ? (
                        <div className="mt-3 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-100">
                          {t('جلسة نشطة منذ:', 'Active session since:')}{' '}
                          {fmtDateTime(status.active_log.check_in, locale)}
                        </div>
                      ) : (
                        <div className="mt-3 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-100">
                          {t('لا توجد جلسة مفتوحة الآن.', 'No open session right now.')}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-red-600 mt-2 dark:text-red-200">
                      {t('تعذر تحميل بياناتك.', 'Failed to load your data.')}
                    </p>
                  )}
                </div>

                {/* Month stats */}
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-gray-500 text-[11px] dark:text-gray-400">{t('حضور هذا الشهر', 'Present days')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-50">
                      {status?.month?.present_days ?? '—'} {t('يوم', 'day(s)')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-gray-500 text-[11px] dark:text-gray-400">{t('الغياب المحتسب', 'Absent days')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-50">
                      {status?.month?.absent_days ?? '—'} {t('يوم', 'day(s)')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-gray-500 text-[11px] dark:text-gray-400">{t('إجمالي التأخير', 'Total late')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-50">
                      {fmtMinutes(status?.month?.late_minutes || 0, isAr)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-gray-500 text-[11px] dark:text-gray-400">{t('الجزاءات', 'Penalties')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-50">
                      {status?.month?.penalties || 0} {t('ج.م', 'EGP')}
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-1 dark:text-emerald-200">
                      {t('الصافي حتى تاريخه:', 'Net so far:')}{' '}
                      {Math.max(0, status?.month?.estimated_net_salary || 0)} {t('ج.م', 'EGP')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {status?.month?.late_minutes > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-100">
                  {t(
                    `تنبيه: لديك إجمالي تأخير ${fmtMinutes(status.month.late_minutes, true)} هذا الشهر. يرجى الالتزام بموعد الشفت لتجنب خصومات إضافية.`,
                    `Warning: you have ${fmtMinutes(status.month.late_minutes, false)} total lateness this month. Please be on time to avoid extra deductions.`
                  )}
                </div>
              )}

              {status?.shift?.start && (
                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-900 text-xs px-4 py-3 flex flex-col gap-1 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-100">
                  <span className="font-semibold text-sm">
                    {t('موعد الشفت اليومي', 'Daily shift time')}
                  </span>
                  <span>
                    {t('يبدأ عند:', 'Starts at:')} {fmtTime(status.shift.start, locale)} •{' '}
                    {t('سماحية التأخير:', 'Grace:')} {status.shift.grace_minutes ?? 0}{' '}
                    {t('دقيقة', 'min')}
                  </span>
                  <span className="text-[11px] opacity-90">
                    {t('غرامة كل 15 دقيقة تأخير:', 'Penalty per 15 min late:')}{' '}
                    {status.shift.penalty_per_15min ?? 0} {t('ج.م', 'EGP')}
                  </span>
                </div>
              )}

              <div className="mt-4 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 dark:bg-slate-800/60 dark:border-slate-700 dark:text-gray-300">
                {t(
                  'ملاحظة: النظام يحدد تلقائيًا ما إذا كنت في حالة حضور أو انصراف بناءً على آخر جلسة.',
                  'Note: the system automatically decides whether you are checking in or out based on your last session.'
                )}
              </div>
            </section>

            {/* Financial estimate */}
            <section className="grid gap-4 md:grid-cols-3 text-xs">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-gray-500 dark:text-gray-400">{t('قيمة اليوم الواحد', 'Daily rate')}</p>
                <p className="text-lg font-bold text-gray-900 mt-1 dark:text-gray-50">
                  {status?.month?.daily_rate?.toFixed?.(2) ?? '0.00'} {t('ج.م', 'EGP')}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                  {t('راتب يومي مباشر بدون قسمة على 30', 'Direct daily salary (no /30)')}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-gray-500 dark:text-gray-400">{t('قيمة أيام الحضور', 'Attendance value')}</p>
                <p className="text-lg font-bold text-gray-900 mt-1 dark:text-gray-50">
                  {status?.month?.attendance_value?.toFixed?.(2) ?? '0.00'} {t('ج.م', 'EGP')}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                  {t('عدد الأيام × قيمة اليوم', 'Days × daily rate')}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-gray-500 dark:text-gray-400">
                  {t('المتبقي المتوقّع حتى نهاية الشهر', 'Projected net until month end')}
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-1 dark:text-emerald-200">
                  {projectedNetSalary.toFixed(2)} {t('ج.م', 'EGP')}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                  {t(
                    'مع افتراض عدم وجود غياب أو جزاءات إضافية',
                    'Assuming no additional absences or penalties'
                  )}
                </p>
              </div>
            </section>

            {/* Personal QR */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    {t('QR الحضور والانصراف الخاص بك', 'Your attendance QR')}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                    {t(
                      'امسح الكود بأي كاميرا ليتم إنشاء رابط متغيّر لمرة واحدة يسجل حضورك أو انصرافك تلقائيًا.',
                      'Scan this code with any camera to generate a one-time link that auto-records your check-in or check-out.'
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {qrBase64 ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    <img
                      src={`data:image/png;base64,${qrBase64}`}
                      alt={t('QR الحضور', 'Attendance QR')}
                      className="w-40 h-40 rounded-2xl border border-gray-200 shadow-sm dark:border-slate-700"
                    />
                    <div className="text-[11px] text-gray-600 space-y-2 dark:text-gray-300">
                      <p>
                        {t(
                          'الكود يتجدد تلقائيًا عند فتح الصفحة ويولّد رابطًا لمرة واحدة فقط.',
                          'The QR is regenerated on page open and creates a single-use link only.'
                        )}
                      </p>
                      <p>
                        {t(
                          'عند الفتح سيتم طلب الموقع تلقائيًا لتسجيل العملية.',
                          'When opened, location permission will be requested automatically to record the action.'
                        )}
                      </p>
                      {qrSession?.action && (
                        <p className="font-semibold text-emerald-700 dark:text-emerald-200">
                          {qrSession.action === 'CHECKIN'
                            ? t('الرابط الحالي سيسجل حضور.', 'Current link will check in.')
                            : t('الرابط الحالي سيسجل انصراف.', 'Current link will check out.')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 border border-dashed border-gray-200 rounded-2xl px-3 py-3 dark:text-gray-400 dark:border-slate-700">
                    {qrLoading
                      ? t('جاري إنشاء QR جديد...', 'Generating a new QR...')
                      : t('لا يوجد QR متاح لهذا الحساب.', 'No QR is available for this account.')}
                  </div>
                )}
                {!qrLoading && qrError && (
                  <div className="mt-3 text-xs text-red-600 dark:text-red-300">
                    {qrError}
                  </div>
                )}
              </div>
            </section>
            {/* Action + Result */}
            <section className="grid gap-4 lg:grid-cols-2 items-start">              
              {/* Action */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {t('تسجيل حضور/انصراف', 'Check-in / Check-out')}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                  {t('سيتم طلب إذن الموقع تلقائيًا عند استخدام QR أو الرابط.', 'Location permission is requested automatically when you use the QR or link.')}
                </p>
                
                <div className="mt-4 w-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-[11px] text-gray-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-gray-200">
                  {t(
                    'تم إخفاء زر التسجيل المباشر. استخدم QR الحضور أو الرابط المولد لإتمام العملية بشكل آمن.',
                    'The manual record button is hidden. Use your attendance QR or generated link to complete the action securely.'
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="hidden"
                  aria-hidden
                  tabIndex={-1}
                >
                  {t('تسجيل الآن', 'Record now')}
                </button>

                {error && (
                  <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-3 py-2 dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                    {error}
                  </div>                  
                )}
              </div>

              {/* Result */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {t('نتيجة آخر عملية', 'Last operation result')}
                </p>

                {!processing && !error && !result && (
                  <div className="mt-3 bg-gray-50 border border-dashed border-gray-200 text-gray-500 text-xs rounded-2xl px-3 py-6 text-center dark:bg-slate-800/60 dark:border-slate-700 dark:text-gray-300">
                    {t('لم يتم تسجيل أي عملية بعد.', 'No operation recorded yet.')}
                  </div>
                )}

                {processing && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded-2xl px-3 py-2 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                    {t('جاري تسجيل الحضور/الانصراف...', 'Recording check-in/out...')}
                  </div>
                )}

                {result && (
                  <div
                    className={`mt-3 rounded-2xl px-3 py-3 text-xs border ${
                      isCheckin
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-100'
                        : isCheckout
                        ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-100'
                        : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-800/60 dark:border-slate-700 dark:text-gray-200'
                    }`}
                  >
                    <p className="font-semibold mb-1">{result.message || t('تمت العملية', 'Done')}</p>

                    <div className="mt-2 space-y-1 text-[11px] opacity-95">
                      {result.work_date && <p>{t('تاريخ اليوم:', 'Date:')} {result.work_date}</p>}
                      {result.check_in && <p>{t('وقت الدخول:', 'Check-in:')} {fmtDateTime(result.check_in, locale)}</p>}
                      {result.check_out && <p>{t('وقت الخروج:', 'Check-out:')} {fmtDateTime(result.check_out, locale)}</p>}

                      {typeof result.is_late !== 'undefined' && result.is_late && (
                        <p>
                          {t('متأخر:', 'Late:')} {result.late_minutes || 0} {t('دقيقة', 'min')} •{' '}
                          {t('غرامة:', 'Penalty:')} {result.penalty || 0} {t('ج.م', 'EGP')}
                        </p>
                      )}

                      {typeof result.duration_minutes !== 'undefined' && result.duration_minutes !== null && (
                        <p>{t('المدة بالدقائق:', 'Duration (min):')} {result.duration_minutes}</p>
                      )}

                      {result.location || result.gps ? (
                        <p>
                          {t('الموقع المسجل:', 'Recorded location:')}{' '}
                          {renderLocation(result.location || result.gps, isAr)}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-2 text-[11px] text-gray-700 dark:text-gray-200">
                      {isCheckin ? (
                        <div>{t('تم تسجيل دخولك. المرة القادمة سيتم تسجيل الانصراف تلقائيًا.', 'Checked in. Next time will be a check-out automatically.')}</div>
                      ) : isCheckout ? (
                        <div>{t('تم تسجيل انصرافك. المرة القادمة سيتم تسجيل الحضور تلقائيًا.', 'Checked out. Next time will be a check-in automatically.')}</div>
                      ) : null}

                      {result?.is_late && (
                        <div className="text-red-600 mt-2 dark:text-red-200">
                          {t('تنبيه: تم رصد تأخير في هذه العملية. الرجاء الالتزام بموعد الشفت.', 'Warning: lateness detected in this operation. Please adhere to shift time.')}
                        </div>
                      )}

                      {result?.usedCachedGps && (
                        <div className="text-amber-700 mt-2 dark:text-amber-200">
                          {t(
                            'تم استخدام آخر موقع محفوظ لعدم القدرة على تحديد موقع جديد. يرجى تفعيل الموقع لتسجيل موقعك الحالي.',
                            'Last saved location was used because a fresh location could not be obtained. Please enable location services.'
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Logs */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    {t('سجلات الحضور والانصراف', 'Attendance logs')}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                    {t('أحدث العمليات المسجلة تظهر هنا.', 'Your most recent recorded actions appear here.')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchMyLogs}
                  className="text-[11px] px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                >
                  {t('تحديث', 'Refresh')}
                </button>
              </div>

              {logsLoading && (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {t('جاري تحميل السجلات...', 'Loading logs...')}
                </div>
              )}

              {logsError && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-3 py-2 dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                  {logsError}
                </div>
              )}

              {!logsLoading && !logsError && logs.length === 0 && (
                <div className="mt-3 bg-gray-50 border border-dashed border-gray-200 text-gray-500 text-xs rounded-2xl px-3 py-6 text-center dark:bg-slate-800/60 dark:border-slate-700 dark:text-gray-300">
                  {t('لا توجد سجلات متاحة بعد.', 'No logs are available yet.')}
                </div>
              )}

              {!logsLoading && logs.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                        <th className="py-2 px-2 text-left font-semibold text-gray-700 dark:text-gray-200">{t('التاريخ', 'Date')}</th>
                        <th className="py-2 px-2 text-left font-semibold text-gray-700 dark:text-gray-200">{t('الدخول', 'Check-in')}</th>
                        <th className="py-2 px-2 text-left font-semibold text-gray-700 dark:text-gray-200">{t('الخروج', 'Check-out')}</th>
                        <th className="py-2 px-2 text-left font-semibold text-gray-700 dark:text-gray-200">{t('الموقع', 'Location')}</th>
                        <th className="py-2 px-2 text-left font-semibold text-gray-700 dark:text-gray-200">{t('الطريقة', 'Method')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70">
                          <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{fmtDateTime(log.work_date, locale)}</td>
                          <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{fmtDateTime(log.check_in, locale)}</td>
                          <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{fmtDateTime(log.check_out, locale)}</td>
                          <td className="py-2 px-2 whitespace-nowrap text-gray-700 dark:text-gray-200">
                            {renderLocation(log.location || log.gps, isAr)}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-gray-600 uppercase dark:text-gray-300">{log.method || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Refresh status hint */}
            <div className="text-[11px] text-gray-400 dark:text-gray-500">
              {t('سيتم تحديث ملخصك تلقائيًا بعد كل عملية.', 'Your summary refreshes automatically after each operation.')}
            </div>
          </div>          
        </main>
      </div>
    </div>
  );
}