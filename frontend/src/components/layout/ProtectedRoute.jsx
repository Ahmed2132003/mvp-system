import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const BlockedAccess = ({ reason }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div className="max-w-lg w-full bg-white shadow-lg border border-red-200 rounded-2xl p-8 text-center space-y-4">
      <div className="text-3xl">⛔</div>
      <h2 className="text-xl font-bold text-red-700">تم إيقاف الوصول</h2>
      <p className="text-sm text-gray-700 leading-6">
        {reason ||
          'انتهت الفترة التجريبية الخاصة بحسابك. برجاء التواصل مع الشركة للترقية وتفعيل الحساب.'}
      </p>
      <div className="text-xs text-gray-500">
        للتفعيل والمساعدة: 0100 000 0000 - support@mvp-pos.com
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles = [], superuserOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div></div>;
  if (!user) return <Navigate to="/login" />;

  if (superuserOnly && !user.is_superuser) {
    return <Navigate to="/unauthorized" />;
  }

  if (!user.has_active_access && !user.is_superuser) {
    return <BlockedAccess reason={user.access_block_reason} />;
  }

  if (allowedRoles.length > 0 && !user.is_superuser && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }
  return children;
};

export default ProtectedRoute;