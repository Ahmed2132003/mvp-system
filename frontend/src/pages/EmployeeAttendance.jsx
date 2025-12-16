import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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

function fmtTime(value) {
  if (!value) return '—';
  try {
    const d = new Date(`1970-01-01T${value}`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(value);
  }
}

function renderLocation(loc) {
  if (!loc?.lat || !loc?.lng) return '—';
  const accuracy = loc.accuracy ? ` (±${Math.round(loc.accuracy)}م)` : '';
  return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}${accuracy}`;
}

export default function EmployeeAttendance() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState(null);

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

  useEffect(() => {
    fetchMyStatus();
  }, [fetchMyStatus]);

  const handleSubmit = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const location = await getGeoLocation();
      if (!location?.lat || !location?.lng) {
        throw new Error('يجب تفعيل الموقع لتسجيل الحضور أو الانصراف.');
      }

      const payload = { gps: location };
      console.log('[Attendance] POST /attendance/check payload:', payload);

      const res = await api.post('/attendance/check/', payload);
      console.log('[Attendance] Response:', res?.status, res?.data);

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
        gps: res.data.gps || payload.gps,
      });

      fetchMyStatus();
      notifySuccess(res.data.message || 'تم تسجيل العملية بنجاح');
    } catch (err) {
      const statusCode = err?.response?.status;
      const data = err?.response?.data;
      console.error('[Attendance] Error:', statusCode, data, err);

      const msg =
        data?.message ||
        data?.detail ||
        err.message ||
        'حدث خطأ أثناء تسجيل الحضور/الانصراف.';

      setError(msg);

      if (statusCode === 401) {
        notifyError('غير مصرح: برجاء تسجيل الدخول مرة أخرى.');
      } else {
        notifyError(msg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const isCheckin = result?.status === 'checkin';
  const isCheckout = result?.status === 'checkout';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">تسجيل حضور الموظفين</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              اضغط على الزر لتسجيل الدخول أو الانصراف. يجب تفعيل الموقع وسيتم تسجيل التأخير والخصومات تلقائيًا.
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

        {status?.month?.late_minutes > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            تنبيه: لديك إجمالي تأخير {fmtMinutes(status.month.late_minutes)} هذا الشهر. يرجى الالتزام بموعد الشفت لتجنب خصومات إضافية.
          </div>
        )}

        {status?.shift?.start && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-900 text-xs px-4 py-3 flex flex-col gap-1">
            <span className="font-semibold text-sm">موعد الشفت اليومي</span>
            <span>
              يبدأ عند: {fmtTime(status.shift.start)} • سماحية التأخير: {status.shift.grace_minutes ?? 0} دقيقة
            </span>
            <span className="text-[11px] text-indigo-800">
              غرامة كل 15 دقيقة تأخير: {status.shift.penalty_per_15min ?? 0} ج.م
            </span>
          </div>
        )}

        {/* ✅ تعليمات */}
        <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
          ملاحظة: الضغط على الزر يقوم تلقائيًا بتحديد ما إذا كنت تحتاج تسجيل حضور أو انصراف بناءً على آخر جلسة.
        </div>

        {/* ✅ ملخص مالي تقديري */}
        <section className="grid md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-1">
            <p className="text-gray-500">قيمة اليوم الواحد</p>
            <p className="text-lg font-bold text-gray-900">{status?.month?.daily_rate?.toFixed?.(2) ?? '0.00'} ج.م</p>
            <p className="text-[11px] text-gray-500">(الراتب ÷ 30 يوماً)</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-1">
            <p className="text-gray-500">قيمة أيام الحضور</p>
            <p className="text-lg font-bold text-gray-900">{status?.month?.attendance_value?.toFixed?.(2) ?? '0.00'} ج.م</p>
            <p className="text-[11px] text-gray-500">عدد الأيام × قيمة اليوم</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-1">
            <p className="text-gray-500">خصم الغياب</p>
            <p className="text-lg font-bold text-red-600">-{status?.month?.absence_penalties?.toFixed?.(2) ?? '0.00'} ج.م</p>
            <p className="text-[11px] text-gray-500">حسب الغياب من 1 إلى 30 في الشهر</p>
          </div>
        </section>


        {/* ✅ زر تسجيل الحضور/الانصراف */}
        <section className="grid md:grid-cols-2 gap-4 items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-700">تسجيل حضور/انصراف</p>
            <p className="text-[11px] text-gray-500">سيتم طلب إذن الموقع قبل إرسال الطلب.</p>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={processing}
              className={`w-full text-sm font-semibold rounded-2xl px-4 py-3 border transition ${
                processing
                  ? 'bg-gray-200 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {processing ? 'جاري التسجيل...' : 'تسجيل الآن'}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">نتيجة آخر عملية</p>

            {!processing && !error && !result && (
              <div className="bg-gray-50 border border-dashed border-gray-200 text-gray-500 text-xs rounded-2xl px-3 py-6 text-center">
                لم يتم تسجيل أي عملية بعد.
              </div>
            )}

            {processing && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded-2xl px-3 py-2">
                جاري تسجيل الحضور/الانصراف...
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

                  {result.gps && <p>الموقع المسجل: {renderLocation(result.gps)}</p>}
                </div>

                <div className="mt-2 text-[11px] text-gray-600">
                  {isCheckin
                    ? 'تم تسجيل دخولك. المرة القادمة سيتم تسجيل الانصراف تلقائيًا.'
                    : isCheckout
                    ? 'تم تسجيل انصرافك. المرة القادمة سيتم تسجيل الحضور تلقائيًا.'
                    : null}
                  {result?.is_late && (
                    <div className="text-red-600 mt-2">تنبيه: تم رصد تأخير في هذه العملية. الرجاء الالتزام بموعد الشفت.</div>
                  )}
                </div>
              </div>
            )}            
          </div>
        </section>
      </div>
    </div>
  );
}