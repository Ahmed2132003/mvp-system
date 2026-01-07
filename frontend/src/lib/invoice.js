const formatOrderTypeLabel = (orderType, isAr) => {
  const map = {
    IN_STORE: isAr ? 'داخل المحل' : 'Dine-in',
    DELIVERY: isAr ? 'دليفري' : 'Delivery',
    TAKEAWAY: isAr ? 'تيك أواي' : 'Takeaway',
  };
  return map[orderType] || orderType || '';
};

const formatCurrency = (value, isAr) =>
  Number(value || 0).toLocaleString(isAr ? 'ar-EG' : 'en-US');

export const buildInvoiceHtml = (invoice, isAr = false) => {
  if (!invoice) return '';

  const itemsRows = (invoice.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${item.item_name || ''}</td>
          <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e5e7eb;">${item.quantity}</td>
          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatCurrency(item.subtotal, isAr)} ${isAr ? 'ج.م' : 'EGP'}</td>
        </tr>
      `
    )
    .join('');

  const metaLines = [
    invoice.store_name && `${isAr ? 'المتجر' : 'Store'}: ${invoice.store_name}`,
    invoice.store_address && `${isAr ? 'العنوان' : 'Address'}: ${invoice.store_address}`,
    invoice.store_phone && `${isAr ? 'التليفون' : 'Phone'}: ${invoice.store_phone}`,
    invoice.branch_name && `${isAr ? 'الفرع' : 'Branch'}: ${invoice.branch_name}`,
    invoice.table_number && `${isAr ? 'الطاولة' : 'Table'}: ${invoice.table_number}`,
    invoice.customer_name && `${isAr ? 'العميل' : 'Customer'}: ${invoice.customer_name}`,
    invoice.customer_phone && `${isAr ? 'الهاتف' : 'Phone'}: ${invoice.customer_phone}`,
    invoice.delivery_address && `${isAr ? 'العنوان' : 'Address'}: ${invoice.delivery_address}`,
    invoice.notes && `${isAr ? 'ملاحظات' : 'Notes'}: ${invoice.notes}`,    
  ]
    .filter(Boolean)
    .map((line) => `<div style="margin-bottom:4px;">${line}</div>`)
    .join('');

  return `
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
      <head>
        <meta charset="utf-8" />
        <title>${invoice.invoice_number || 'Invoice'}</title>
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; padding:16px; color:#0f172a; background:#f8fafc;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <h2 style="margin:0 0 4px;font-size:18px;">${isAr ? 'فاتورة' : 'Invoice'}</h2>
              <div style="color:#475569;font-size:13px;">${invoice.invoice_number || ''}</div>
              <div style="color:#64748b;font-size:12px;margin-top:4px;">${formatOrderTypeLabel(invoice.order_type, isAr)}</div>
            </div>
            <div style="text-align:${isAr ? 'left' : 'right'};font-size:12px;color:#475569;">
              ${invoice.order_created_at ? new Date(invoice.order_created_at).toLocaleString(isAr ? 'ar-EG' : 'en-US') : ''}
            </div>
          </div>

          <div style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:13px;line-height:1.5;">
            ${metaLines}
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px;text-align:${isAr ? 'right' : 'left'};">${isAr ? 'الصنف' : 'Item'}</th>
                <th style="padding:8px;text-align:center;">${isAr ? 'الكمية' : 'Qty'}</th>
                <th style="padding:8px;text-align:${isAr ? 'left' : 'right'};">${isAr ? 'الإجمالي' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-weight:700;">
            <div>
              <div style="font-weight:600;color:#0f172a;">${isAr ? 'صافي الأصناف' : 'Subtotal'}</div>
              <div style="font-size:12px;color:#475569;">${formatCurrency(invoice.subtotal, isAr)} ${isAr ? 'ج.م' : 'EGP'}</div>
            </div>
            <div style="text-align:${isAr ? 'left' : 'right'};">
              <div style="font-weight:600;color:#0f172a;">${isAr ? 'الضريبة' : 'Tax'} (${Number(invoice.tax_rate || 0).toFixed(2)}%)</div>
              <div style="font-size:12px;color:#475569;">${formatCurrency(invoice.tax_amount, isAr)} ${isAr ? 'ج.م' : 'EGP'}</div>
            </div>
            <div style="text-align:${isAr ? 'left' : 'right'};">
              <div style="font-weight:700;color:#0f172a;">${isAr ? 'الإجمالي المستحق' : 'Amount due'}</div>
              <div style="font-size:13px;color:#1f2937;">${formatCurrency(invoice.total, isAr)} ${isAr ? 'ج.م' : 'EGP'}</div>
            </div>
          </div>          
        </div>
      </body>
    </html>
  `;
};

export const openInvoicePrintWindow = (invoice, isAr = false) => {
  if (!invoice) return;
  const html = buildInvoiceHtml(invoice, isAr);
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};