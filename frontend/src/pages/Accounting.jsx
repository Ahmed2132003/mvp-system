import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError } from '../lib/notifications';

export default function Accounting() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);     // <-- هنا هيتحط response النهائي
  const [error, setError] = useState(null);

  const fetchAccounting = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ endpoint اللي إنت بتنده عليه في الكون솔
      const res = await api.get('/reports/accounting/');

      // بعض المشاريع بتلف الداتا داخل data
      const payload = res?.data?.data ?? res?.data ?? null;

      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid accounting response shape');
      }

      setData(payload);
    } catch (err) {
      console.error('Accounting fetch error:', err);

      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (err?.response?.status === 404
          ? 'Endpoint الحسابات غير موجود على السيرفر (404).'
          : 'فشل تحميل صفحة الحسابات.');

      setError(msg);
      notifyError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounting();
  }, [fetchAccounting]);

  // ✅ Safe reads (مستحيل تكسر)
  const totalSalaries = data?.total_salaries ?? 0;
  const totalPenalties = data?.total_penalties ?? 0;
  const totalBonuses = data?.total_bonuses ?? 0;
  const totalAdvances = data?.total_advances ?? 0;

  const net = data?.net ?? (totalSalaries - totalPenalties - totalAdvances + totalBonuses);

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const currency = data?.currency ?? 'EGP';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">الحسابات</h1>
            <p className="text-sm text-gray-500">
              ملخص المرتبات والخصومات والحركات المالية
            </p>
          </div>

          <Link
            to="/dashboard"
            className="text-sm px-3 py-1 rounded-xl border hover:bg-gray-50"
          >
            ← الرجوع للداشبورد
          </Link>
        </div>

        {/* States */}
        {loading && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl px-4 py-3 text-sm">
            جاري تحميل بيانات الحسابات...
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">
            {error}
            <button
              type="button"
              onClick={fetchAccounting}
              className="ml-2 mr-2 underline font-semibold"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* KPIs */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white border rounded-2xl p-4">
                <p className="text-xs text-gray-500">إجمالي المرتبات</p>
                <p className="text-xl font-bold">{totalSalaries} {currency}</p>
              </div>

              <div className="bg-white border rounded-2xl p-4">
                <p className="text-xs text-gray-500">إجمالي الخصومات</p>
                <p className="text-xl font-bold">{totalPenalties} {currency}</p>
              </div>

              <div className="bg-white border rounded-2xl p-4">
                <p className="text-xs text-gray-500">إجمالي السلف</p>
                <p className="text-xl font-bold">{totalAdvances} {currency}</p>
              </div>

              <div className="bg-white border rounded-2xl p-4">
                <p className="text-xs text-gray-500">إجمالي المكافآت</p>
                <p className="text-xl font-bold">{totalBonuses} {currency}</p>
              </div>

              <div className="bg-white border rounded-2xl p-4">
                <p className="text-xs text-gray-500">الصافي</p>
                <p className="text-xl font-bold">{net} {currency}</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border rounded-2xl p-4 overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold">تفاصيل</p>
                <button
                  type="button"
                  onClick={fetchAccounting}
                  className="text-xs px-3 py-1 rounded-xl border hover:bg-gray-50"
                >
                  تحديث
                </button>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-gray-500">لا توجد بيانات لعرضها.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2">الموظف</th>
                      <th className="py-2">الشهر</th>
                      <th className="py-2">الأساسي</th>
                      <th className="py-2">خصومات</th>
                      <th className="py-2">سلف</th>
                      <th className="py-2">مكافآت</th>
                      <th className="py-2">الصافي</th>
                      <th className="py-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.id ?? idx} className="border-b text-center">
                        <td className="py-2">{r.employee_name ?? '—'}</td>
                        <td className="py-2">{r.month ?? '—'}</td>
                        <td className="py-2">{r.base_salary ?? 0}</td>
                        <td className="py-2">{r.penalties ?? 0}</td>
                        <td className="py-2">{r.advances ?? 0}</td>
                        <td className="py-2">{r.bonuses ?? 0}</td>
                        <td className="py-2">{r.net_salary ?? 0}</td>
                        <td className="py-2">{r.is_locked ? 'مغلق 🔒' : 'مفتوح'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
