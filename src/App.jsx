import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Placeholder imports - we will create these files next
import Welcome from './pages/Welcome';
import Login from './pages/auth/Login';
import RegisterUser from './pages/auth/RegisterUser';
import RegisterCommerce from './pages/auth/RegisterCommerce';
import RecoverPassword from './pages/auth/RecoverPassword';

// User Flow
import Categories from './pages/user/Categories';
import RequestForm from './pages/user/RequestForm';
import Responses from './pages/user/Responses';
import Offers from './pages/user/Offers';
import RequestSuccess from './pages/user/RequestSuccess';
import ChatDispatch from './pages/common/ChatDispatch';
import ProductDetail from './pages/user/ProductDetail';
import Tracking from './pages/user/Tracking';
import History from './pages/user/History';
import Closing from './pages/user/Closing';
import UserProfile from './pages/user/UserProfile';
import Addresses from './pages/user/Addresses';
import EditUserProfile from './pages/user/EditUserProfile';

// Commerce Flow
import Dashboard from './pages/commerce/Dashboard';
import SalesHistory from './pages/commerce/SalesHistory';
import Profile from './pages/commerce/Profile';
import EditProfile from './pages/commerce/EditProfile';
import ChangePassword from './pages/commerce/ChangePassword';
import NicheConfig from './pages/commerce/NicheConfig';

// Common
import Notifications from './pages/common/Notifications';
import Orders from './pages/common/Orders';
import ChatList from './pages/common/ChatList';
import Support from './pages/common/Support';
import NotFound from './pages/common/NotFound';

// Context
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { useAuth } from './context/auth-context';
import ErrorBoundary from './components/ErrorBoundary';

const homeForRole = (role) => (role === 'commerce' ? '/dashboard' : '/categories');

// En modo InsForge la sesión se rehidrata de forma asíncrona al recargar:
// este splash evita redirigir a /welcome antes de conocer al usuario.
function AuthSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E7E7E7]" aria-busy="true" aria-label="Cargando sesión">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#4B227A]/20 border-t-[#4B227A]" />
    </div>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/welcome" replace />;
  return <Navigate to={homeForRole(user.role)} replace />;
}

// Protege una ruta comprobando que haya sesión y, opcionalmente, el rol.
function RequireRole({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/welcome" replace />;
  if (role && user.role !== role) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#E7E7E7] shadow-xl relative overflow-hidden">
      <Routes>
        {/* Página de inicio: redirige según el rol de la sesión */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/welcome" element={<Welcome />} />

        {/* Auth (rutas públicas) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register-user" element={<RegisterUser />} />
        <Route path="/register-commerce" element={<RegisterCommerce />} />
        <Route path="/recover-password" element={<RecoverPassword />} />

        {/* User Routes */}
        <Route path="/categories" element={<RequireRole role="user"><Categories /></RequireRole>} />
        <Route path="/request" element={<RequireRole role="user"><RequestForm /></RequireRole>} />
        <Route path="/request-success" element={<RequireRole role="user"><RequestSuccess /></RequireRole>} />
        <Route path="/responses" element={<RequireRole role="user"><Responses /></RequireRole>} />
        <Route path="/offers" element={<RequireRole role="user"><Offers /></RequireRole>} />
        <Route path="/product/:id" element={<RequireRole role="user"><ProductDetail /></RequireRole>} />
        <Route path="/tracking" element={<RequireRole role="user"><Tracking /></RequireRole>} />
        <Route path="/history" element={<RequireRole role="user"><History /></RequireRole>} />
        <Route path="/closing/:id" element={<RequireRole role="user"><Closing /></RequireRole>} />
        <Route path="/profile-user" element={<RequireRole role="user"><UserProfile /></RequireRole>} />
        <Route path="/addresses" element={<RequireRole role="user"><Addresses /></RequireRole>} />
        <Route path="/edit-user-profile" element={<RequireRole role="user"><EditUserProfile /></RequireRole>} />

        {/* Commerce Routes */}
        <Route path="/dashboard" element={<RequireRole role="commerce"><Dashboard /></RequireRole>} />
        <Route path="/sales-history" element={<RequireRole role="commerce"><SalesHistory /></RequireRole>} />
        <Route path="/profile" element={<RequireRole role="commerce"><Profile /></RequireRole>} />
        <Route path="/edit-profile" element={<RequireRole role="commerce"><EditProfile /></RequireRole>} />
        <Route path="/change-password" element={<RequireRole><ChangePassword /></RequireRole>} />
        <Route path="/niche-config" element={<RequireRole role="commerce"><NicheConfig /></RequireRole>} />

        {/* Common (requieren sesión, cualquier rol) */}
        <Route path="/chat/:id" element={<RequireRole><ChatDispatch /></RequireRole>} />
        <Route path="/notifications" element={<RequireRole><Notifications /></RequireRole>} />
        <Route path="/orders" element={<RequireRole><Orders /></RequireRole>} />
        <Route path="/chat-list" element={<RequireRole><ChatList /></RequireRole>} />
        <Route path="/support" element={<RequireRole><Support /></RequireRole>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
