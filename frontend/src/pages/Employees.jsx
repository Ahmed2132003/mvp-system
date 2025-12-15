import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError } from '../lib/notifications';

export default function Employees() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/');
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setEmployees(data);
    } catch (err) {
      console.error(err);
      notifyError('فشل تحميل الموظفين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الموظفين</h1>
          <p className="text-sm text-gray-500">عرض وإدارة الموظفين</p>
        </div>

        <Link to="/dashboard" className="text-sm px-3 py-1 rounded-xl border hover:bg-gray-50">
          ← الرجوع للداشبورد
        </Link>
      </div>

      <div className="bg-white rounded-2xl border p-4">
        {loading ? (
          <p className="text-sm text-gray-500">جاري التحميل...</p>
        ) : employees.length === 0 ? (
          <p className="text-sm text-gray-500">لا يوجد موظفين</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2">#</th>
                  <th className="p-2">الاسم</th>
                  <th className="p-2">الإيميل</th>
                  <th className="p-2">الفرع</th>
                  <th className="p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="p-2">{e.id}</td>
                    <td className="p-2">{e.user?.name || '—'}</td>
                    <td className="p-2">{e.user?.email || '—'}</td>
                    <td className="p-2">{e.store_name || '—'}</td>
                    <td className="p-2">
                      <Link
                        to={`/employees/${e.id}`}
                        className="text-xs px-3 py-1 rounded-xl border hover:bg-gray-50"
                      >
                        فتح الملف
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
