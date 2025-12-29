// src/pages/Invoices.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useStore } from '../hooks/useStore';
import { notifyError } from '../lib/notifications';
import { openInvoicePrintWindow } from '../lib/invoice';

export default function Invoices() {
  const { selectedStoreId } = useStore();

  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'en'
  );
  const isAr = lang === 'ar';

  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [searchNumber, setSearchNumber] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US'),
    [isAr]
  );

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const fetchInvoices = useCallback(async () => {
    if (!selectedStoreId) {
      setInvoices([]);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/orders/invoices/', {
        params: {
          store_id: selectedStoreId,
          invoice_number: searchNumber || undefined,
        },
      });

      const results = Array.isArray(res.data)
        ? res.data
        : res.data.results || [];

      setInvoices(results);

      if (selectedInvoice?.invoice_number) {
        const refreshed = results.find(
          (inv) => inv.invoice_number === selectedInvoice.invoice_number
        );
        if (refreshed) {
          setSelectedInvoice(refreshed);
        }
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
      notifyError(
        isAr
          ? 'تعذر تحميل الفواتير، حاول مرة أخرى.'
          : 'Unable to load invoices. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [isAr, searchNumber, selectedInvoice?.invoice_number, selectedStoreId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const formatOrderType = (type) => {
    if (type === 'DELIVERY') {
      return isAr ? 'دليفري' : 'Delivery';
    }
    return isAr ? 'داخل المحل' : 'In store';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
            {isAr ? 'مراجعة الفواتير' : 'Invoice review'}
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
            {isAr
              ? 'اطلع على كل الفواتير وابحث برقم الفاتورة.'
              : 'Browse all invoices and search by invoice number.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center text-[11px] border border-gray-200 rounded-full overflow-hidden dark:border-slate-700">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-1 ${
                !isAr
                  ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`px-2 py-1 ${
                isAr
                  ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              AR
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
            }
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link
            to="/pos"
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            {isAr ? '← العودة للكاشير' : '← Back to POS'}
          </Link>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                placeholder={
                  isAr ? 'ابحث برقم الفاتورة...' : 'Search by invoice number...'
                }
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                className="flex-1 text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={fetchInvoices}
                className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                {isAr ? 'تصفية' : 'Filter'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchNumber('');
                  fetchInvoices();
                }}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
              >
                {isAr ? 'مسح' : 'Clear'}
              </button>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {isAr
                ? `${invoices.length} فاتورة`
                : `${invoices.length} invoices`}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden">
              {loading ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-300">
                  {isAr ? 'جاري التحميل...' : 'Loading...'}
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-300">
                  {isAr ? 'لا توجد فواتير مطابقة.' : 'No invoices found.'}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                      <th className="py-2 px-2 text-right">
                        {isAr ? 'الفاتورة' : 'Invoice'}
                      </th>
                      <th className="py-2 px-2 text-center">
                        {isAr ? 'الطلب' : 'Order'}
                      </th>
                      <th className="py-2 px-2 text-center">
                        {isAr ? 'النوع' : 'Type'}
                      </th>
                      <th className="py-2 px-2 text-left">
                        {isAr ? 'الإجمالي' : 'Total'}
                      </th>
                      <th className="py-2 px-2 text-left" />
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr
                        key={inv.invoice_number}
                        className="border-t border-gray-100 dark:border-slate-800"
                      >
                        <td className="py-2 px-2 text-right">
                          <div className="font-semibold text-gray-900 dark:text-gray-50">
                            {inv.invoice_number}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            {inv.branch_name || (isAr ? 'المتجر' : 'Store')}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">#{inv.order_id}</td>
                        <td className="py-2 px-2 text-center">
                          {formatOrderType(inv.order_type)}
                        </td>
                        <td className="py-2 px-2 text-left text-gray-900 dark:text-gray-50">
                          {numberFormatter.format(Number(inv.total || 0))}{' '}
                          {isAr ? 'ج.م' : 'EGP'}
                        </td>
                        <td className="py-2 px-2 text-left">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                            >
                              {isAr ? 'عرض' : 'View'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openInvoicePrintWindow(inv, isAr)}
                              className="text-[11px] px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-900/30"
                            >
                              {isAr ? 'طباعة' : 'Print'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border border-gray-100 dark:border-slate-800 rounded-2xl p-3">
              {selectedInvoice ? (
                <div className="space-y-2 text-xs text-gray-700 dark:text-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {isAr ? 'تفاصيل الفاتورة' : 'Invoice details'}
                    </p>
                    <button
                      type="button"
                      onClick={() => openInvoicePrintWindow(selectedInvoice, isAr)}
                      className="text-[11px] px-3 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isAr ? 'حفظ/طباعة' : 'Save / Print'}
                    </button>
                  </div>
                  <p>
                    {isAr ? 'رقم الفاتورة:' : 'Invoice:'}{' '}
                    <span className="font-semibold">
                      {selectedInvoice.invoice_number}
                    </span>
                  </p>
                  <p>
                    {isAr ? 'رقم الطلب:' : 'Order:'} #{selectedInvoice.order_id}
                  </p>
                  <p>
                    {isAr ? 'النوع:' : 'Type:'} {formatOrderType(selectedInvoice.order_type)}
                  </p>
                  <p>
                    {isAr ? 'الإجمالي:' : 'Total:'}{' '}
                    {numberFormatter.format(Number(selectedInvoice.total || 0))}{' '}
                    {isAr ? 'ج.م' : 'EGP'}
                  </p>
                  {selectedInvoice.customer_name && (
                    <p>
                      {isAr ? 'العميل:' : 'Customer:'} {selectedInvoice.customer_name}
                    </p>
                  )}
                  {selectedInvoice.customer_phone && (
                    <p>
                      {isAr ? 'الهاتف:' : 'Phone:'} {selectedInvoice.customer_phone}
                    </p>
                  )}
                  {selectedInvoice.delivery_address && (
                    <p>
                      {isAr ? 'العنوان:' : 'Address:'} {selectedInvoice.delivery_address}
                    </p>
                  )}
                  <div className="border-t border-gray-100 dark:border-slate-800 pt-2">
                    <p className="font-semibold mb-1">
                      {isAr ? 'الأصناف' : 'Items'}
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {(selectedInvoice.items || []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="font-semibold text-gray-900 dark:text-gray-50">
                            {item.item_name}
                          </span>
                          <span className="text-gray-600 dark:text-gray-300">
                            {item.quantity} ×{' '}
                            {numberFormatter.format(Number(item.subtotal || 0))}{' '}
                            {isAr ? 'ج.م' : 'EGP'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isAr
                    ? 'اختر فاتورة من القائمة لعرض تفاصيلها.'
                    : 'Select an invoice from the list to view its details.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}