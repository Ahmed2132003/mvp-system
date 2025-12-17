import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { notifyError, notifySuccess } from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';

// =====================
// Sidebar Navigation (Same style as Dashboard)
// =====================
function SidebarNav({ lang }) {
  const isAr = lang === 'ar';

  return (
    <>
      <Link
        to="/dashboard"
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
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
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'إدارة المخزون' : 'Inventory Management'}
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

      <Link
        to="/employees"
        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
      >
        <span>{isAr ? 'الموظفين' : 'Employees'}</span>
        <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
          {isAr ? 'الآن' : 'Now'}
        </span>
      </Link>

      <Link
        to="/accounting"
        className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
      >
        {isAr ? 'الحسابات' : 'Accounting'}
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

const tabs = [
  { key: 'info', labelAr: 'البيانات الأساسية', labelEn: 'Basic Info' },
  { key: 'attendance', labelAr: 'الحضور', labelEn: 'Attendance' },
  { key: 'payroll', labelAr: 'المرتبات', labelEn: 'Payroll' },
  { key: 'ledger', labelAr: 'الحركات المالية', labelEn: 'Ledger' },
];

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // theme & language (same pattern as Dashboard)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAr = lang === 'ar';

  const [activeTab, setActiveTab] = useState('info');
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState({ salary: '', advances: '', hire_date: '', store: null });
  const [stores, setStores] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManage = user?.is_superuser || ['OWNER', 'MANAGER'].includes(user?.role);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG'), [isAr]);

  // Apply theme to <html> + persist
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Apply language + direction to <html> + persist
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const fetchEmployee = useCallback(async () => {
    try {
      const res = await api.get(`/employees/${id}/`);
      setEmployee(res.data);
      setEditData({
        salary: res.data.salary ?? '',
        advances: res.data.advances ?? '',
        hire_date: res.data.hire_date ?? '',
        store: res.data.store ?? null,
      });
    } catch {
      notifyError(isAr ? 'فشل تحميل بيانات الموظف' : 'Failed to load employee data');
    }
  }, [id, isAr]);

  const fetchAttendance = useCallback(async () => {
    const res = await api.get(`/employees/${id}/attendance/`);
    setAttendance(res.data);
  }, [id]);

  const fetchPayrolls = useCallback(async () => {
    const res = await api.get(`/employees/${id}/payrolls/`);
    setPayrolls(res.data);
  }, [id]);

  const fetchLedger = useCallback(async () => {
    const res = await api.get(`/employees/${id}/ledger/`);
    setLedger(res.data);
  }, [id]);

  const fetchStores = useCallback(async () => {
    try {
      const res = await api.get('/stores/');
      setStores(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const generatePayroll = async () => {
    try {
      const month = prompt(isAr ? 'أدخل أول يوم في الشهر (YYYY-MM-DD)' : 'Enter first day of month (YYYY-MM-DD)');
      if (!month) return;

      await api.post(`/employees/${id}/generate_payroll/`, { month });
      notifySuccess(isAr ? 'تم احتساب المرتب' : 'Payroll generated');
      fetchPayrolls();
    } catch {
      notifyError(isAr ? 'فشل احتساب المرتب' : 'Failed to generate payroll');
    }
  };

  useEffect(() => {
    fetchEmployee().finally(() => setLoading(false));
    fetchStores();
  }, [fetchEmployee, fetchStores]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
    if (activeTab === 'payroll') fetchPayrolls();
    if (activeTab === 'ledger') fetchLedger();
  }, [activeTab, fetchAttendance, fetchPayrolls, fetchLedger]);

  const attendanceStats = useMemo(() => {
    const totalDays = attendance.length;
    const totalLate = attendance.reduce((acc, a) => acc + (a.late_minutes || 0), 0);
    const totalPenalties = attendance.reduce((acc, a) => acc + (a.penalty || 0), 0);
    const missingCheckouts = attendance.filter(a => !a.check_out).length;
    const latestPayroll = [...payrolls].sort((a, b) => new Date(b.month) - new Date(a.month))[0];
    const netSalary =
      latestPayroll?.net_salary ??
      Math.max((employee?.salary || 0) - totalPenalties - (employee?.advances || 0), 0);

    return { totalDays, totalLate, totalPenalties, missingCheckouts, netSalary };
  }, [attendance, payrolls, employee]);

  const updateEmployee = async () => {
    try {
      setSaving(true);
      await api.patch(`/employees/${id}/`, {
        salary: Number(editData.salary) || 0,
        advances: Number(editData.advances) || 0,
        hire_date: editData.hire_date || null,
        store: editData.store || null,
      });
      notifySuccess(isAr ? 'تم تحديث بيانات الموظف' : 'Employee updated');
      fetchEmployee();
    } catch (err) {
      console.error(err);
      notifyError(isAr ? 'تعذر تحديث بيانات الموظف' : 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const terminateEmployee = async () => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من فصل هذا الموظف؟' : 'Are you sure you want to terminate this employee?')) return;

    try {
      setDeleting(true);
      await api.delete(`/employees/${id}/`);
      notifySuccess(isAr ? 'تم فصل الموظف' : 'Employee terminated');
      navigate('/employees');
    } catch (err) {
      console.error(err);
      notifyError(isAr ? 'فشل فصل الموظف' : 'Failed to terminate employee');
    } finally {
      setDeleting(false);
    }
  };

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  const moneyLabel = isAr ? 'ج.م' : 'EGP';

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
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

        {/* Main content */}
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
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {isAr ? 'ملف الموظف' : 'Employee Profile'}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {isAr ? 'متابعة البيانات والحضور والمرتبات والحركات المالية' : 'View info, attendance, payroll, and ledger'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Language switcher */}
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

              <Link
                to="/employees"
                className="text-xs px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
              >
                {isAr ? '← الرجوع للموظفين' : '← Back to Employees'}
              </Link>
            </div>
          </header>

          {/* Content */}
          <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Loading / Not Found */}
            {loading && (
              <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-2xl dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-100">
                {isAr ? 'جاري تحميل بيانات الموظف...' : 'Loading employee data...'}
              </div>
            )}

            {!loading && !employee && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
                {isAr ? 'الموظف غير موجود' : 'Employee not found'}
              </div>
            )}

            {!loading && employee && (
              <>
                {/* Header Card */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-base font-bold">
                        {employee.user?.name?.[0]?.toUpperCase() || employee.user?.email?.[0]?.toUpperCase() || 'E'}
                      </div>
                      <div>
                        <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50">
                          {employee.user?.name}
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{employee.user?.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        {isAr ? 'الفرع:' : 'Branch:'} {employee.store_name || (isAr ? '—' : '—')}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-200">
                        {isAr ? 'ID:' : 'ID:'} {id}
                      </span>
                    </div>
                  </div>
                </section>

                {/* KPI Summary */}
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? 'أيام الحضور' : 'Attendance Days'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.totalDays)}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? 'سجلات بدون انصراف' : 'Missing Check-outs'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.missingCheckouts)}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? 'إجمالي التأخير (دقيقة)' : 'Total Late (min)'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.totalLate)}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? 'إجمالي الجزاءات' : 'Total Penalties'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.totalPenalties)} {moneyLabel}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isAr ? 'المرتب المستحق' : 'Net Due Salary'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.netSalary)} {moneyLabel}
                    </p>
                  </div>
                </section>

                {/* Tabs */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex flex-wrap gap-2 border-b border-gray-100 p-3 dark:border-slate-800">
                    {tabs.map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 text-sm rounded-xl transition ${
                          activeTab === tab.key
                            ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-900/40 dark:text-blue-200'
                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isAr ? tab.labelAr : tab.labelEn}
                      </button>
                    ))}
                  </div>

                  <div className="p-4 md:p-5">
                    {/* INFO */}
                    {activeTab === 'info' && (
                      <div className="space-y-6">
                        <div className="grid gap-4 lg:grid-cols-3">
                          <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4 dark:bg-slate-800/60 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                              {isAr ? 'البيانات' : 'Details'}
                            </h3>
                            <div className="space-y-2 text-sm">
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الاسم:' : 'Name:'}</b>{' '}
                                {employee.user?.name}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الإيميل:' : 'Email:'}</b>{' '}
                                {employee.user?.email}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الهاتف:' : 'Phone:'}</b>{' '}
                                {employee.user?.phone || '—'}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الفرع:' : 'Branch:'}</b>{' '}
                                {employee.store_name || '—'}
                              </p>
                            </div>
                          </div>

                          <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4 dark:bg-slate-800/60 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                              {isAr ? 'الماليات' : 'Financial'}
                            </h3>
                            <div className="space-y-2 text-sm">
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الراتب:' : 'Salary:'}</b>{' '}
                                {numberFormatter.format(employee.salary || 0)} {moneyLabel}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'السلف:' : 'Advances:'}</b>{' '}
                                {numberFormatter.format(employee.advances || 0)} {moneyLabel}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'تاريخ التعيين:' : 'Hire date:'}</b>{' '}
                                {employee.hire_date || '—'}
                              </p>
                            </div>
                          </div>

                          {employee.qr_code_attendance_base64 ? (
                            <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4 text-center dark:bg-slate-800/60 dark:border-slate-700">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
                                {isAr ? 'QR الحضور والانصراف' : 'Attendance QR'}
                              </h3>
                              <img
                                src={`data:image/png;base64,${employee.qr_code_attendance_base64}`}
                                className="mx-auto w-40 border rounded-2xl dark:border-slate-700"
                                alt="QR Attendance"
                              />
                              <p className="text-xs text-gray-500 mt-3 dark:text-gray-400">
                                {isAr ? 'يُستخدم لتسجيل الدخول والانصراف' : 'Used for check-in and check-out'}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4 dark:bg-slate-800/60 dark:border-slate-700">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">
                                {isAr ? 'QR الحضور والانصراف' : 'Attendance QR'}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {isAr ? 'غير متوفر لهذا الموظف.' : 'Not available for this employee.'}
                              </p>
                            </div>
                          )}
                        </div>

                        {canManage && (
                          <div className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                                  {isAr ? 'تعديل بيانات الموظف' : 'Edit Employee'}
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                                  {isAr ? 'تحديث الراتب والسلف والفرع وتاريخ التعيين' : 'Update salary, advances, branch, and hire date'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">
                                  {isAr ? 'الراتب الشهري' : 'Monthly Salary'}
                                </span>
                                <input
                                  type="number"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.salary}
                                  onChange={(e) => setEditData({ ...editData, salary: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">
                                  {isAr ? 'السلف المتراكمة' : 'Total Advances'}
                                </span>
                                <input
                                  type="number"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.advances}
                                  onChange={(e) => setEditData({ ...editData, advances: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">
                                  {isAr ? 'تاريخ التعيين' : 'Hire Date'}
                                </span>
                                <input
                                  type="date"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.hire_date || ''}
                                  onChange={(e) => setEditData({ ...editData, hire_date: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">
                                  {isAr ? 'الفرع' : 'Branch'}
                                </span>
                                <select
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.store || ''}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      store: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                >
                                  <option value="">{isAr ? 'اختر الفرع' : 'Select branch'}</option>
                                  {stores.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="mt-4 flex gap-3 flex-wrap">
                              <button
                                onClick={updateEmployee}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                              >
                                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save changes')}
                              </button>

                              <button
                                onClick={terminateEmployee}
                                disabled={deleting}
                                className="px-4 py-2 rounded-xl border border-red-500 text-red-600 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-60 dark:hover:bg-red-900/20"
                              >
                                {deleting ? (isAr ? 'جاري الفصل...' : 'Terminating...') : (isAr ? 'فصل الموظف' : 'Terminate')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ATTENDANCE */}
                    {activeTab === 'attendance' && (
                      <>
                        {attendance.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isAr ? 'لا توجد سجلات حضور حتى الآن.' : 'No attendance records yet.'}
                          </p>
                        ) : (
                          <>
                            {/* Mobile cards */}
                            <div className="space-y-2 md:hidden">
                              {attendance.map((a, i) => (
                                <div
                                  key={i}
                                  className="border border-gray-100 rounded-2xl p-3 bg-gray-50/60 flex flex-col gap-1 dark:bg-slate-800/70 dark:border-slate-700"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                                      {isAr ? `سجل #${i + 1}` : `Record #${i + 1}`}
                                    </span>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      {isAr ? 'المدة' : 'Duration'}: {a.duration || 0}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                                    <span>{isAr ? 'الدخول' : 'In'}: {a.check_in || '—'}</span>
                                    <span>{isAr ? 'الخروج' : 'Out'}: {a.check_out || '—'}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                                    <span>{isAr ? 'تأخير' : 'Late'}: {a.late_minutes || 0}</span>
                                    <span>
                                      {isAr ? 'غرامة' : 'Penalty'}: {numberFormatter.format(a.penalty || 0)} {moneyLabel}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Desktop/tablet table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'الدخول' : 'Check-in'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'الخروج' : 'Check-out'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'تأخير' : 'Late'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'غرامة' : 'Penalty'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'المدة' : 'Duration'}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {attendance.map((a, i) => (
                                    <tr
                                      key={i}
                                      className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                                    >
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                        {a.check_in || '—'}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                        {a.check_out || '—'}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {a.late_minutes || 0}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {numberFormatter.format(a.penalty || 0)} {moneyLabel}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {a.duration || 0}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* PAYROLL */}
                    {activeTab === 'payroll' && (
                      <div className="space-y-4">
                        {canManage && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={generatePayroll}
                              className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                            >
                              {isAr ? 'احتساب مرتب جديد' : 'Generate New Payroll'}
                            </button>
                          </div>
                        )}

                        {payrolls.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isAr ? 'لا توجد مرتبات حتى الآن.' : 'No payroll records yet.'}
                          </p>
                        ) : (
                          <>
                            {/* Mobile cards */}
                            <div className="space-y-2 md:hidden">
                              {payrolls.map((p) => (
                                <div
                                  key={p.id}
                                  className="border border-gray-100 rounded-2xl p-3 bg-gray-50/60 dark:bg-slate-800/70 dark:border-slate-700"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                                      {isAr ? 'الشهر' : 'Month'}: {p.month}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                                      {p.is_locked ? (isAr ? 'مغلق 🔒' : 'Locked 🔒') : (isAr ? 'مفتوح' : 'Open')}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                                    <div>{isAr ? 'الأساسي' : 'Base'}: {numberFormatter.format(p.base_salary || 0)}</div>
                                    <div>{isAr ? 'الخصومات' : 'Penalties'}: {numberFormatter.format(p.penalties || 0)}</div>
                                    <div className="col-span-2 font-semibold text-gray-800 dark:text-gray-100">
                                      {isAr ? 'الصافي' : 'Net'}: {numberFormatter.format(p.net_salary || 0)} {moneyLabel}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Desktop/tablet table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'الشهر' : 'Month'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'الأساسي' : 'Base'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'الخصومات' : 'Penalties'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'الصافي' : 'Net'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'الحالة' : 'Status'}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payrolls.map((p) => (
                                    <tr
                                      key={p.id}
                                      className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                                    >
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                        {p.month}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {numberFormatter.format(p.base_salary || 0)}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {numberFormatter.format(p.penalties || 0)}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                        {numberFormatter.format(p.net_salary || 0)} {moneyLabel}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                                          {p.is_locked ? (isAr ? 'مغلق 🔒' : 'Locked 🔒') : (isAr ? 'مفتوح' : 'Open')}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* LEDGER */}
                    {activeTab === 'ledger' && (
                      <>
                        {ledger.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isAr ? 'لا توجد حركات مالية حتى الآن.' : 'No ledger entries yet.'}
                          </p>
                        ) : (
                          <>
                            {/* Mobile cards */}
                            <div className="space-y-2 md:hidden">
                              {ledger.map((l, i) => (
                                <div
                                  key={i}
                                  className="border border-gray-100 rounded-2xl p-3 bg-gray-50/60 dark:bg-slate-800/70 dark:border-slate-700"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                                      {isAr ? 'النوع' : 'Type'}: {l.type}
                                    </span>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      {new Date(l.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-EG')}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">
                                    {isAr ? 'الوصف' : 'Description'}: {l.description || '—'}
                                  </div>
                                  <div className="mt-2 font-semibold text-gray-800 dark:text-gray-100 text-sm">
                                    {numberFormatter.format(l.amount || 0)} {moneyLabel}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Desktop/tablet table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'النوع' : 'Type'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'القيمة' : 'Amount'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'الوصف' : 'Description'}
                                    </th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">
                                      {isAr ? 'التاريخ' : 'Date'}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ledger.map((l, i) => (
                                    <tr
                                      key={i}
                                      className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                                    >
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                        {l.type}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                        {numberFormatter.format(l.amount || 0)} {moneyLabel}
                                      </td>
                                      <td className="py-2 px-2 text-gray-600 dark:text-gray-300">
                                        {l.description || '—'}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {new Date(l.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-EG')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
