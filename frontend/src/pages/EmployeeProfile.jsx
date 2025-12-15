import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError, notifySuccess } from '../lib/notifications';

const tabs = [
  { key: 'info', label: 'البيانات الأساسية' },
  { key: 'attendance', label: 'الحضور' },
  { key: 'payroll', label: 'المرتبات' },
  { key: 'ledger', label: 'الحركات المالية' },
];

export default function EmployeeProfile() {
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState('info');
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployee = useCallback(async () => {
    try {
      const res = await api.get(`/employees/${id}/`);
      setEmployee(res.data);
    } catch {
      notifyError('فشل تحميل بيانات الموظف');
    }
  }, [id]);

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

  const generatePayroll = async () => {
    try {
      const month = prompt('أدخل أول يوم في الشهر (YYYY-MM-DD)');
      if (!month) return;

      await api.post(`/employees/${id}/generate_payroll/`, { month });
      notifySuccess('تم احتساب المرتب');
      fetchPayrolls();
    } catch {
      notifyError('فشل احتساب المرتب');
    }
  };

  useEffect(() => {
    fetchEmployee().finally(() => setLoading(false));
  }, [fetchEmployee]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance();
    if (activeTab === 'payroll') fetchPayrolls();
    if (activeTab === 'ledger') fetchLedger();
  }, [activeTab, fetchAttendance, fetchPayrolls, fetchLedger]);

  if (loading) return <p className="p-6">جاري التحميل...</p>;
  if (!employee) return <p className="p-6">الموظف غير موجود</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{employee.user.name}</h1>
          <p className="text-sm text-gray-500">{employee.user.email}</p>
        </div>
        <Link to="/employees" className="text-sm px-3 py-1 rounded-xl border hover:bg-gray-50">
          ← الرجوع
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-t-xl ${
              activeTab === tab.key
                ? 'bg-white border border-b-0 font-semibold'
                : 'text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border p-4">
        {activeTab === 'info' && (
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <p><b>الاسم:</b> {employee.user.name}</p>
              <p><b>الإيميل:</b> {employee.user.email}</p>
              <p><b>الهاتف:</b> {employee.user.phone || '—'}</p>
              <p><b>الفرع:</b> {employee.store_name}</p>
            </div>

            <div className="space-y-2">
              <p><b>الراتب:</b> {employee.salary} ج.م</p>
              <p><b>السلف:</b> {employee.advances} ج.م</p>
              <p><b>تاريخ التعيين:</b> {employee.hire_date || '—'}</p>
            </div>

            {employee.qr_code_attendance_base64 && (
              <div className="text-center">
                <p className="font-semibold mb-2">QR الحضور والانصراف</p>
                <img
                  src={`data:image/png;base64,${employee.qr_code_attendance_base64}`}
                  className="mx-auto w-40 border rounded-xl"
                  alt="QR Attendance"
                />
                <p className="text-xs text-gray-500 mt-2">
                  يُستخدم لتسجيل الدخول والانصراف
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th>الدخول</th>
                <th>الخروج</th>
                <th>تأخير</th>
                <th>غرامة</th>
                <th>المدة</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((a, i) => (
                <tr key={i} className="border-b text-center">
                  <td>{a.check_in || '—'}</td>
                  <td>{a.check_out || '—'}</td>
                  <td>{a.late_minutes || 0}</td>
                  <td>{a.penalty || 0}</td>
                  <td>{a.duration || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'payroll' && (
          <>
            <button
              onClick={generatePayroll}
              className="mb-3 px-3 py-1 rounded-xl bg-blue-600 text-white text-sm"
            >
              احتساب مرتب جديد
            </button>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th>الشهر</th>
                  <th>الأساسي</th>
                  <th>الخصومات</th>
                  <th>الصافي</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map(p => (
                  <tr key={p.id} className="border-b text-center">
                    <td>{p.month}</td>
                    <td>{p.base_salary}</td>
                    <td>{p.penalties}</td>
                    <td>{p.net_salary}</td>
                    <td>{p.is_locked ? 'مغلق 🔒' : 'مفتوح'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {activeTab === 'ledger' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th>النوع</th>
                <th>القيمة</th>
                <th>الوصف</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l, i) => (
                <tr key={i} className="border-b text-center">
                  <td>{l.type}</td>
                  <td>{l.amount}</td>
                  <td>{l.description}</td>
                  <td>{new Date(l.created_at).toLocaleDateString('ar-EG')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
