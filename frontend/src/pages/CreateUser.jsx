// src/pages/CreateUser.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { notifySuccess, notifyError } from '../lib/notifications';

export default function CreateUser() {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'STAFF',
    password: '',
    store_id: null, // ✅ جديد
  });

  const [stores, setStores] = useState([]); // ✅ جديد
  const [storesLoading, setStoresLoading] = useState(false); // ✅ جديد

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');

  // theme & language
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const isAr = lang === 'ar';

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

  const allowedRoles = useMemo(() => {
    if (user?.is_superuser) return ['OWNER', 'MANAGER', 'STAFF'];
    if (user?.role === 'OWNER') return ['MANAGER', 'STAFF'];
    if (user?.role === 'MANAGER') return ['STAFF'];
    return [];
  }, [user]);

  // ✅ هل store_id مطلوب؟
  const storeRequired = useMemo(() => {
    if (user?.is_superuser) return formData.role !== 'OWNER';
    if (user?.role === 'OWNER') return formData.role !== 'OWNER';
    return false; // MANAGER: مش مطلوب (بياخده تلقائيًا)
  }, [user, formData.role]);

  // ✅ تحميل الفروع (بدون eslint-disable)
  const fetchStores = useCallback(async () => {
    if (!storeRequired) return;

    setStoresLoading(true);
    try {
      const res = await api.get('/stores/');
      
      const results = Array.isArray(res.data) ? res.data : res.data.results || [];
      setStores(results);
    } catch (e) {
      console.error(e);
      const msg = isAr
        ? 'تعذر تحميل قائمة الفروع. تأكد من وجود endpoint للفروع في الباك اند.'
        : 'Failed to load stores list. Please ensure a stores endpoint exists in backend.';
      notifyError(msg);
      setStores([]);
    } finally {
      setStoresLoading(false);
    }
  }, [storeRequired, isAr]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // ✅ لما role يتغير: نظّف store_id لو مش مطلوب
  useEffect(() => {
    if (!storeRequired) {
      setFormData((prev) => ({ ...prev, store_id: null }));
    }
  }, [storeRequired]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      if (storeRequired && !formData.store_id) {
        const msg = isAr ? 'يجب اختيار الفرع (store)' : 'Please select a store (branch).';
        setError(msg);
        notifyError(msg);
        setLoading(false);
        return;
      }

      const payload = { ...formData };
      if (!payload.store_id) delete payload.store_id;

      const response = await api.post('/users/create/', payload);

      const email = response.data.email || formData.email;
      setCreatedEmail(email);

      const msg = isAr
        ? 'تم إنشاء الحساب بنجاح! تم إرسال رابط التفعيل على البريد الإلكتروني.'
        : 'Account created successfully! Activation link has been sent to the email.';

      setSuccess(msg);
      notifySuccess(msg);

      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'STAFF',
        password: '',
        store_id: null,
      });
    } catch (err) {
      const fallbackMsg = isAr ? 'حدث خطأ أثناء إنشاء الحساب' : 'An error occurred while creating the account';

      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.email?.[0] ||
        fallbackMsg;

      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const setLanguage = (lng) => setLang(lng);

  const pageTitle = isAr ? 'إنشاء حساب جديد' : 'Create a new user account';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50 flex flex-col">
      <header className="w-full border-b border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-800 px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">{pageTitle}</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
            {isAr
              ? 'إضافة مستخدم جديد إلى النظام مع إرسال رابط تفعيل عبر البريد الإلكتروني.'
              : 'Add a new user to the system and send them an activation link via email.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
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
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-2xl">
          {success && (
            <div className="bg-green-100 border-2 border-green-500 text-green-800 p-6 md:p-8 rounded-2xl text-center text-sm md:text-lg font-bold mb-8 shadow-lg dark:bg-green-900/30 dark:border-green-700 dark:text-green-100">
              <p>{success}</p>
              <br />
              <p className="text-base md:text-xl">
                {isAr ? 'تم إرسال رابط التفعيل إلى:' : 'Activation link sent to:'}
                <br />
                <strong className="text-lg md:text-2xl text-primary dark:text-green-300">{createdEmail}</strong>
              </p>
              <p className="text-xs md:text-sm font-normal mt-4 md:mt-6 text-gray-700 dark:text-gray-200">
                {isAr
                  ? 'اطلب من الموظف فتح بريده الإلكتروني والضغط على الرابط لتفعيل حسابه وتسجيل الدخول.'
                  : 'Ask the employee to open their email and click the link to activate their account and log in.'}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border-2 border-red-500 text-red-800 p-4 md:p-6 rounded-2xl text-center font-bold mb-6 dark:bg-red-900/30 dark:border-red-700 dark:text-red-100 text-sm md:text-base">
              {error}
            </div>
          )}

          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-2xl dark:bg-slate-900 dark:shadow-none dark:border dark:border-slate-800">
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">
                  {isAr ? 'الاسم الكامل' : 'Full name'}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? 'اكتب اسم الموظف' : 'Enter employee full name'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={loading}
                  className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border-2 border-gray-300 focus:border-primary outline-none transition disabled:bg-gray-100 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100 dark:focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">
                  {isAr ? 'البريد الإلكتروني' : 'Email address'}
                </label>
                <input
                  type="email"
                  placeholder="example@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading}
                  className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border-2 border-gray-300 focus:border-primary outline-none transition disabled:bg-gray-100 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100 dark:focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">
                  {isAr ? 'رقم الموبايل (اختياري)' : 'Mobile number (optional)'}
                </label>
                <input
                  type="tel"
                  placeholder={isAr ? 'مثال: 01000000000' : 'e.g. 01000000000'}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={loading}
                  className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border-2 border-gray-300 focus:border-primary outline-none transition disabled:bg-gray-100 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100 dark:focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">
                  {isAr ? 'كلمة المرور (٨ أحرف على الأقل)' : 'Password (min 8 characters)'}
                </label>
                <input
                  type="password"
                  placeholder={isAr ? 'أدخل كلمة المرور' : 'Enter a strong password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  disabled={loading}
                  className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border-2 border-gray-300 focus:border-primary outline-none transition disabled:bg-gray-100 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100 dark:focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">
                  {isAr ? 'الدور / الصلاحية' : 'Role / permission'}
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  disabled={loading || allowedRoles.length === 0}
                  className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border-2 border-gray-300 focus:border-primary outline-none transition disabled:bg-gray-100 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100 dark:focus:border-blue-400"
                >
                  {allowedRoles.length === 0 && (
                    <option value="">
                      {isAr ? 'لا تملك صلاحية لإنشاء مستخدمين' : 'You are not allowed to create users'}
                    </option>
                  )}
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>
                      {r === 'OWNER'
                        ? isAr
                          ? 'صاحب المكان'
                          : 'Owner'
                        : r === 'MANAGER'
                        ? isAr
                          ? 'مدير'
                          : 'Manager'
                        : isAr
                        ? 'موظف'
                        : 'Staff'}
                    </option>
                  ))}
                </select>
              </div>

              {storeRequired && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">
                    {isAr ? 'اختر الفرع (Store)' : 'Select Store (Branch)'}
                  </label>
                  <select
                    value={formData.store_id ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        store_id: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    disabled={loading || storesLoading}
                    className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border-2 border-gray-300 focus:border-primary outline-none transition disabled:bg-gray-100 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100 dark:focus:border-blue-400"
                  >
                    <option value="">
                      {storesLoading ? (isAr ? 'جاري تحميل الفروع...' : 'Loading stores...') : isAr ? 'اختر فرع' : 'Choose a store'}
                    </option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.address ? `— ${s.address}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || allowedRoles.length === 0}
                className="w-full bg-primary text-white py-4 md:py-5 rounded-xl font-bold text-base md:text-xl hover:bg-primary-dark disabled:opacity-60 transition duration-300 shadow-lg dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {loading
                  ? isAr
                    ? 'جاري إنشاء الحساب...'
                    : 'Creating account...'
                  : isAr
                  ? 'إنشاء الحساب وإرسال رابط التفعيل'
                  : 'Create account & send activation email'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
