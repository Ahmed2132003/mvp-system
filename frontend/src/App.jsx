// src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';

// الصفحات
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateUser from './pages/CreateUser';   
import POS from './pages/POS'; 
import CustomerMenu from './pages/CustomerMenu';
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

if (window.location.pathname.startsWith('/admin')) {
  window.location.href = 'http://127.0.0.1:8000/admin/';
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/table/:tableId/menu" element={<CustomerMenu />} />
          <Route path="/store/:storeId/menu" element={<StoreMenu />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
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
              <ProtectedRoute>
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
            path="/inventory"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
                <Accounting />
              </ProtectedRoute>
            }
          />


          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
