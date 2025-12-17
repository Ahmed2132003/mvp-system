// src/pages/POS.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useStore } from '../hooks/useStore';
import { useAuth } from '../hooks/useAuth';

const ORDER_TYPES = {
  DINE_IN: 'DINE_IN',
  TAKEAWAY: 'TAKEAWAY',
  DELIVERY: 'DELIVERY',
};

export default function POS() {
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState(null);

  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [orderType, setOrderType] = useState(ORDER_TYPES.DINE_IN);
  const [selectedTableId, setSelectedTableId] = useState(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [cart, setCart] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusError, setStatusError] = useState(null);

  // Toast بسيط داخلي
  const [toast, setToast] = useState({
    open: false,
    message: '',
    type: 'success', // 'success' | 'error'
  });

  const { selectedStoreId } = useStore();
  const { user } = useAuth();

  const canManageItems =
    user?.is_superuser || ['OWNER', 'MANAGER'].includes(user?.role);

  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [createItemError, setCreateItemError] = useState(null);
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category: '',
    newCategory: '',
    unitPrice: '',
    costPrice: '',
    barcode: '',
    branch: '',
    quantity: '',
  });

  // Theme + Language + مينو الموبايل
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'en'
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAr = lang === 'ar';

  // طبّق الثيم على <html>
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // طبّق اللغة والاتجاه على <html>
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const showToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 3000);
  };

  const resetNewItemForm = useCallback(() => {
    setNewItemForm({
      name: '',
      category: '',
      newCategory: '',
      unitPrice: '',
      costPrice: '',
      barcode: '',
      branch: '',
      quantity: '',
    });
    setCreateItemError(null);
  }, []);

  const fetchCategories = useCallback(async () => {
    if (!selectedStoreId) {
      setCategoryOptions([]);
      setCategories([]);
      return;
    }

    try {
      setCategoriesLoading(true);
      const res = await api.get('/inventory/categories/', {
        params: {
          is_active: true,
          page_size: 200,
        },
      });

      const results = Array.isArray(res.data)
        ? res.data
        : res.data.results || [];

      setCategoryOptions(results);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setCategoriesLoading(false);
    }
  }, [selectedStoreId]);

  const fetchBranches = useCallback(async () => {
    if (!selectedStoreId) {
      setBranches([]);
      return;
    }

    try {
      setBranchesLoading(true);
      const res = await api.get('/branches/');
      const results = Array.isArray(res.data)
        ? res.data
        : res.data.results || [];

      setBranches(results);
    } catch (err) {
      console.error('Error loading branches:', err);
    } finally {
      setBranchesLoading(false);
    }
  }, [selectedStoreId]);

  // --------------------------
  // جلب الأصناف والطاولات
  // --------------------------
  const fetchItems = useCallback(async () => {
    if (!selectedStoreId) {
      setItems([]);
      setCategories([]);
      return;
    }

    try {
      setItemsLoading(true);
      setItemsError(null);

      const res = await api.get('/inventory/items/', {
        params: {
          is_active: true,
          page_size: 100,
        },
      });

      const results = Array.isArray(res.data)
        ? res.data
        : res.data.results || [];

      setItems(results);
    } catch (err) {
      console.error('Error loading items:', err);
      setItemsError(
        isAr
          ? 'حدث خطأ أثناء تحميل قائمة الأصناف'
          : 'An error occurred while loading items list'
      );
    } finally {
      setItemsLoading(false);
    }
  }, [isAr, selectedStoreId]);

  const fetchTables = useCallback(async () => {
    if (!selectedStoreId) {
      setTables([]);      
      return;
    }

    try {
      setTablesLoading(true);
      const res = await api.get('/tables/');

      const results = Array.isArray(res.data)
        ? res.data
        : res.data.results || [];

      setTables(results);
    } catch (err) {
      console.error('Error loading tables:', err);
    } finally {
      setTablesLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchItems();
    fetchTables();
    fetchCategories();
    fetchBranches();
  }, [fetchBranches, fetchCategories, fetchItems, fetchTables]);

  useEffect(() => {
    const categoryNames = new Set(categoryOptions.map((cat) => cat.name));

    items.forEach((item) => {
      if (item.category_name) {
        categoryNames.add(item.category_name);
      }
    });

    setCategories(Array.from(categoryNames));
  }, [categoryOptions, items]);
  
  // --------------------------
  // فلترة الأصناف للعرض
  // --------------------------
  const filteredItems = useMemo(() => {
    let list = items;

    if (selectedCategory !== 'ALL') {
      list = list.filter(
        (item) =>
          item.category_name === selectedCategory ||
          item.category === selectedCategory
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q))
      );
    }

    return list;
  }, [items, selectedCategory, searchTerm]);

  const handleNewItemFieldChange = (field, value) => {
    setNewItemForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!canManageItems) return;

    if (!selectedStoreId) {
      const msg = isAr
        ? 'اختر متجرًا قبل إضافة الأصناف الجديدة.'
        : 'Please select a store before adding new items.';
      setCreateItemError(msg);
      showToast(msg, 'error');
      return;
    }

    const { name, unitPrice, costPrice, barcode, category, newCategory, branch, quantity } = newItemForm;

    if (!name.trim()) {
      const msg = isAr ? 'اسم الصنف مطلوب.' : 'Item name is required.';
      setCreateItemError(msg);
      showToast(msg, 'error');
      return;
    }

    const numericPrice = Number(unitPrice);
    if (!numericPrice || Number.isNaN(numericPrice) || numericPrice <= 0) {
      const msg = isAr
        ? 'سعر البيع يجب أن يكون رقمًا أكبر من صفر.'
        : 'Unit price must be a number greater than zero.';
      setCreateItemError(msg);
      showToast(msg, 'error');
      return;
    }

    setCreatingItem(true);
    setCreateItemError(null);

    try {
      let categoryId = category || null;

      if (!categoryId && newCategory.trim()) {
        const catRes = await api.post('/inventory/categories/', {
          name: newCategory.trim(),
          store: selectedStoreId,
        });
        categoryId = catRes.data?.id;
        await fetchCategories();
      }

      const payload = {
        name: name.trim(),
        unit_price: numericPrice,
        cost_price: costPrice ? Number(costPrice) : null,
        barcode: barcode?.trim() || null,
        category: categoryId || null,
        is_active: true,
      };

      const itemRes = await api.post('/inventory/items/', payload);
      const itemId = itemRes.data?.id;

      if (itemId && branch && Number(quantity) > 0) {
        await api.post('/inventory/', {
          item_id: itemId,
          branch,
          quantity: Number(quantity),
          min_stock: 0,
        });
      }

      showToast(
        isAr
          ? 'تم إضافة الصنف للمخزون والمنيو وهو ظاهر الآن في شاشة الكاشير.'
          : 'Item added to inventory/menu and now visible in POS.'
      );
      setNewItemModalOpen(false);
      resetNewItemForm();
      fetchItems();
    } catch (err) {
      console.error('Error creating item:', err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.name?.[0] ||
        err.response?.data?.unit_price?.[0] ||
        (isAr
          ? 'تعذر إضافة الصنف، تأكد من البيانات والمحاولة مرة أخرى.'
          : 'Unable to add the item. Please review the data and try again.');
      setCreateItemError(msg);
      showToast(msg, 'error');
    } finally {
      setCreatingItem(false);
    }
  };

  // --------------------------
  // إدارة الـ Cart
    // --------------------------

  const handleAddToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((row) => row.itemId === item.id);
      const price = Number(item.unit_price || item.price || 0);

      if (existing) {
        return prev.map((row) =>
          row.itemId === item.id
            ? {
                ...row,
                quantity: row.quantity + 1,
                subtotal: (row.quantity + 1) * row.unitPrice,
              }
            : row
        );
      }

      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          unitPrice: price,
          quantity: 1,
          subtotal: price,
        },
      ];
    });
  };

  const handleChangeQuantity = (itemId, delta) => {
    setCart((prev) =>
      prev
        .map((row) => {
          if (row.itemId !== itemId) return row;
          const newQty = row.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...row,
            quantity: newQty,
            subtotal: newQty * row.unitPrice,
          };
        })
        .filter(Boolean)
    );
  };

  const handleRemoveFromCart = (itemId) => {
    setCart((prev) => prev.filter((row) => row.itemId !== itemId));
  };

  const handleClearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setSelectedTableId(null);
    setOrderType(ORDER_TYPES.DINE_IN);
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, row) => sum + row.subtotal, 0),
    [cart]
  );

  const total = subtotal;

  // --------------------------
  // إنشاء الطلب + الدفع كاش
  // --------------------------
  const createOrderPayload = () => {
    return {
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      table: orderType === ORDER_TYPES.DINE_IN ? selectedTableId : null,
      notes,
      status: 'PENDING',
      items_write: cart.map((row) => ({
        item: row.itemId,
        quantity: row.quantity,
      })),
    };
  };

  const submitOrder = async (payNow = false) => {
    if (cart.length === 0) {
      const msg = isAr
        ? 'لا يمكن حفظ طلب بدون أصناف.'
        : 'Cannot save an order without items.';
      setStatusError(msg);
      setStatusMessage(null);
      showToast(msg, 'error');
      return;
    }

    if (orderType === ORDER_TYPES.DINE_IN && !selectedTableId) {
      const msg = isAr
        ? 'من فضلك اختر طاولة (للطلبات داخل المحل).'
        : 'Please select a table for dine-in orders.';
      setStatusError(msg);
      setStatusMessage(null);
      showToast(msg, 'error');
      return;
    }

    setSaving(true);
    setStatusError(null);
    setStatusMessage(null);

    try {
      const payload = createOrderPayload();
      const res = await api.post('/orders/', payload);
      const order = res.data;

      if (payNow && order?.id) {
        await api.patch(`/orders/${order.id}/`, { status: 'PAID' });
      }

      const msg = payNow
        ? isAr
          ? `تم إنشاء الطلب #${order.id} وتأكيد الدفع كاش بنجاح.`
          : `Order #${order.id} created and marked as PAID (cash).`
        : isAr
        ? `تم حفظ الطلب #${order.id} كمسودة (PENDING).`
        : `Order #${order.id} saved as draft (PENDING).`;

      setStatusMessage(msg);
      showToast(msg, 'success');
      handleClearCart();
    } catch (err) {
      console.error('Error saving order:', err);
      const msg = isAr
        ? 'حدث خطأ أثناء حفظ الطلب، حاول مرة أخرى.'
        : 'An error occurred while saving the order, please try again.';
      setStatusError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // --------------------------
  // UI helpers
  // --------------------------
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setLanguage = (lng) => {
    setLang(lng);
  };

  const renderOrderTypeButtons = () => (
    <div className="flex gap-2 mb-3">
      <button
        type="button"
        onClick={() => setOrderType(ORDER_TYPES.DINE_IN)}
        className={`flex-1 py-2 rounded-2xl text-xs font-semibold border ${
          orderType === ORDER_TYPES.DINE_IN
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-200 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100'
        }`}
      >
        {isAr ? 'داخل المحل' : 'Dine-in'}
      </button>
      <button
        type="button"
        onClick={() => setOrderType(ORDER_TYPES.TAKEAWAY)}
        className={`flex-1 py-2 rounded-2xl text-xs font-semibold border ${
          orderType === ORDER_TYPES.TAKEAWAY
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-200 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100'
        }`}
      >
        {isAr ? 'تيك أواي' : 'Takeaway'}
      </button>
      <button
        type="button"
        onClick={() => setOrderType(ORDER_TYPES.DELIVERY)}
        className={`flex-1 py-2 rounded-2xl text-xs font-semibold border ${
          orderType === ORDER_TYPES.DELIVERY
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-200 dark:bg-slate-950 dark:border-slate-700 dark:text-gray-100'
        }`}
      >
        {isAr ? 'دليفري' : 'Delivery'}
      </button>
    </div>
  );

  const renderCart = () => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 flex flex-col h-full">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          {isAr ? 'ملخص الطلب' : 'Order summary'}
        </h2>
        {renderOrderTypeButtons()}
      </div>

      {/* بيانات العميل */}
      <div className="space-y-2 mb-3">
        <input
          type="text"
          placeholder={
            isAr ? 'اسم العميل (اختياري)' : 'Customer name (optional)'
          }
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:text-gray-100"
        />
        <input
          type="text"
          placeholder={
            isAr ? 'رقم الهاتف (اختياري)' : 'Phone number (optional)'
          }
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="w-full text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:text-gray-100"
        />
        <textarea
          placeholder={
            isAr
              ? 'ملاحظات على الطلب (اختياري)'
              : 'Order notes (optional)'
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none dark:bg-slate-950 dark:text-gray-100"
        />
      </div>

      {/* محتوى السلة */}
      <div className="flex-1 overflow-y-auto mb-3 border border-gray-100 dark:border-slate-800 rounded-2xl">
        {cart.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 px-2 text-center">
            {isAr
              ? 'لا توجد أصناف في الطلب بعد.'
              : 'No items in the order yet.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:bg-slate-800">
                <th className="py-2 px-2 text-right font-semibold text-gray-600 dark:text-gray-200">
                  {isAr ? 'الصنف' : 'Item'}
                </th>
                <th className="py-2 px-2 text-center font-semibold text-gray-600 dark:text-gray-200">
                  {isAr ? 'الكمية' : 'Qty'}
                </th>
                <th className="py-2 px-2 text-left font-semibold text-gray-600 dark:text-gray-200">
                  {isAr ? 'الإجمالي' : 'Total'}
                </th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {cart.map((row) => (
                <tr
                  key={row.itemId}
                  className="border-b border-gray-50 dark:border-slate-800"
                >
                  <td className="py-2 px-2 text-right">
                    <div className="font-semibold text-gray-800 dark:text-gray-50">
                      {row.name}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {row.unitPrice.toLocaleString(
                        isAr ? 'ar-EG' : 'en-US'
                      )}{' '}
                      {isAr ? 'ج.م' : 'EGP'}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleChangeQuantity(row.itemId, -1)}
                        className="w-6 h-6 rounded-full border border-gray-300 dark:border-slate-600 flex items-center justify-center text-xs hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-semibold text-gray-800 dark:text-gray-100">
                        {row.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleChangeQuantity(row.itemId, 1)}
                        className="w-6 h-6 rounded-full border border-blue-500 flex items-center justify-center text-xs text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/40"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-left text-gray-800 dark:text-gray-100">
                    {row.subtotal.toLocaleString(
                      isAr ? 'ar-EG' : 'en-US'
                    )}{' '}
                    {isAr ? 'ج.م' : 'EGP'}
                  </td>
                  <td className="py-2 px-2 text-left">
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(row.itemId)}
                      className="text-[11px] text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      {isAr ? 'حذف' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* الإجمالي والأزرار */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            {isAr ? 'المجموع الفرعي' : 'Subtotal'}
          </span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">
            {subtotal.toLocaleString(isAr ? 'ar-EG' : 'en-US')}{' '}
            {isAr ? 'ج.م' : 'EGP'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-900 dark:text-gray-50">
            {isAr ? 'الإجمالي' : 'Total'}
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-50">
            {total.toLocaleString(isAr ? 'ar-EG' : 'en-US')}{' '}
            {isAr ? 'ج.م' : 'EGP'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <button
            type="button"
            disabled={saving || cart.length === 0}
            onClick={() => submitOrder(false)}
            className="flex-1 py-2 rounded-2xl text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
          >
            {isAr ? 'حفظ كمسودة' : 'Save as draft'}
          </button>
          <button
            type="button"
            disabled={saving || cart.length === 0}
            onClick={() => submitOrder(true)}
            className="flex-1 py-2 rounded-2xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {isAr ? 'دفع كاش وتأكيد' : 'Pay cash & confirm'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleClearCart}
          disabled={saving || cart.length === 0}
          className="w-full mt-1 py-2 rounded-2xl text-[11px] font-medium border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/40"
        >
          {isAr ? 'إلغاء الطلب الحالي' : 'Cancel current order'}
        </button>

        {statusMessage && (
          <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-3 py-2 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-200">
            {statusMessage}
          </div>
        )}

        {statusError && (
          <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-2xl px-3 py-2 dark:bg-red-900/20 dark:border-red-700 dark:text-red-200">
            {statusError}
          </div>
        )}
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 flex flex-col h-full">
      {canManageItems && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
          <div className="flex-1 text-[11px] bg-blue-50 border border-blue-100 text-blue-800 rounded-xl px-3 py-2 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100">
            {isAr
              ? 'المدير أو المالك أو السوبر يوزر يقدر يضيف صنف جديد يظهر مباشرة في المخزون والمنيو والكاشير.'
              : 'Managers/owners/superusers can add a new item that shows immediately in inventory, menu, and POS.'}
          </div>
          <button
            type="button"
            onClick={() => {
              resetNewItemForm();
              setNewItemModalOpen(true);
            }}
            className="text-xs px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
          >
            {isAr ? 'إضافة صنف جديد' : 'Add new item'}
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
        <input
          type="text"          
          placeholder={
            isAr
              ? 'ابحث باسم الصنف أو الباركود...'
              : 'Search by item name or barcode...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 text-xs border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:text-gray-100"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-full text-[11px] border ${
            selectedCategory === 'ALL'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-200 dark:bg-slate-950 dark:text-gray-100 dark:border-slate-700'
          }`}
        >
          {isAr ? 'كل الأصناف' : 'All items'}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-[11px] border ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 dark:bg-slate-950 dark:text-gray-100 dark:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {itemsLoading && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
          {isAr ? 'جاري تحميل قائمة الأصناف...' : 'Loading items list...'}
        </div>
      )}

      {itemsError && !itemsLoading && (
        <div className="flex-1 flex items-center justify-center text-xs text-red-600 dark:text-red-300">
          {itemsError}
        </div>
      )}

      {!itemsLoading && !itemsError && filteredItems.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
          {isAr
            ? 'لا توجد أصناف مطابقة لبحثك.'
            : 'No items match your search.'}
        </div>
      )}

      {!itemsLoading && !itemsError && filteredItems.length > 0 && (
        <div className="flex-1 overflow-y-auto mt-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAddToCart(item)}
                className="text-right bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 dark:bg-slate-950 dark:border-slate-800 dark:hover:bg-slate-800 rounded-2xl p-3 flex flex-col justify-between min-h-[90px]"
              >
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-50 truncate">
                    {item.name}
                  </p>
                  {item.category_name && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.category_name}
                    </p>
                  )}
                </div>
                <div className="mt-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                  {(item.unit_price || item.price || 0).toLocaleString(
                    isAr ? 'ar-EG' : 'en-US'
                  )}{' '}
                  {isAr ? 'ج.م' : 'EGP'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderTables = () => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {isAr ? 'الطاولات' : 'Tables'}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1 dark:text-gray-400">
            {isAr
              ? 'اختر طاولة للطلبات داخل المحل'
              : 'Select a table for dine-in orders'}
          </p>
        </div>
      </div>

      {tablesLoading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
          {isAr ? 'جاري تحميل الطاولات...' : 'Loading tables...'}
        </div>
      ) : tables.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 text-center px-2">
          {isAr
            ? 'لا توجد طاولات مُسجلة لهذا الفرع.'
            : 'No tables found for this branch.'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {tables.map((table) => {
              const isSelected = selectedTableId === table.id;
              const isAvailable = table.is_available !== false;
              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() =>
                    isAvailable ? setSelectedTableId(table.id) : null
                  }
                  className={`rounded-2xl border p-3 text-right text-xs flex flex-col gap-1 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-950'
                  } ${
                    !isAvailable
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-blue-50/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-semibold text-gray-900 dark:text-gray-50">
                    {isAr ? `طاولة ${table.number}` : `Table ${table.number}`}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {isAr
                      ? `السعة: ${table.capacity} أفراد`
                      : `Capacity: ${table.capacity} guests`}
                  </span>
                  <span
                    className={`inline-flex w-fit mt-1 px-2 py-0.5 rounded-full text-[10px] ${
                      isAvailable
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                    }`}
                  >
                    {isAvailable
                      ? isAr
                        ? 'متاحة'
                        : 'Available'
                      : isAr
                      ? 'غير متاحة'
                      : 'Unavailable'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
        {isAr
          ? '* لاحقًا: هنربط حالة الطاولة أوتوماتيك مع الحجوزات والطلبات المفتوحة.'
          : '* Later: table status will be synced automatically with reservations and open orders.'}
      </div>
    </div>
  );

  // --------------------------
  // الـ Layout العام
  // --------------------------
  const pageTitle = isAr ? 'شاشة الكاشير (POS)' : 'Cashier Screen (POS)';
  const pageSubtitle = isAr
    ? 'إنشاء الطلبات بسرعة، اختيار الأصناف، وتأكيد الدفع في خطوة واحدة.'
    : 'Create orders quickly, select items, and confirm payment in one flow.';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:text-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800">
            <h1 className="text-xl font-bold text-primary">MVP POS</h1>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
              {isAr ? 'شاشة الكاشير / نقطة البيع' : 'Cashier / Point of sale'}
            </p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <Link
              to="/dashboard"
              className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
            >
              {isAr ? 'الداشبورد' : 'Dashboard'}
            </Link>

            <Link
              to="/pos"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <span>
                {isAr ? 'شاشة الكاشير (POS)' : 'Cashier Screen (POS)'}
              </span>
              <span className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
                {isAr ? 'جارية' : 'Active'}
              </span>
            </Link>

            <Link
              to="/users/create"
              className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
            >
              {isAr ? 'إدارة المستخدمين' : 'User management'}
            </Link>
          </nav>

          <div className="px-4 py-4 border-t border-gray-200 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400">
            {isAr
              ? 'نسخة تجريبية • جاهز للاستخدام اليومي 💳'
              : 'Trial version • Ready for daily usage 💳'}
          </div>
        </aside>

        {/* Sidebar - Mobile (Overlay) */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden" aria-modal="true">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative ml-auto h-full w-64 bg-white dark:bg-slate-900 shadow-xl border-l border-gray-200 dark:border-slate-800 flex flex-col">
              <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-primary">MVP POS</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5 dark:text-gray-400">
                    {isAr ? 'القائمة الرئيسية' : 'Main menu'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="inline-flex items-center justify-center rounded-full p-1.5 border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                >
                  <span className="sr-only">
                    {isAr ? 'إغلاق القائمة' : 'Close menu'}
                  </span>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    fill="none"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <Link
                  to="/dashboard"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
                >
                  {isAr ? 'الداشبورد' : 'Dashboard'}
                </Link>
                <Link
                  to="/pos"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  <span>{pageTitle}</span>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
                    {isAr ? 'جارية' : 'Active'}
                  </span>
                </Link>
                <Link
                  to="/users/create"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex items-center px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition dark:text-gray-200 dark:hover:bg-slate-800"
                >
                  {isAr ? 'إدارة المستخدمين' : 'User management'}
                </Link>
              </nav>

              <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400">
                {isAr
                  ? 'نسخة تجريبية • جاهز للاستخدام 💳'
                  : 'Trial version • Ready to use 💳'}
              </div>
            </div>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              {/* زر القائمة للموبايل */}
              <button
                type="button"
                className="inline-flex md:hidden items-center justify-center rounded-xl border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <span className="sr-only">
                  {isAr ? 'فتح القائمة' : 'Open menu'}
                </span>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  fill="none"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <div>
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {pageTitle}
                </h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {pageSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Language switcher */}
              <div className="flex items-center text-[11px] border border-gray-200 rounded-full overflow-hidden dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
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
                  onClick={() => setLanguage('ar')}
                  className={`px-2 py-1 ${
                    isAr
                      ? 'bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
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
                    <span className="hidden sm:inline">
                      {isAr ? 'وضع فاتح' : 'Light'}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px]">
                    <span>🌙</span>
                    <span className="hidden sm:inline">
                      {isAr ? 'وضع داكن' : 'Dark'}
                    </span>
                  </span>
                )}
              </button>

              <Link
                to="/dashboard"
                className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
              >
                {isAr ? '← العودة للداشبورد' : '← Back to dashboard'}
              </Link>
            </div>
          </header>

          {/* محتوى الـ POS */}
          <div className="px-4 md:px-8 py-4 md:py-6 max-w-7xl mx-auto w-full">
            {itemsError && (
              <div className="mb-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-2xl px-3 py-2 dark:bg-red-900/20 dark:border-red-700 dark:text-red-200">
                {itemsError}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-12">
              {/* ملخص الطلب */}
              <div className="lg:col-span-4 md:h-[calc(100vh-170px)] h-auto">
                {renderCart()}
              </div>

              {/* قائمة الأصناف */}
              <div className="lg:col-span-5 md:h-[calc(100vh-170px)] h-auto">
                {renderProducts()}
              </div>

              {/* الطاولات */}
              <div className="lg:col-span-3 md:h-[calc(100vh-170px)] h-auto">
                {renderTables()}
              </div>
            </div>
          </div>
        </main>
      </div>

      {newItemModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {isAr ? 'إضافة صنف جديد' : 'Add a new item'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isAr
                    ? 'املأ البيانات وسيتم إنشاء الصنف مع تحديث المخزون والمنيو فورًا.'
                    : 'Fill the fields to create the item and update inventory/menu instantly.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewItemModalOpen(false);
                  resetNewItemForm();
                }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>

            {createItemError && (
              <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 dark:bg-red-900/20 dark:border-red-700 dark:text-red-200">
                {createItemError}
              </div>
            )}

            <form className="space-y-3" onSubmit={handleCreateItem}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                    {isAr ? 'اسم الصنف' : 'Item name'}
                  </label>
                  <input
                    type="text"
                    value={newItemForm.name}
                    onChange={(e) => handleNewItemFieldChange('name', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-100"
                    placeholder={isAr ? 'مثال: شاي نعناع' : 'e.g., Mint tea'}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                    {isAr ? 'سعر البيع' : 'Unit price'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItemForm.unitPrice}
                    onChange={(e) => handleNewItemFieldChange('unitPrice', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-100"
                    placeholder={isAr ? 'سعر البيع' : 'Selling price'}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                    {isAr ? 'التصنيف' : 'Category'}
                  </label>
                  <select
                    value={newItemForm.category}
                    onChange={(e) => handleNewItemFieldChange('category', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-100"
                  >
                    <option value="">
                      {isAr ? 'اختر تصنيفًا موجودًا' : 'Choose an existing category'}
                    </option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {categoriesLoading && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      {isAr ? 'جاري تحميل التصنيفات...' : 'Loading categories...'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                    {isAr ? 'تصنيف جديد (اختياري)' : 'New category (optional)'}
                  </label>
                  <input
                    type="text"
                    value={newItemForm.newCategory}
                    onChange={(e) => handleNewItemFieldChange('newCategory', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-100"
                    placeholder={isAr ? 'سيتم إنشاؤه تلقائيًا' : 'Will be created automatically'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                    {isAr ? 'سعر التكلفة (اختياري)' : 'Cost price (optional)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItemForm.costPrice}
                    onChange={(e) => handleNewItemFieldChange('costPrice', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-100"
                    placeholder={isAr ? 'تكلفة الشراء' : 'Purchase cost'}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                    {isAr ? 'باركود (اختياري)' : 'Barcode (optional)'}
                  </label>
                  <input
                    type="text"
                    value={newItemForm.barcode}
                    onChange={(e) => handleNewItemFieldChange('barcode', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-100"
                    placeholder={isAr ? 'امسح أو اكتب الكود' : 'Scan or type the code'}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                    {isAr ? 'الفرع للمخزون (اختياري)' : 'Branch for stock (optional)'}
                  </label>
                  <select
                    value={newItemForm.branch}
                    onChange={(e) => handleNewItemFieldChange('branch', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-100"
                  >
                    <option value="">
                      {isAr ? 'بدون تحديث مخزون الآن' : 'Skip stock update now'}
                    </option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  {branchesLoading && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      {isAr ? 'جاري تحميل الفروع...' : 'Loading branches...'}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 dark:text-gray-300">
                    {isAr ? 'كمية البدء (اختياري)' : 'Initial quantity (optional)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newItemForm.quantity}
                    onChange={(e) => handleNewItemFieldChange('quantity', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-100"
                    placeholder={isAr ? 'يتم ربطه بالفرع المختار' : 'Linked to selected branch'}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewItemModalOpen(false);
                    resetNewItemForm();
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-100 dark:hover:bg-slate-800"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={creatingItem}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {creatingItem
                    ? isAr
                      ? 'جاري الحفظ...'
                      : 'Saving...'
                    : isAr
                    ? 'حفظ الصنف'
                    : 'Save item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.open && (
        <div className="fixed bottom-4 right-4 z-50">          
          <div
            className={`max-w-xs rounded-2xl shadow-lg px-4 py-3 text-sm border-l-4 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-600 dark:text-emerald-100'
                : 'bg-red-50 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-100'
            }`}
          >
            <p className="font-semibold mb-1">
              {toast.type === 'success'
                ? isAr
                  ? 'تم بنجاح'
                  : 'Success'
                : isAr
                ? 'حدث خطأ'
                : 'Error'}
            </p>
            <p>{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
