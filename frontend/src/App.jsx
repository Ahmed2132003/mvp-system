// src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute';

// الصفحات
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateUser from './pages/CreateUser';   
import POS from './pages/POS'; 
import CustomerMenu from './pages/CustomerMenu';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
// src/App.jsx
import KDS from './pages/KDS';
import InventoryPage from './pages/Inventory.jsx';
import EmployeeAttendance from './pages/EmployeeAttendance.jsx';
import Reservations from './pages/Reservations.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import StoreMenu from './pages/StoreMenu';
import TablesPage from './pages/Tables';
import TableDetails from './pages/TableDetails';
import AdminCreateStore from './pages/AdminCreateStore';
import EmployeeProfile from './pages/EmployeeProfile';
import Employees from './pages/Employees.jsx';
import Accounting from './pages/Accounting.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import HomeRedirect from './pages/HomeRedirect.jsx';
import AdminAccounts from './pages/AdminAccounts.jsx';
import Invoices from './pages/Invoices.jsx';

if (window.location.pathname.startsWith('/admin')) {
  window.location.href = 'http://127.0.0.1:8000/admin/';
}

function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/table/:tableId/menu" element={<CustomerMenu />} />
            <Route path="/store/:storeId/menu" element={<StoreMenu />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomeRedirect />                  
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/users/create"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                  <CreateUser />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pos"
              element={
                <ProtectedRoute>
                  <POS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kds"
              element={
                <ProtectedRoute>
                  <KDS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute>
                  <EmployeeAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reservations"
              element={
                <ProtectedRoute>
                  <Reservations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tables"
              element={
                <ProtectedRoute>
                  <TablesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tables/:tableId"
              element={
                <ProtectedRoute>
                  <TableDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/stores/create"
              element={
                <ProtectedRoute>
                  <AdminCreateStore />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/accounts"
              element={
                <ProtectedRoute superuserOnly>
                  <AdminAccounts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <Employees />
                </ProtectedRoute>
              }
            />

            <Route
              path="/employees/:id"
              element={
                <ProtectedRoute>
                  <EmployeeProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/accounting"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                  <Accounting />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/unauthorized"
              element={
                <ProtectedRoute>
                  <Unauthorized />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>      
    </AuthProvider>
  );
}

export default App;
