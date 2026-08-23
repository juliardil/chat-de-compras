import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, requireRole = null }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E7E7E7] flex items-center justify-center">
        <div className="bg-white/70 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm border border-white/30 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#00EED0] animate-spin" />
          <span className="text-sm font-semibold text-gray-700">Cargando sesión…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireRole && user.role !== requireRole) {
    if (user.role === 'commerce') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/categories" replace />;
  }

  return children;
}
