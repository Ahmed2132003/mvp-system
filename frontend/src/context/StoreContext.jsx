/* eslint-disable react-refresh/only-export-components */

// src/context/StoreContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api from '../lib/api';
import { notifyError } from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';

const StoreContext = createContext();

export const StoreProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(() =>
    localStorage.getItem('selected_store_id') || null
  );
  const storesRef = useRef([]);

  const persistSelectedStore = useCallback((storeId, storeName) => {
    if (storeId) {
      localStorage.setItem('selected_store_id', storeId);
      if (storeName) {
        localStorage.setItem('selected_store_name', storeName);
      }
    } else {
      localStorage.removeItem('selected_store_id');
      localStorage.removeItem('selected_store_name');
    }
  }, []);

  const selectStore = useCallback(
    (storeId) => {
      const idAsString = storeId ? String(storeId) : null;
      setSelectedStoreId(idAsString);

      const selectedStore = storesRef.current.find((s) => String(s.id) === idAsString);
      persistSelectedStore(idAsString, selectedStore?.name);
    },
    [persistSelectedStore]
  );

  const fetchStores = useCallback(async () => {
    if (!isAuthenticated) {
      storesRef.current = [];
      setStores([]);
      selectStore(null);
      return;
    }

    try {
      setStoresLoading(true);
      setStoresError(null);

      const res = await api.get('/stores/');      
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      storesRef.current = data;
      setStores(data);
      
      const storedId = localStorage.getItem('selected_store_id');
      const matched = data.find((s) => String(s.id) === storedId);

      const firstId = data[0]?.id ? String(data[0].id) : null;
      const nextSelectedId = matched ? storedId : firstId;

      if (nextSelectedId) {
        selectStore(nextSelectedId);
      } else {
        selectStore(null);
      }
    } catch (err) {
      console.error('Error loading stores:', err);
      setStoresError('تعذر تحميل الفروع المتاحة لهذا الحساب');
      notifyError('تعذر تحميل الفروع المتاحة لهذا الحساب');
    } finally {
      setStoresLoading(false);
    }
  }, [isAuthenticated, selectStore]);

  useEffect(() => {
    if (!authLoading) {
      fetchStores();
    }
  }, [authLoading, fetchStores]);

  const selectedStore = useMemo(
    () => stores.find((s) => String(s.id) === selectedStoreId),
    [selectedStoreId, stores]
  );

  return (
    <StoreContext.Provider
      value={{
        stores,
        storesLoading,
        storesError,
        selectedStoreId,
        selectedStore,
        selectStore,
        refreshStores: fetchStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreContext = () => useContext(StoreContext);

export default StoreContext;