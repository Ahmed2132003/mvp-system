// src/hooks/useStore.js
import { useContext } from 'react';
import StoreContext from '../context/StoreContext.jsx';

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
};

export default useStore;