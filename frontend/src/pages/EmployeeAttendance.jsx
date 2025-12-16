import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import api from '../lib/api';
import { notifySuccess, notifyError } from '../lib/notifications';

function getGeoLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

/**
 * ✅ بعض الإصدارات من Scanner بتدي:
 * - string
 * - أو object { rawValue, ... }
 * - أو object { text, ... }
 * فهنا بنوحّدها لـ string
 */
function normalizeQrRaw(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();

  // common shapes
  if (typeof raw?.rawValue === 'string') return raw.rawValue.trim();
  if (typeof raw?.text === 'string') return raw.text.trim();
  if (typeof raw?.data === 'string') return raw.data.trim();

  // fallback
  try {
    return String(raw).trim();
  } catch {
    return '';
  }
}

function parseQrParams(raw) {
  // QR ممكن يبقى absolute أو relative
  const cleaned = normalizeQrRaw(raw);
  if (!cleaned) return { storeId: null, employeeId: null, raw: '' };

  // absolute url
  try {
    const url = new URL(cleaned);
    const store = url.searchParams.get('store') || url.searchParams.get('store_id');
    const employee = url.searchParams.get('employee') || url.searchParams.get('employee_id');
    return {
      raw: cleaned,
      storeId: store ? Number(store) : null,
      employeeId: employee ? Number(employee) : null,
    };
  } catch {
    // not absolute
  }

  // relative url like /attendance/qr/?store=3&employee=12
  try {
    const url = new URL(cleaned, window.location.origin);
    const store = url.searchParams.get('store') || url.searchParams.get('store_id');
    const employee = url.searchParams.get('employee') || url.searchParams.get('employee_id');
    return {
      raw: cleaned,
      storeId: store ? Number(store) : null,
      employeeId: employee ? Number(employee) : null,
    };
  } catch {
    // not url
  }

  // fallback: رقم فقط (مش هنستخدمه هنا)
  const asNum = Number(cleaned);
  if (!Number.isNaN(asNum) && asNum > 0) {
    return { raw: cleaned, storeId: asNum, employeeId: null };
  }

  return { raw: cleaned, storeId: null, employeeId: null };
}

