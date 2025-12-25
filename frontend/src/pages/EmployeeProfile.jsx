import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { notifyError, notifySuccess } from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';

// =====================
// Sidebar Navigation (Same style as Dashboard)
// =====================
function SidebarNav({ lang }) {
  const { user } = useAuth();
  const isAr = lang === 'ar';
  const canManageNav = user?.is_superuser || ['OWNER', 'MANAGER'].includes(user?.role);

  return (
    <>
      {canManageNav && (
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
        </>
      )}

      {!canManageNav && (
        <>
          <Link
            to="/dashboard"
            className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
          >
            {isAr ? 'الداشبورد' : 'Dashboard'}
          </Link>
          <Link
            to="/employees/me"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
          >
            <span>{isAr ? 'ملفي' : 'My Profile'}</span>
            <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-800/70">
              {isAr ? 'الآن' : 'Now'}
            </span>
          </Link>
        </>
      )}
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
  const initialEmployeeId = id && id !== 'me' ? id : null;

  // theme & language (same pattern as Dashboard)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAr = lang === 'ar';

  const [activeTab, setActiveTab] = useState('info');
  const [employee, setEmployee] = useState(null);
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);  
  const [attendance, setAttendance] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [ledger, setLedger] = useState([]);  
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState({
    salary: '',
    advances: '',
    hire_date: '',
    store: null,
    branch: null,
    user_name: '',
    user_email: '',
    user_phone: '',
  });  
  const [stores, setStores] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [ledgerForm, setLedgerForm] = useState({
    entry_type: 'BONUS',
    amount: '',
    description: '',
    payout_date: '',
  });
  const [ledgerSaving, setLedgerSaving] = useState(false);
  const [markingPayrollId, setMarkingPayrollId] = useState(null);
  const [payrollEdit, setPayrollEdit] = useState({
    id: null,
    base_salary: '',
    penalties: '',
    bonuses: '',
    advances: '',
  });
  const [deletingPayrollId, setDeletingPayrollId] = useState(null);

  const canManage = user?.is_superuser || ['OWNER', 'MANAGER'].includes(user?.role);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG'), [isAr]);

  useEffect(() => {
    setEmployeeId(id && id !== 'me' ? id : null);    
  }, [id]);

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
      const resolvedId = employeeId || id || 'me';      
      const endpoint = resolvedId === 'me' ? '/employees/me/' : `/employees/${resolvedId}/`;
      
      const res = await api.get(endpoint);
      setEmployee(res.data);
      if (res.data?.id) {
        setEmployeeId(res.data.id);
      }

      setEditData({
        salary: res.data.salary ?? '',
        advances: res.data.advances ?? '',
        hire_date: res.data.hire_date ?? '',
        store: res.data.store ?? null,
        branch: res.data.branch ?? null,
        user_name: res.data.user?.name ?? '',
        user_email: res.data.user?.email ?? '',
        user_phone: res.data.user?.phone ?? '',
      });
    } catch {
      notifyError(isAr ? 'فشل تحميل بيانات الموظف' : 'Failed to load employee data');
    }
  }, [id, employeeId, isAr]);

  const fetchAttendance = useCallback(async () => {
    if (!employeeId) return;
    const res = await api.get(`/employees/${employeeId}/attendance/`, {
      params: { month: selectedMonth },
    });
    setAttendance(res.data);
  }, [employeeId, selectedMonth]);

  const fetchPayrolls = useCallback(async () => {
    if (!employeeId) return;
    const res = await api.get(`/employees/${employeeId}/payrolls/`);
    setPayrolls(res.data);
  }, [employeeId]);

  const fetchLedger = useCallback(async () => {
    if (!employeeId) return;
    const res = await api.get(`/employees/${employeeId}/ledger/`, {
      params: { month: selectedMonth },
    });
    setLedger(res.data);
  }, [employeeId, selectedMonth]);

  const fetchStores = useCallback(async () => {
    try {
      const res = await api.get('/stores/');
      setStores(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchBranches = useCallback(async (storeId) => {
    if (!storeId) {
      setBranches([]);
      setEditData((prev) => ({ ...prev, branch: null }));
      return;
    }

    try {
      setBranchesLoading(true);
      const res = await api.get('/branches/', { params: { store_id: storeId } });
      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setBranches(results);

      setEditData((prev) => {
        if (prev.branch && results.some((b) => b.id === prev.branch)) {
          return prev;
        }
        return { ...prev, branch: results[0]?.id || null };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  const generatePayroll = async () => {
        const targetId = employeeId || id;
    if (!targetId || targetId === 'me') {
      notifyError(isAr ? 'لم يتم تحميل بيانات الموظف بعد' : 'Employee data not loaded yet');
      return;
    }
    try {
      const month = prompt(isAr ? 'أدخل أول يوم في الشهر (YYYY-MM-DD)' : 'Enter first day of month (YYYY-MM-DD)');
      if (!month) return;

      await api.post(`/employees/${targetId}/generate_payroll/`, { month });      
      notifySuccess(isAr ? 'تم احتساب المرتب' : 'Payroll generated');
      fetchPayrolls();
    } catch {
      notifyError(isAr ? 'فشل احتساب المرتب' : 'Failed to generate payroll');
    }
  };

  const markPayrollPaid = async (payrollId) => {
    if (!employeeId) return;
    try {
      setMarkingPayrollId(payrollId);
      await api.post(`/employees/${employeeId}/mark_paid/`, { payroll_id: payrollId });      
      notifySuccess(isAr ? 'تم تعليم المرتب كمدفوع' : 'Marked payroll as paid');
      fetchPayrolls();
      fetchLedger();
    } catch {
      notifyError(isAr ? 'تعذر تعليم المرتب كمدفوع' : 'Failed to mark payroll as paid');
    } finally {
      setMarkingPayrollId(null);
    }
  };

  const startEditPayroll = (payroll) => {
    setPayrollEdit({
      id: payroll.id,
      base_salary: payroll.base_salary ?? '',
      monthly_salary: payroll.monthly_salary ? Number(payroll.monthly_salary) / 30 : payroll.base_salary ?? '',
      penalties: payroll.penalties ?? '',
      bonuses: payroll.bonuses ?? '',
      advances: payroll.advances ?? '',
    });
  };

  const savePayrollEdit = async () => {
    if (!payrollEdit.id || !employeeId) return;
    if (Number(payrollEdit.monthly_salary) <= 0) {
      notifyError(isAr ? 'الراتب اليومي يجب أن يكون أكبر من صفر.' : 'Daily salary must be greater than zero.');
      return;
    }    
    try {
      setSaving(true);
      await api.patch(`/employees/${employeeId}/update_payroll/`, {
        payroll_id: payrollEdit.id,
        base_salary: Number(payrollEdit.base_salary) || 0,
        monthly_salary: Number(payrollEdit.monthly_salary) || 0,
        penalties: Number(payrollEdit.penalties) || 0,
        bonuses: Number(payrollEdit.bonuses) || 0,
        advances: Number(payrollEdit.advances) || 0,
      });
      notifySuccess(isAr ? 'تم تعديل كشف المرتب' : 'Payroll updated');
      setPayrollEdit({ id: null, base_salary: '', monthly_salary: '', penalties: '', bonuses: '', advances: '' });
      fetchPayrolls();
      fetchLedger();
    } catch (err) {
      console.error(err);
      notifyError(isAr ? 'تعذر تعديل كشف المرتب' : 'Failed to update payroll');
    } finally {
      setSaving(false);
    }
  };

  const deletePayroll = async (payrollId) => {
    if (!employeeId || !payrollId) return;
    if (!window.confirm(isAr ? 'سيتم حذف كشف المرتب، هل أنت متأكد؟' : 'Delete this payroll?')) return;
    try {
      setDeletingPayrollId(payrollId);
      await api.post(`/employees/${employeeId}/delete_payroll/`, { payroll_id: payrollId });
      notifySuccess(isAr ? 'تم حذف كشف المرتب' : 'Payroll deleted');
      fetchPayrolls();
      fetchLedger();
    } catch (err) {
      console.error(err);
      notifyError(isAr ? 'تعذر حذف كشف المرتب' : 'Failed to delete payroll');
    } finally {
      setDeletingPayrollId(null);
    }
  };

  const addLedgerEntry = async () => {
    if (!employeeId) return;
    if (!ledgerForm.amount) {
      notifyError(isAr ? 'من فضلك أدخل قيمة صحيحة' : 'Please enter a valid amount');
      return;      
    }
    try {
      setLedgerSaving(true);
      await api.post(`/employees/${employeeId}/ledger_entry/`, {
        ...ledgerForm,
      });
      notifySuccess(isAr ? 'تم تسجيل الحركة' : 'Entry added');
      setLedgerForm({ entry_type: 'BONUS', amount: '', description: '', payout_date: '' });
      fetchLedger();
      fetchPayrolls();
    } catch (err) {
      console.error(err);
      notifyError(isAr ? 'تعذر حفظ الحركة' : 'Failed to save entry');
    } finally {
      setLedgerSaving(false);
    }
  };

  useEffect(() => {
    fetchEmployee().finally(() => setLoading(false));
    fetchStores();
  }, [fetchEmployee, fetchStores]);

  useEffect(() => {
    fetchAttendance();
    fetchLedger();
    fetchPayrolls();
  }, [fetchAttendance, fetchLedger, fetchPayrolls]);

  useEffect(() => {
    fetchBranches(editData.store);
  }, [editData.store, fetchBranches]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
    if (activeTab === 'payroll') fetchPayrolls();
    if (activeTab === 'ledger') fetchLedger();
  }, [activeTab, fetchAttendance, fetchPayrolls, fetchLedger]);

  const ledgerTotals = useMemo(() => {
    return ledger.reduce(
      (acc, entry) => {
        if (entry.type === 'BONUS') acc.bonus += Number(entry.amount || 0);
        if (entry.type === 'PENALTY') acc.penalty += Number(entry.amount || 0);
        if (entry.type === 'ADVANCE') {
          acc.advance += Number(entry.amount || 0);
        }
        return acc;
      },
      { bonus: 0, penalty: 0, advance: 0 }
    );
  }, [ledger]);

  const attendanceStats = useMemo(() => {
    const totalDays = new Set(
      attendance.map(a => a.work_date || (a.check_in ? String(a.check_in).slice(0, 10) : ''))
    ).size;
    const totalLate = attendance.reduce((acc, a) => acc + (a.late_minutes || 0), 0);
    const totalPenalties = attendance.reduce((acc, a) => acc + (a.penalty || 0), 0);
    const missingCheckouts = attendance.filter((a) => !a.check_out).length;
    const latestPayroll = [...payrolls].sort((a, b) => new Date(b.month) - new Date(a.month))[0];
    const currentPayroll = payrolls.find((p) => (p.month || '').startsWith(selectedMonth));
    const targetPayroll = currentPayroll || latestPayroll;

    const dailySalarySnapshot = Number(targetPayroll?.monthly_salary ?? 0) / 30;
    const dailySalary = dailySalarySnapshot || Number(employee?.salary ?? 0);
    const monthlySalary = dailySalary * 30;

    // ✅ Always prioritize live attendance; fall back to payroll snapshot only if nothing is logged
    const attendanceDays = totalDays || Number(targetPayroll?.attendance_days ?? 0);

    const attendanceValue = attendanceDays * dailySalary;

    // ✅ اجمالي الخصومات/السلف/الحوافز: خليك consistent مع شهر الشاشة الحالي
    const penaltiesTotal = Number(ledgerTotals.penalty ?? targetPayroll?.penalties ?? 0);
    const bonusesTotal = Number(ledgerTotals.bonus ?? targetPayroll?.bonuses ?? 0);
    const advancesTotal = Number(ledgerTotals.advance ?? employee?.advances ?? targetPayroll?.advances ?? 0);
    const attendancePenalties = totalPenalties || 0;
    const deductionsTotal = penaltiesTotal + advancesTotal + attendancePenalties;

    // ✅ الراتب الأساسي = قيمة الحضور + الحوافز
    const baseWithBonuses = attendanceValue + bonusesTotal;

    // ✅ أساسي مستحق = (الحضور × اليومي + الحوافز) - (الخصومات + الجزاءات + السلف)
    const computedNet = baseWithBonuses - deductionsTotal;
    const netSalary = targetPayroll?.is_paid ? Number(targetPayroll.net_salary ?? 0) : computedNet;

    return {
      totalDays,
      totalLate,
      totalPenalties,
      missingCheckouts,
      netSalary,
      monthlySalary,
      dailySalary,
      attendanceDays,
      attendanceValue,
      baseWithBonuses,
      deductionsTotal,
    };
  }, [attendance, payrolls, employee, selectedMonth, ledgerTotals]);    
  const updateEmployee = async () => {
        const targetId = employeeId || id;
    if (!targetId || targetId === 'me') {
      notifyError(isAr ? 'لم يتم تحميل بيانات الموظف بعد' : 'Employee data not loaded yet');
      return;
    }
    if (attendanceStats.totalDays > 0 && Number(editData.salary || 0) <= 0) {
      notifyError(isAr ? 'حدد راتباً أساسياً قبل حفظ البيانات.' : 'Please set a base salary before saving.');
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/employees/${targetId}/`, {        
        salary: Number(editData.salary) || 0,
        advances: Number(editData.advances) || 0,
        hire_date: editData.hire_date || null,
        store: editData.store || null,
        branch: editData.branch || null,
        user_name: editData.user_name || '',
        user_email: editData.user_email || undefined,
        user_phone: editData.user_phone || '',
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
    const targetId = employeeId || id;
    if (!targetId || targetId === 'me') {
      notifyError(isAr ? 'لم يتم تحميل بيانات الموظف بعد' : 'Employee data not loaded yet');
      return;
    }
    if (!window.confirm(isAr ? 'هل أنت متأكد من فصل هذا الموظف؟' : 'Are you sure you want to terminate this employee?'))
      return;

    try {
      setDeleting(true);
      await api.delete(`/employees/${targetId}/`);      
      notifySuccess(isAr ? 'تم فصل الموظف' : 'Employee terminated');
      navigate('/employees');
    } catch (err) {
      console.error(err);
      notifyError(isAr ? 'فشل فصل الموظف' : 'Failed to terminate employee');
    } finally {
      setDeleting(false);
    }
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
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
                  <p className="text-[11px] text-gray-500 mt-0.5 dark:text-gray-400">{isAr ? 'القائمة الرئيسية' : 'Main Menu'}</p>
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
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">{isAr ? 'ملف الموظف' : 'Employee Profile'}</h2>
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
                  className={`px-2 py-1 ${!isAr ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`px-2 py-1 ${isAr ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'}`}
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
                        <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50">{employee.user?.name}</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{employee.user?.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        {isAr ? 'الفرع:' : 'Branch:'} {employee.store_name || '—'}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-200">
                        {isAr ? 'ID:' : 'ID:'} {id}
                      </span>
                    </div>
                  </div>
                </section>

                {/* KPI Summary */}
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'أيام الحضور' : 'Attendance Days'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{numberFormatter.format(attendanceStats.totalDays)}</p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'الحضور المحتسب' : 'Counted attendance'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{numberFormatter.format(attendanceStats.attendanceDays)}</p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'سجلات بدون انصراف' : 'Missing Check-outs'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{numberFormatter.format(attendanceStats.missingCheckouts)}</p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'إجمالي التأخير (دقيقة)' : 'Total Late (min)'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{numberFormatter.format(attendanceStats.totalLate)}</p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'إجمالي الجزاءات' : 'Total Penalties'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.totalPenalties)} {moneyLabel}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'الراتب اليومي' : 'Daily salary'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.dailySalary || 0)} {moneyLabel}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isAr ? 'الأساس الشهري = اليومي × 30' : 'Monthly base = daily × 30'} (
                      {numberFormatter.format(attendanceStats.monthlySalary || 0)} {moneyLabel})
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'أساسي (حضور + حوافز)' : 'Base (attendance + bonuses)'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.baseWithBonuses || 0)} {moneyLabel}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'أساسي مستحق (بعد الخصومات)' : 'Net due after deductions'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.netSalary)} {moneyLabel}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'إجمالي الحوافز (الشهر)' : 'Monthly Bonuses'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(ledgerTotals.bonus)} {moneyLabel}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 dark:bg-slate-900 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'إجمالي الخصومات (الشهر)' : 'Monthly Deductions'}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                      {numberFormatter.format(attendanceStats.deductionsTotal)} {moneyLabel}                      
                    </p>
                  </div>
                </section>

                {/* Tabs */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex flex-wrap gap-2 border-b border-gray-100 p-3 dark:border-slate-800">
                    {tabs.map((tab) => (
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
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">{isAr ? 'البيانات' : 'Details'}</h3>
                            <div className="space-y-2 text-sm">
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الاسم:' : 'Name:'}</b> {employee.user?.name}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الإيميل:' : 'Email:'}</b> {employee.user?.email}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الهاتف:' : 'Phone:'}</b> {employee.user?.phone || '—'}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الفرع:' : 'Branch:'}</b> {employee.store_name || '—'}
                              </p>
                            </div>
                          </div>

                          {/* ✅ FIXED: Financial card closing tags */}
                          <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4 dark:bg-slate-800/60 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">{isAr ? 'الماليات' : 'Financial'}</h3>
                            <div className="space-y-2 text-sm">
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'الراتب اليومي:' : 'Daily salary:'}</b> {numberFormatter.format(employee.salary || 0)}{' '}
                                {moneyLabel}
                              </p>                              
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'السلف:' : 'Advances:'}</b> {numberFormatter.format(employee.advances || 0)}{' '}
                                {moneyLabel}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'حوافز الشهر:' : 'Monthly bonuses:'}</b>{' '}
                                {numberFormatter.format(ledgerTotals.bonus)} {moneyLabel}
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'خصومات الشهر (جزاءات + سلف):' : 'Monthly deductions (penalties + advances):'}</b>{' '}
                                {numberFormatter.format(attendanceStats.deductionsTotal)} {moneyLabel}                                
                              </p>
                              <p className="text-gray-700 dark:text-gray-200">
                                <b className="text-gray-900 dark:text-gray-50">{isAr ? 'تاريخ التعيين:' : 'Hire date:'}</b> {employee.hire_date || '—'}
                              </p>
                            </div>
                          </div>

                          {employee.qr_code_attendance_base64 ? (
                            <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4 text-center dark:bg-slate-800/60 dark:border-slate-700">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">{isAr ? 'QR الحضور والانصراف' : 'Attendance QR'}</h3>
                              <img
                                src={`data:image/png;base64,${employee.qr_code_attendance_base64}`}
                                className="mx-auto w-40 border rounded-2xl dark:border-slate-700"
                                alt="QR Attendance"
                              />
                              <p className="text-xs text-gray-500 mt-3 dark:text-gray-400">{isAr ? 'يُستخدم لتسجيل الدخول والانصراف' : 'Used for check-in and check-out'}</p>
                            </div>
                          ) : (
                            <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4 dark:bg-slate-800/60 dark:border-slate-700">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">{isAr ? 'QR الحضور والانصراف' : 'Attendance QR'}</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? 'غير متوفر لهذا الموظف.' : 'Not available for this employee.'}</p>
                            </div>
                          )}
                        </div>

                        {canManage && (
                          <div className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5 dark:bg-slate-900 dark:border-slate-800">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{isAr ? 'تعديل بيانات الموظف' : 'Edit Employee'}</h3>
                                <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
                                  {isAr ? 'تحديث الراتب والسلف والفرع وتاريخ التعيين' : 'Update salary, advances, branch, and hire date'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'اسم الموظف' : 'Employee name'}</span>
                                <input
                                  type="text"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.user_name}
                                  onChange={(e) => setEditData({ ...editData, user_name: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
                                <input
                                  type="email"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.user_email}
                                  onChange={(e) => setEditData({ ...editData, user_email: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'رقم الهاتف' : 'Phone'}</span>
                                <input
                                  type="tel"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.user_phone}
                                  onChange={(e) => setEditData({ ...editData, user_phone: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'الراتب اليومي' : 'Daily Salary'}</span>                                
                                <input
                                  type="number"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"                                  
                                  value={editData.salary}
                                  onChange={(e) => setEditData({ ...editData, salary: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'السلف المتراكمة' : 'Total Advances'}</span>
                                <input
                                  type="number"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.advances}
                                  onChange={(e) => setEditData({ ...editData, advances: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'تاريخ التعيين' : 'Hire Date'}</span>
                                <input
                                  type="date"
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.hire_date || ''}
                                  onChange={(e) => setEditData({ ...editData, hire_date: e.target.value })}
                                />
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'المتجر' : 'Store'}</span>
                                <select
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.store || ''}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      store: e.target.value ? Number(e.target.value) : null,
                                      branch: null,
                                    })
                                  }
                                >
                                  <option value="">{isAr ? 'اختر المتجر' : 'Select store'}</option>
                                  {stores.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="space-y-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'الفرع' : 'Branch'}</span>
                                <select
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  value={editData.branch || ''}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      branch: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                  disabled={!editData.store || branchesLoading}
                                >
                                  <option value="">{isAr ? 'اختر الفرع' : 'Select branch'}</option>
                                  {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                      {branch.name}
                                    </option>
                                  ))}
                                </select>
                                {branchesLoading && <p className="text-[11px] text-gray-500 mt-1">{isAr ? 'جاري تحميل الفروع...' : 'Loading branches...'}</p>}
                                {!branchesLoading && editData.store && branches.length === 0 && (
                                  <p className="text-[11px] text-red-600 mt-1 dark:text-red-300">
                                    {isAr ? 'لا توجد فروع مرتبطة بهذا المتجر.' : 'No branches found for this store.'}
                                  </p>
                                )}
                              </label>
                            </div>

                            <div className="mt-4 flex gap-3 flex-wrap">
                              <button
                                onClick={updateEmployee}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                              >
                                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ التعديلات' : 'Save changes'}
                              </button>

                              <button
                                onClick={terminateEmployee}
                                disabled={deleting}
                                className="px-4 py-2 rounded-xl border border-red-500 text-red-600 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-60 dark:hover:bg-red-900/20"
                              >
                                {deleting ? (isAr ? 'جاري الفصل...' : 'Terminating...') : isAr ? 'فصل الموظف' : 'Terminate'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ATTENDANCE */}
                    {activeTab === 'attendance' && (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isAr
                              ? 'تعرض البيانات للشهر المحدد، يتم إعادة التعيين تلقائياً في أول كل شهر.'
                              : 'Showing data for the selected month. View resets automatically on the 1st of each month.'}
                          </p>
                          <label className="text-xs flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span>{isAr ? 'اختر الشهر' : 'Select month'}</span>
                            <input
                              type="month"
                              value={selectedMonth}
                              onChange={(e) => setSelectedMonth(e.target.value)}
                              className="rounded-xl border border-gray-200 px-2 py-1 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                            />
                          </label>
                        </div>
                        {attendance.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? 'لا توجد سجلات حضور حتى الآن.' : 'No attendance records yet.'}</p>
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
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{isAr ? `سجل #${i + 1}` : `Record #${i + 1}`}</span>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{isAr ? 'المدة' : 'Duration'}: {a.duration || 0}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                                    <span>{isAr ? 'الدخول' : 'In'}: {a.check_in || '—'}</span>
                                    <span>{isAr ? 'الخروج' : 'Out'}: {a.check_out || '—'}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                                    <span>{isAr ? 'تأخير' : 'Late'}: {a.late_minutes || 0}</span>
                                    <span>{isAr ? 'غرامة' : 'Penalty'}: {numberFormatter.format(a.penalty || 0)} {moneyLabel}</span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Desktop/tablet table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الدخول' : 'Check-in'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الخروج' : 'Check-out'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'تأخير' : 'Late'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'غرامة' : 'Penalty'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'المدة' : 'Duration'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {attendance.map((a, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70">
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{a.check_in || '—'}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{a.check_out || '—'}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{a.late_minutes || 0}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{numberFormatter.format(a.penalty || 0)} {moneyLabel}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{a.duration || 0}</td>
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
                            <button onClick={generatePayroll} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                              {isAr ? 'احتساب مرتب جديد' : 'Generate New Payroll'}
                            </button>
                            <button
                              onClick={() => {
                                setActiveTab('ledger');
                                setLedgerForm((prev) => ({ ...prev, entry_type: 'BONUS' }));
                              }}
                              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
                            >
                              {isAr ? 'إضافة حافز/مكافأة' : 'Add bonus'}
                            </button>
                            <button
                              onClick={() => {
                                setActiveTab('ledger');
                                setLedgerForm((prev) => ({ ...prev, entry_type: 'PENALTY' }));
                              }}
                              className="px-3 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition"
                            >
                              {isAr ? 'إضافة خصم' : 'Add deduction'}
                            </button>
                            <button
                              onClick={() => setActiveTab('info')}
                              className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                            >
                              {isAr ? 'تعديل بيانات الموظف' : 'Edit employee info'}
                            </button>
                          </div>
                        )}

                        {payrolls.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? 'لا توجد مرتبات حتى الآن.' : 'No payroll records yet.'}</p>
                        ) : (
                          <>
                            {/* Mobile cards */}
                            <div className="space-y-2 md:hidden">
                              {payrolls.map((p) => (
                                <div key={p.id} className="border border-gray-100 rounded-2xl p-3 bg-gray-50/60 dark:bg-slate-800/70 dark:border-slate-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{isAr ? 'الشهر' : 'Month'}: {p.month}</span>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                                      {p.is_locked ? (isAr ? 'مغلق 🔒' : 'Locked 🔒') : isAr ? 'مفتوح' : 'Open'}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                                    <div>{isAr ? 'الأساسي الشهري (يومي × 30)' : 'Monthly base (daily × 30)'}: {numberFormatter.format(p.monthly_salary || 0)}</div>                                    
                                    <div>{isAr ? 'أيام الحضور' : 'Attendance days'}: {numberFormatter.format(p.attendance_days || 0)}</div>
                                    <div>{isAr ? 'أساسي مستحق' : 'Earned base'}: {numberFormatter.format(p.base_salary || 0)}</div>
                                    <div>{isAr ? 'الحوافز' : 'Bonuses'}: {numberFormatter.format(p.bonuses || 0)}</div>
                                    <div>{isAr ? 'الخصومات' : 'Penalties'}: {numberFormatter.format(p.penalties || 0)}</div>
                                    <div>{isAr ? 'السلف' : 'Advances'}: {numberFormatter.format(p.advances || 0)}</div>
                                    <div className="col-span-2 font-semibold text-gray-800 dark:text-gray-100">
                                      {isAr ? 'الصافي' : 'Net'}: {numberFormatter.format(p.net_salary || 0)} {moneyLabel}
                                    </div>
                                    <div className="col-span-2 text-[11px] text-gray-600 dark:text-gray-300">
                                      {p.is_paid ? (isAr ? `مدفوع بتاريخ ${p.paid_at || ''}` : `Paid on ${p.paid_at || ''}`) : isAr ? 'غير مدفوع بعد' : 'Not paid yet'}
                                    </div>
                                    {canManage && !p.is_paid && (
                                      <button
                                        onClick={() => markPayrollPaid(p.id)}
                                        disabled={markingPayrollId === p.id}
                                        className="col-span-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                                      >
                                        {markingPayrollId === p.id ? (isAr ? 'جاري التعليم...' : 'Marking...') : isAr ? 'تعليم كمدفوع' : 'Mark as paid'}
                                      </button>
                                    )}
                                    {canManage && (
                                      <div className="col-span-2 space-y-2">
                                        {payrollEdit.id === p.id ? (
                                          <>
                                            <div className="grid grid-cols-2 gap-2">
                                              <input
                                                type="number"
                                                className="rounded-xl border border-gray-200 px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                                value={payrollEdit.monthly_salary}
                                                onChange={(e) => setPayrollEdit({ ...payrollEdit, monthly_salary: e.target.value })}
                                                placeholder={isAr ? 'الراتب اليومي' : 'Daily salary'}
                                              />                                              
                                              <input
                                                type="number"
                                                className="rounded-xl border border-gray-200 px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                                value={payrollEdit.penalties}
                                                onChange={(e) => setPayrollEdit({ ...payrollEdit, penalties: e.target.value })}
                                                placeholder={isAr ? 'الخصومات' : 'Penalties'}
                                              />
                                              <input
                                                type="number"
                                                className="rounded-xl border border-gray-200 px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                                value={payrollEdit.bonuses}
                                                onChange={(e) => setPayrollEdit({ ...payrollEdit, bonuses: e.target.value })}
                                                placeholder={isAr ? 'الحوافز' : 'Bonuses'}
                                              />
                                              <input
                                                type="number"
                                                className="rounded-xl border border-gray-200 px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                                value={payrollEdit.advances}
                                                onChange={(e) => setPayrollEdit({ ...payrollEdit, advances: e.target.value })}
                                                placeholder={isAr ? 'السلف' : 'Advances'}
                                              />
                                            </div>
                                            <div className="flex gap-2">
                                              <button
                                                onClick={savePayrollEdit}
                                                disabled={saving}
                                                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                                              >
                                                {saving ? (isAr ? 'جاري الحفظ' : 'Saving') : isAr ? 'حفظ التعديلات' : 'Save changes'}
                                              </button>
                                              <button
                                                onClick={() =>
                                                  setPayrollEdit({
                                                    id: null,
                                                    base_salary: '',
                                                    monthly_salary: '',
                                                    penalties: '',
                                                    bonuses: '',
                                                    advances: '',
                                                  })
                                                }
                                                className="px-3 py-1.5 rounded-xl border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                                              >
                                                {isAr ? 'إلغاء' : 'Cancel'}
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex gap-2 flex-wrap">
                                            {!p.is_paid && (
                                              <button
                                                onClick={() => startEditPayroll(p)}
                                                className="px-3 py-1.5 rounded-xl border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                                              >
                                                {isAr ? 'تعديل كشف المرتب' : 'Edit payroll'}
                                              </button>
                                            )}
                                            {!p.is_paid && (
                                              <button
                                                onClick={() => deletePayroll(p.id)}
                                                disabled={deletingPayrollId === p.id}
                                                className="px-3 py-1.5 rounded-xl border border-red-500 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition dark:border-red-500 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-60"
                                              >
                                                {deletingPayrollId === p.id ? (isAr ? 'جار الحذف...' : 'Deleting...') : isAr ? 'حذف المرتب' : 'Delete payroll'}
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Desktop/tablet table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الشهر' : 'Month'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'أيام الحضور' : 'Attendance'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الأساسي الشهري (يومي × 30)' : 'Monthly base (daily × 30)'}</th>                                    
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'أساسي مستحق' : 'Earned base'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الحوافز' : 'Bonuses'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الخصومات' : 'Penalties'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'السلف' : 'Advances'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الصافي' : 'Net'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الإغلاق' : 'Status'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الدفع' : 'Payment'}</th>
                                    {canManage && <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'إجراءات' : 'Actions'}</th>}
                                  </tr>
                                </thead>
                                <tbody>                                  
                                  {payrolls.map((p) => (
                                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70">
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{p.month}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{numberFormatter.format(p.attendance_days || 0)}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{numberFormatter.format(p.monthly_salary || 0)}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{numberFormatter.format(p.base_salary || 0)}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{numberFormatter.format(p.bonuses || 0)}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{numberFormatter.format(p.penalties || 0)}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{numberFormatter.format(p.advances || 0)}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{numberFormatter.format(p.net_salary || 0)} {moneyLabel}</td>
                                      <td className="py-2 px-2 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                                          {p.is_locked ? (isAr ? 'مغلق 🔒' : 'Locked 🔒') : isAr ? 'مفتوح' : 'Open'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                        {p.is_paid ? (
                                          isAr ? `مدفوع (${p.paid_at || ''})` : `Paid (${p.paid_at || ''})`
                                        ) : canManage ? (
                                          <button
                                            onClick={() => markPayrollPaid(p.id)}
                                            disabled={markingPayrollId === p.id}
                                            className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] hover:bg-emerald-700 disabled:opacity-60"
                                          >
                                            {markingPayrollId === p.id ? (isAr ? 'جاري التعليم...' : 'Marking...') : isAr ? 'تعليم كمدفوع' : 'Mark paid'}
                                          </button>
                                        ) : (
                                          <span className="text-[11px] text-red-600 dark:text-red-300">{isAr ? 'غير مدفوع' : 'Unpaid'}</span>
                                        )}
                                      </td>
                                      {canManage && (
                                        <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                          {payrollEdit.id === p.id ? (
                                            <div className="flex flex-col gap-2 text-[11px]">
                                              <div className="grid grid-cols-2 gap-2">
                                                <input
                                                  type="number"
                                                  className="rounded-lg border border-gray-200 px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                                  value={payrollEdit.monthly_salary}
                                                  onChange={(e) => setPayrollEdit({ ...payrollEdit, monthly_salary: e.target.value })}
                                                  placeholder={isAr ? 'الراتب اليومي' : 'Daily salary'}
                                                />                                                
                                                <input
                                                  type="number"
                                                  className="rounded-lg border border-gray-200 px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                                  value={payrollEdit.penalties}
                                                  onChange={(e) => setPayrollEdit({ ...payrollEdit, penalties: e.target.value })}
                                                  placeholder={isAr ? 'الخصومات' : 'Penalties'}
                                                />
                                                <input
                                                  type="number"
                                                  className="rounded-lg border border-gray-200 px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                                  value={payrollEdit.bonuses}
                                                  onChange={(e) => setPayrollEdit({ ...payrollEdit, bonuses: e.target.value })}
                                                  placeholder={isAr ? 'الحوافز' : 'Bonuses'}
                                                />
                                                <input
                                                  type="number"
                                                  className="rounded-lg border border-gray-200 px-2 py-1 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                                  value={payrollEdit.advances}
                                                  onChange={(e) => setPayrollEdit({ ...payrollEdit, advances: e.target.value })}
                                                  placeholder={isAr ? 'السلف' : 'Advances'}
                                                />
                                              </div>
                                              <div className="flex gap-2">
                                                <button
                                                  onClick={savePayrollEdit}
                                                  disabled={saving}
                                                  className="px-3 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                                >
                                                  {saving ? (isAr ? 'جاري الحفظ' : 'Saving') : isAr ? 'حفظ' : 'Save'}
                                                </button>
                                                <button
                                                  onClick={() => setPayrollEdit({ id: null, base_salary: '', monthly_salary: '', penalties: '', bonuses: '', advances: '' })}
                                                  className="px-3 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                                                >
                                                  {isAr ? 'إلغاء' : 'Cancel'}
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex gap-2 flex-wrap">
                                              {!p.is_paid && (
                                                <button
                                                  onClick={() => startEditPayroll(p)}
                                                  className="px-3 py-1 rounded-full border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                                                >
                                                  {isAr ? 'تعديل' : 'Edit'}
                                                </button>
                                              )}
                                              {!p.is_paid && (
                                                <button
                                                  onClick={() => deletePayroll(p.id)}
                                                  disabled={deletingPayrollId === p.id}
                                                  className="px-3 py-1 rounded-full border border-red-500 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition dark:border-red-500 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-60"
                                                >
                                                  {deletingPayrollId === p.id ? (isAr ? 'جار الحذف...' : 'Deleting...') : isAr ? 'حذف' : 'Delete'}
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                      )}
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
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? 'استخدم الفلتر لعرض الحوافز والخصومات حسب الشهر.' : 'Use the filter to view bonuses and deductions by month.'}</p>
                          <label className="text-xs flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span>{isAr ? 'الشهر' : 'Month'}</span>
                            <input
                              type="month"
                              value={selectedMonth}
                              onChange={(e) => setSelectedMonth(e.target.value)}
                              className="rounded-xl border border-gray-200 px-2 py-1 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                            />
                          </label>
                        </div>

                        {canManage && (
                          <div className="bg-white rounded-2xl border border-gray-100 p-3 md:p-4 mb-4 dark:bg-slate-900 dark:border-slate-800">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">{isAr ? 'إضافة حركة (حافز / خصم / سلفة)' : 'Add entry (Bonus / Deduction / Advance)'}</h4>
                            <div className="grid gap-2 md:grid-cols-4 text-xs">
                              <label className="flex flex-col gap-1">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'النوع' : 'Type'}</span>
                                <select
                                  value={ledgerForm.entry_type}
                                  onChange={(e) => setLedgerForm({ ...ledgerForm, entry_type: e.target.value })}
                                  className="rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                >
                                  <option value="BONUS">{isAr ? 'حافز' : 'Bonus'}</option>
                                  <option value="PENALTY">{isAr ? 'خصم' : 'Deduction'}</option>
                                  <option value="ADVANCE">{isAr ? 'سلفة' : 'Advance'}</option>
                                </select>
                              </label>

                              <label className="flex flex-col gap-1">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'القيمة' : 'Amount'}</span>
                                <input
                                  type="number"
                                  value={ledgerForm.amount}
                                  onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                                  className="rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                />
                              </label>

                              <label className="flex flex-col gap-1">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'التاريخ' : 'Date'}</span>
                                <input
                                  type="date"
                                  value={ledgerForm.payout_date}
                                  onChange={(e) => setLedgerForm({ ...ledgerForm, payout_date: e.target.value })}
                                  className="rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                />
                              </label>

                              <label className="flex flex-col gap-1 md:col-span-1">
                                <span className="text-gray-600 dark:text-gray-300">{isAr ? 'الوصف' : 'Description'}</span>
                                <input
                                  type="text"
                                  value={ledgerForm.description}
                                  onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
                                  className="rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                                  placeholder={isAr ? 'اختياري' : 'Optional'}
                                />
                              </label>
                            </div>

                            <div className="mt-3">
                              <button
                                onClick={addLedgerEntry}
                                disabled={ledgerSaving}
                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                              >
                                {ledgerSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ الحركة' : 'Save entry'}
                              </button>
                            </div>
                          </div>
                        )}

                        {ledger.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{isAr ? 'لا توجد حركات مالية حتى الآن.' : 'No ledger entries yet.'}</p>
                        ) : (
                          <>
                            {/* Mobile cards */}
                            <div className="space-y-2 md:hidden">
                              {ledger.map((l, i) => (
                                <div key={i} className="border border-gray-100 rounded-2xl p-3 bg-gray-50/60 dark:bg-slate-800/70 dark:border-slate-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{isAr ? 'النوع' : 'Type'}: {l.type}</span>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      {new Date(l.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-EG')}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">{isAr ? 'الوصف' : 'Description'}: {l.description || '—'}</div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{isAr ? 'تاريخ الصرف' : 'Payout'}: {l.payout_date || '—'}</div>
                                  <div className="mt-2 font-semibold text-gray-800 dark:text-gray-100 text-sm">{numberFormatter.format(l.amount || 0)} {moneyLabel}</div>
                                </div>
                              ))}
                            </div>

                            {/* Desktop/tablet table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'النوع' : 'Type'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'القيمة' : 'Amount'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'الوصف' : 'Description'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'التاريخ' : 'Date'}</th>
                                    <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap dark:text-gray-200">{isAr ? 'تاريخ الصرف' : 'Payout date'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ledger.map((l, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70">
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{l.type}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{numberFormatter.format(l.amount || 0)} {moneyLabel}</td>
                                      <td className="py-2 px-2 text-gray-600 dark:text-gray-300">{l.description || '—'}</td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {new Date(l.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-EG')}
                                      </td>
                                      <td className="py-2 px-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{l.payout_date || '—'}</td>
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