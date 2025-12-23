import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isManagerial = user.is_superuser || ['OWNER', 'MANAGER'].includes(user.role);
  if (isManagerial) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/employees/me" replace />;
}