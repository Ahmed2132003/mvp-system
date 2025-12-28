import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { notifyError, notifySuccess } from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';

const RoleBadge = ({ role }) => {
  const map = {
    OWNER: { label: 'Owner', color: 'bg-purple-100 text-purple-700' },
    MANAGER: { label: 'Manager', color: 'bg-blue-100 text-blue-700' },
    STAFF: { label: 'Staff', color: 'bg-gray-100 text-gray-700' },
  };
  const info = map[role] || map.STAFF;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${info.color}`}>
      {info.label}
    </span>
  );
};

export default function AdminAccounts() {
  const { User } = useAuth();
  
  const [accounts, setAccounts] = useState([]);
  const [stores, setStores] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const filteredAccounts = useMemo(() => {
    if (!roleFilter) return accounts;
    return accounts.filter((acc) => acc.role === roleFilter);
  }, [accounts, roleFilter]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users/', {
        params: roleFilter ? { role: roleFilter } : {},
      });
      setAccounts(res.data || []);
      setError('');
    } catch (err) {
      console.error(err);
      setError('تعذر تحميل الحسابات، حاول لاحقًا.');
      notifyError('تعذر تحميل الحسابات، حاول لاحقًا.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  const loadStores = useCallback(async () => {
    try {
      const res = await api.get('/stores/available/');
      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setStores(results);
    } catch (err) {
      console.error(err);
      notifyError('تعذر تحميل الفروع المتاحة.');
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const updateAccountInState = (updated) => {
    setAccounts((prev) => prev.map((acc) => (acc.id === updated.id ? updated : acc)));
  };

  const handleTogglePayment = async (acc) => {
    setActionLoading(acc.id);
    try {
      const res = await api.post(`/admin/users/${acc.id}/set-payment/`, {
        verified: !acc.is_payment_verified,
      });
      updateAccountInState(res.data);
      notifySuccess(
        !acc.is_payment_verified
          ? 'تم توثيق الدفع وتشغيل الحساب بنجاح.'
          : 'تم إيقاف توثيق الدفع لهذا الحساب.'
      );
    } catch (err) {
      console.error(err);
      notifyError('تعذر تعديل حالة الدفع.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (acc) => {
    setActionLoading(acc.id);
    try {
      const res = await api.patch(`/admin/users/${acc.id}/`, { is_active: !acc.is_active });
      updateAccountInState(res.data);
      notifySuccess(!acc.is_active ? 'تم تفعيل الحساب.' : 'تم إيقاف الحساب.');
    } catch (err) {
      console.error(err);
      notifyError('تعذر تحديث حالة الحساب.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (acc, newRole) => {
    setActionLoading(acc.id);
    try {
      const res = await api.patch(`/admin/users/${acc.id}/`, { role: newRole });
      updateAccountInState(res.data);
      notifySuccess('تم تحديث نوع الحساب.');
    } catch (err) {
      console.error(err);
      notifyError('تعذر تحديث نوع الحساب.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStoreLink = async (acc, storeId) => {
    if (!storeId) return;
    setActionLoading(acc.id);
    try {
      const res = await api.post(`/admin/users/${acc.id}/link-store/`, { store_id: storeId });
      updateAccountInState(res.data);
      notifySuccess('تم ربط الحساب بالستور بنجاح.');
    } catch (err) {
      console.error(err);
      notifyError('تعذر ربط الستور بالحساب.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStoreUnlink = async (acc, storeId) => {
    setActionLoading(acc.id);
    try {
      const res = await api.post(`/admin/users/${acc.id}/unlink-store/`, { store_id: storeId });
      updateAccountInState(res.data);
      notifySuccess('تم إزالة الربط بالستور.');
    } catch (err) {
      console.error(err);
      notifyError('تعذر إزالة ربط الستور.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (acc) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
    setActionLoading(acc.id);
    try {
      await api.delete(`/admin/users/${acc.id}/`);
      setAccounts((prev) => prev.filter((u) => u.id !== acc.id));
      notifySuccess('تم حذف الحساب.');
    } catch (err) {
      console.error(err);
      notifyError('تعذر حذف الحساب.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
            إدارة الحسابات (سوبر يوزر)
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
            ربط/إزالة ستور، ضبط التجربة المجانية، توثيق الدفع، وتفعيل/إيقاف الحسابات.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            ← العودة للداشبورد
          </Link>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-700"
            >
              <option value="">كل الأنواع</option>
              <option value="OWNER">Owner</option>
              <option value="MANAGER">Manager</option>
              <option value="STAFF">Staff</option>
            </select>
            <button
              type="button"
              onClick={loadAccounts}
              className="text-sm px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark"
            >
              تحديث القائمة
            </button>
          </div>
          <div className="text-xs text-gray-500">
            إجمالي الحسابات: <span className="font-semibold">{filteredAccounts.length}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl dark:bg-red-900/30 dark:border-red-800 dark:text-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr className="text-gray-600 dark:text-gray-300">
                <th className="py-3 px-3 font-semibold">الحساب</th>
                <th className="py-3 px-3 font-semibold">الدور</th>
                <th className="py-3 px-3 font-semibold">التجربة / الدفع</th>
                <th className="py-3 px-3 font-semibold">الستور المرتبط</th>
                <th className="py-3 px-3 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-gray-500">
                    لا توجد حسابات مطابقة.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="border-b border-gray-50 last:border-0 dark:border-slate-800">
                    <td className="py-3 px-3 space-y-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-50">
                        {acc.name || '—'}
                      </div>
                      <div className="text-xs text-gray-500">{acc.email}</div>
                      <div className="text-[11px] text-gray-400">
                        {new Date(acc.date_joined).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-3 space-y-2">
                      <RoleBadge role={acc.role} />
                      <select
                        value={acc.role}
                        onChange={(e) => handleRoleChange(acc, e.target.value)}
                        disabled={actionLoading === acc.id}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-700"
                      >
                        <option value="OWNER">Owner</option>
                        <option value="MANAGER">Manager</option>
                        <option value="STAFF">Staff</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            acc.is_payment_verified
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {acc.is_payment_verified ? 'مدفوع' : 'تجربة'}
                        </span>
                        {!acc.has_active_access && !acc.is_payment_verified && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-100 text-red-700">
                            منتهية
                          </span>
                        )}
                      </div>
                      {!acc.is_payment_verified && (
                        <div className="text-gray-500">
                          متبقي:{' '}
                          {acc.trial_days_left !== null && acc.trial_days_left !== undefined
                            ? `${acc.trial_days_left} يوم`
                            : '—'}
                        </div>
                      )}
                      {acc.access_block_reason && !acc.is_payment_verified && (
                        <div className="text-[11px] text-red-500 leading-5">{acc.access_block_reason}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTogglePayment(acc)}
                        disabled={actionLoading === acc.id}
                        className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        {acc.is_payment_verified ? 'إزالة التفعيل' : 'تفعيل الدفع'}
                      </button>
                    </td>
                    <td className="py-3 px-3 space-y-2 text-xs">
                      {acc.role === 'OWNER' ? (
                        <div className="space-y-2">
                          <div className="text-gray-600 dark:text-gray-200">
                            يملك: {acc.owned_stores?.length || 0} فروع
                          </div>
                          {acc.owned_stores?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {acc.owned_stores.map((s) => (
                                <span
                                  key={s.id}
                                  className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-200 flex items-center gap-1"
                                >
                                  {s.name}
                                  <button
                                    type="button"
                                    className="text-red-600"
                                    onClick={() => handleStoreUnlink(acc, s.id)}
                                    disabled={actionLoading === acc.id}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-gray-600 dark:text-gray-200">
                            {acc.employee_store?.name || 'غير مرتبط بستور'}
                          </div>
                        </div>
                      )}
                      <select
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 dark:border-slate-700"
                        defaultValue=""
                        onChange={(e) => {
                          const value = e.target.value;
                          e.target.value = '';
                          handleStoreLink(acc, value);
                        }}
                        disabled={actionLoading === acc.id}
                      >
                        <option value="">اختر ستور للربط</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 space-y-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(acc)}
                        disabled={actionLoading === acc.id}
                        className="w-full px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        {acc.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                      </button>
                      {!acc.is_superuser && (
                        <button
                          type="button"
                          onClick={() => handleDelete(acc)}
                          disabled={actionLoading === acc.id}
                          className="w-full px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
                        >
                          حذف
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500 leading-6 dark:text-gray-400">
          • يستطيع السوبر يوزر فقط التحكم في الدفع، ربط/إزالة ستور، وتفعيل/إيقاف الحسابات.<br />
          • عند إزالة التفعيل أو انتهاء التجربة المجانية سيُمنع الحساب من الوصول إلى النظام مع إظهار رسالة
          ترقية.
        </div>
      </main>
    </div>
  );
}