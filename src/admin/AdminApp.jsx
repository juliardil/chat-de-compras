import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './auth/AdminAuthProvider';
import { useAdminAuth } from './auth/useAdminAuth';
import AdminLayout from './layout/AdminLayout';
import { ToastProvider } from './components/ToastProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Buyers from './pages/Buyers';
import Commerce from './pages/Commerce';
import Categories from './pages/Categories';
import Requests from './pages/Requests';
import Offers from './pages/Offers';
import Orders from './pages/Orders';
import Deliveries from './pages/Deliveries';
import Chats from './pages/Chats';
import Moderation from './pages/Moderation';
import Reviews from './pages/Reviews';
import Support from './pages/Support';
import Communications from './pages/Communications';
import Staff from './pages/Staff';
import Audit from './pages/Audit';
import Analytics from './pages/Analytics';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import Forbidden from './pages/Forbidden';
import SessionExpired from './pages/SessionExpired';
import ModulePending from './pages/ModulePending';
import NotFound from './pages/NotFound';
import { PENDING_MODULES } from './constants/navigation';

function RequirePermission({ permission, children }) {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission(permission)) return <Navigate to="/sin-permiso" replace />;
  return children;
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F6F8]">
      <div className="flex flex-col items-center gap-4">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[#4B227A]" />
        <p className="text-sm font-medium text-slate-500">Comprobando sesión administrativa…</p>
      </div>
    </div>
  );
}

function AdminRoutes() {
  const { status } = useAdminAuth();

  if (status === 'loading') return <Splash />;
  if (status === 'expired') return <SessionExpired />;

  return (
    <Routes>
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/"
        element={status === 'authenticated' ? <AdminLayout /> : <Navigate to="/login" replace />}
      >
        <Route
          index
          element={
            <RequirePermission permission="dashboard.view">
              <Dashboard />
            </RequirePermission>
          }
        />
        <Route
          path="personal"
          element={
            <RequirePermission permission="staff.view">
              <Staff />
            </RequirePermission>
          }
        />
        <Route
          path="compradores"
          element={
            <RequirePermission permission="users.view">
              <Buyers />
            </RequirePermission>
          }
        />
        <Route
          path="comercios"
          element={
            <RequirePermission permission="commerce.view">
              <Commerce />
            </RequirePermission>
          }
        />
        <Route
          path="categorias"
          element={
            <RequirePermission permission="catalog.view">
              <Categories />
            </RequirePermission>
          }
        />
        <Route
          path="solicitudes"
          element={
            <RequirePermission permission="requests.view">
              <Requests />
            </RequirePermission>
          }
        />
        <Route
          path="ofertas"
          element={
            <RequirePermission permission="offers.view">
              <Offers />
            </RequirePermission>
          }
        />
        <Route
          path="pedidos"
          element={
            <RequirePermission permission="orders.view">
              <Orders />
            </RequirePermission>
          }
        />
        <Route
          path="entregas"
          element={
            <RequirePermission permission="deliveries.view">
              <Deliveries />
            </RequirePermission>
          }
        />
        <Route
          path="chats"
          element={
            <RequirePermission permission="chats.view_metadata">
              <Chats />
            </RequirePermission>
          }
        />
        <Route
          path="moderacion"
          element={
            <RequirePermission permission="moderation.view">
              <Moderation />
            </RequirePermission>
          }
        />
        <Route
          path="resenas"
          element={
            <RequirePermission permission="reviews.view">
              <Reviews />
            </RequirePermission>
          }
        />
        <Route
          path="soporte"
          element={
            <RequirePermission permission="support.view">
              <Support />
            </RequirePermission>
          }
        />
        <Route
          path="comunicaciones"
          element={
            <RequirePermission permission="communications.view">
              <Communications />
            </RequirePermission>
          }
        />
        <Route
          path="auditoria"
          element={
            <RequirePermission permission="audit.view">
              <Audit />
            </RequirePermission>
          }
        />
        <Route
          path="analitica"
          element={
            <RequirePermission permission="analytics.view">
              <Analytics />
            </RequirePermission>
          }
        />
        <Route
          path="pagos"
          element={
            <RequirePermission permission="payments.view">
              <Payments />
            </RequirePermission>
          }
        />
        <Route
          path="configuracion"
          element={
            <RequirePermission permission="settings.view">
              <Settings />
            </RequirePermission>
          }
        />

        {Object.entries(PENDING_MODULES).map(([path, module]) => (
          <Route
            key={path}
            path={path.replace(/^\//, '')}
            element={
              <RequirePermission permission={module.permission}>
                <ModulePending moduleKey={path} />
              </RequirePermission>
            }
          />
        ))}

        <Route path="sin-permiso" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function AdminApp() {
  return (
    <ToastProvider>
      <AdminAuthProvider>
        <ErrorBoundary>
          <AdminRoutes />
        </ErrorBoundary>
      </AdminAuthProvider>
    </ToastProvider>
  );
}