// ✅ helper: format ISO datetime nicely
function fmtDateTime(v) {
  if (!v) return '—';
  try {
    const d = new Date(v);
if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('ar-EG', {
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

function fmtMinutes(min) {
  if (!min) return '0 د';
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  if (!h) return `${m} د`;
  if (!m) return `${h} س`;
  return `${h} س ${m} د`;
}

export default function EmployeeAttendance() {
  const [mode, setMode] = useState('scan'); // 'scan' | 'show_qr'

  const [processing, setProcessing] = useState(false);
  const [lastRawValue, setLastRawValue] = useState(null);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // ✅ بدل store: هنجيب بيانات الموظف الحالي + QR بتاعه
  const [meAttendance, setMeAttendance] = useState(null);
  const [meLoading, setMeLoading] = useState(true);

  const fetchMyStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const res = await api.get('/attendance/my-status/');
      setStatus(res.data);
    } catch (e) {
      setStatus(null);
      const msg = e?.response?.data?.detail || 'تعذر جلب ملخص الحضور.';
      notifyError(msg);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchMyAttendanceQr = useCallback(async () => {
    try {
      setMeLoading(true);
      // ✅ endpoint اللي عملناه في الباك:
      // GET /core/employees/me-attendance-qr/
      const res = await api.get('/core/employees/me-attendance-qr/');
      setMeAttendance(res.data);
    } catch (e) {
      setMeAttendance(null);
      const msg =
        e?.response?.data?.detail ||
        'تعذر تحميل QR الموظف. تأكد أن الحساب مربوط بملف موظف (Employee).';
      notifyError(msg);
    } finally {
      setMeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyAttendanceQr();
    fetchMyStatus();
  }, [fetchMyAttendanceQr, fetchMyStatus]);

  const handleDecode = async (raw) => {
    const normalized = normalizeQrRaw(raw);
    if (!normalized) return;
    if (processing || normalized === lastRawValue) return;

    setProcessing(true);
    setLastRawValue(normalized);
    setError(null);
    setResult(null);

    try {
      const { storeId, employeeId } = parseQrParams(normalized);

      // ✅ لازم QR يحتوي store + employee
      if (!storeId) throw new Error('QR لا يحتوي store id.');
      if (!employeeId) throw new Error('QR لا يحتوي employee id.');

      // ✅ تأكد إن الـ QR ده بتاع الموظف الحالي (من الـ endpoint)
      if (meAttendance?.id && Number(meAttendance.id) !== Number(employeeId)) {
        throw new Error('QR لا يخص هذا الموظف.');
      }
      if (meAttendance?.store_id && Number(meAttendance.store_id) !== Number(storeId)) {
        throw new Error('QR لا يخص هذا الفرع.');
      }

      const location = await getGeoLocation();

      // ✅ attendance_check بياخد الموظف من JWT، بس نبعت employee_id للتحقق
      const payload = {
        store_id: storeId,
        employee_id: employeeId,
        location,
      };

      console.log('[Attendance] QR:', normalized);
      console.log('[Attendance] POST /attendance/check payload:', payload);

      const res = await api.post('/attendance/check/', payload);

      console.log('[Attendance] Response:', res?.status, res?.data);
      setResult({
        status: res.data.status, // checkin | checkout␊
        message: res.data.message,
        work_date: res.data.work_date,
        check_in: res.data.check_in,
        check_out: res.data.check_out,
        is_late: res.data.is_late,
        late_minutes: res.data.late_minutes,
        penalty: res.data.penalty,
        duration_minutes: res.data.duration_minutes,
      });

      fetchMyStatus();

      notifySuccess(res.data.message || 'تم تسجيل العملية بنجاح');
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.error('[Attendance] Error:', status, data, err);

      const msg =
        data?.message ||
        data?.detail ||
        err.message ||
        'حدث خطأ أثناء معالجة الكود.';

      setError(msg);

      if (status === 401) {
        notifyError('غير مصرح: برجاء تسجيل الدخول مرة أخرى.');
      } else {
        notifyError(msg);
      }
    } finally {
      setProcessing(false);
      setTimeout(() => setLastRawValue(null), 2000);
    }
  };

  const handleError = (err) => {
    console.error('Scanner error:', err);
    notifyError('تعذر الوصول للكاميرا أو قراءة الكود، تأكد من الإذن والمحاولة مرة أخرى.');
  };

  const isCheckin = result?.status === 'checkin';
  const isCheckout = result?.status === 'checkout';

  const employeeQrExists = !!meAttendance?.qr_attendance_base64;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">
              تسجيل حضور الموظفين بالـ QR
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              امسح QR الخاص بك لتسجيل الدخول أو الانصراف (التوقيت والموقع يتسجلوا تلقائيًا).
            </p>
          </div>
          <Link
            to="/dashboard"
            className="text-xs md:text-sm px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50"
          >
            ← الرجوع للداشبورد
          </Link>
        </header>

        {/* ✅ ملخص سريع */}
        <section className="grid md:grid-cols-2 gap-4 bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <div className="space-y-1 text-sm">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              بيانات الموظف الحالي
            </p>
            {statusLoading ? (
              <p className="text-xs text-gray-500">جاري تحميل الملخص...</p>
            ) : status ? (
              <>
                <p className="text-sm font-semibold text-gray-900">{status.employee?.name || '—'}</p>
                <p className="text-xs text-gray-600">
                  الفرع: {status.employee?.store_name || '—'} (ID: {status.employee?.store || '—'})
                </p>
                <p className="text-xs text-gray-600">الراتب الأساسي: {status.employee?.salary || 0} ج.م</p>

                {status.active_log ? (
                  <div className="mt-2 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    جلسة نشطة منذ: {fmtDateTime(status.active_log.check_in)}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                    لا توجد جلسة مفتوحة الآن.
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-red-600">تعذر تحميل بياناتك.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <p className="text-gray-500">حضور هذا الشهر</p>
              <p className="text-lg font-bold text-gray-900">{status?.month?.present_days ?? '—'} يوم</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <p className="text-gray-500">الغياب المحتسب</p>
              <p className="text-lg font-bold text-gray-900">{status?.month?.absent_days ?? '—'} يوم</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <p className="text-gray-500">إجمالي التأخير</p>
              <p className="text-lg font-bold text-gray-900">{fmtMinutes(status?.month?.late_minutes || 0)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <p className="text-gray-500">الجزاءات</p>
              <p className="text-lg font-bold text-gray-900">{status?.month?.penalties || 0} ج.م</p>
              <p className="text-[11px] text-emerald-700 mt-1">
                صافي تقديري: {status?.month?.estimated_net_salary ?? 0} ج.م
              </p>
            </div>
          </div>
        </section>
        {/* ✅ Mode Toggle */}
        <section className="flex items-center justify-between gap-3 bg-gray-50 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('scan')}
              className={`px-3 py-1.5 text-xs rounded-xl border transition ${
                mode === 'scan'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              مسح QR
            </button>

            <button
              type="button"
              onClick={() => setMode('show_qr')}
              className={`px-3 py-1.5 text-xs rounded-xl border transition ${
                mode === 'show_qr'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              إظهار QR الخاص بي
            </button>

            <button
              type="button"
              onClick={fetchMyAttendanceQr}
              className="px-3 py-1.5 text-xs rounded-xl border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              disabled={meLoading}
              title="تحديث بيانات QR"
            >
              {meLoading ? '...' : 'تحديث'}
            </button>
          </div>

          <p className="text-[11px] text-gray-500">
            * لو GPS مرفوض، الحضور هيتسجل برضه بس بدون موقع.
          </p>
        </section>

        {/* ✅ Notice */}
        <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
          ملاحظة: الباك اند عندك بيعمل Toggle تلقائي (Check-in / Check-out).
        </div>

        {/* ✅ Show Employee QR */}
        {mode === 'show_qr' ? (
          <section className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 text-center space-y-2">
            <p className="text-sm font-semibold">QR الحضور والانصراف الخاص بك</p>

            {meLoading ? (
              <div className="text-xs text-gray-700">جاري تحميل QR الموظف...</div>
            ) : employeeQrExists ? (
              <>
                <img
                  src={`data:image/png;base64,${meAttendance.qr_attendance_base64}`}
                  alt="Employee Attendance QR"
                  className="mx-auto w-48 border rounded-xl bg-white"
                />
                <p className="text-xs text-gray-600">
                  امسح الكود ده من كاميرا الحضور لتسجيل دخول/انصرافك تلقائيًا.
                </p>
                <p className="text-[11px] text-gray-500">
                  الموظف: {meAttendance?.name || '—'} (ID: {meAttendance?.id || '—'})<br />
                  الفرع: {meAttendance?.store_name || '—'} (Store ID: {meAttendance?.store_id || '—'})
                </p>
              </>
            ) : (
              <div className="text-xs text-gray-700">
                لا يوجد QR محفوظ للموظف.
                <br />
                تأكد أن Employee.save عمل generate لـ <b>qr_attendance_base64</b>.
              </div>
            )}
          </section>
        ) : (
          // ✅ Scan Mode
          <section className="grid md:grid-cols-2 gap-4 items-start">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">الكاميرا / ماسح QR</p>

              {!meLoading && !meAttendance?.id ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 text-xs p-4">
                  لا يوجد ملف موظف مرتبط بهذا الحساب. اربط الحساب بموظف (Employee) ثم أعد المحاولة.
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black/80">
                  <Scanner
                    onDecode={handleDecode}
                    onError={handleError}
                    constraints={{ facingMode: 'environment' }}
                    containerStyle={{ width: '100%' }}
                    videoStyle={{ width: '100%' }}
                  />
                </div>
              )}

              <p className="text-[11px] text-gray-500 mt-1">
                امسح QR الخاص بك — أول ما يتقري هيتسجل حضور/انصراف.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">نتيجة آخر عملية</p>

              {processing && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded-2xl px-3 py-2">
                  جاري معالجة الكود...
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-3 py-2">
                  {error}
                </div>
              )}

              {!processing && !error && !result && (
                <div className="bg-gray-50 border border-dashed border-gray-200 text-gray-500 text-xs rounded-2xl px-3 py-6 text-center">
                  لم يتم مسح أي كود بعد.
                </div>
              )}

              {result && (
                <div
                  className={`rounded-2xl px-3 py-3 text-xs border ${
                    isCheckin
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : isCheckout
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  <p className="font-semibold mb-1">{result.message || 'تمت العملية'}</p>

                  <div className="mt-2 space-y-1 text-[11px]">
                    {result.work_date && <p>تاريخ اليوم: {result.work_date}</p>}
                    {result.check_in && <p>وقت الدخول: {fmtDateTime(result.check_in)}</p>}
                    {result.check_out && <p>وقت الخروج: {fmtDateTime(result.check_out)}</p>}

                    {typeof result.is_late !== 'undefined' && result.is_late && (
                      <p>
                        متأخر: {result.late_minutes || 0} دقيقة • غرامة: {result.penalty || 0} ج.م
                      </p>
                    )}

                    {typeof result.duration_minutes !== 'undefined' &&
                      result.duration_minutes !== null && (
                        <p>المدة بالدقائق: {result.duration_minutes}</p>
                      )}
                  </div>

                  <div className="mt-2 text-[11px] text-gray-600">
                    {isCheckin
                      ? 'تم تسجيل دخولك. المرة القادمة هيتم تسجيل الانصراف تلقائيًا.'
                      : isCheckout
                      ? 'تم تسجيل انصرافك. المرة القادمة هيتم تسجيل الحضور تلقائيًا.'
                      : null}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
