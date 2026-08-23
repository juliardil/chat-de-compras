import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Splash from './pages/Splash';
import Welcome from './pages/Welcome';
import Login from './pages/auth/Login';
import RegisterUser from './pages/auth/RegisterUser';
import RegisterCommerce from './pages/auth/RegisterCommerce';
import RecoverPassword from './pages/auth/RecoverPassword';

// User Flow
import Categories from './pages/user/Categories';
import RequestForm from './pages/user/RequestForm';
import Responses from './pages/user/Responses';
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
import CreateAd from './pages/commerce/CreateAd';
import EditProfile from './pages/commerce/EditProfile';
import ChangePassword from './pages/commerce/ChangePassword';
import NicheConfig from './pages/commerce/NicheConfig';

// Common
import Notifications from './pages/common/Notifications';
import Orders from './pages/common/Orders';
import ChatList from './pages/common/ChatList';
import Support from './pages/common/Support';
import NotFound from './pages/common/NotFound';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './context/ProtectedRoute';

const UserRoute = ({ children }) => <ProtectedRoute requireRole="user">{children}</ProtectedRoute>;
const CommerceRoute = ({ children }) => <ProtectedRoute requireRole="commerce">{children}</ProtectedRoute>;
const AnyAuthRoute = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

function AppRoutes() {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#E7E7E7] shadow-xl relative overflow-hidden">
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<Welcome />} />
        <Route path="/splash" element={<Splash />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register-user" element={<RegisterUser />} />
        <Route path="/register-commerce" element={<RegisterCommerce />} />
        <Route path="/recover-password" element={<RecoverPassword />} />
        <Route path="/change-password" element={<RecoverPassword />} />

        {/* Rutas Usuario Final (role=user) */}
        <Route path="/categories" element={<UserRoute><Categories /></UserRoute>} />
        <Route path="/niches" element={<Navigate to="/categories" replace />} />
        <Route path="/request" element={<UserRoute><RequestForm /></UserRoute>} />
        <Route path="/responses" element={<UserRoute><Responses /></UserRoute>} />
        <Route path="/product/:id" element={<UserRoute><ProductDetail /></UserRoute>} />
        <Route path="/tracking" element={<UserRoute><Tracking /></UserRoute>} />
        <Route path="/history" element={<UserRoute><History /></UserRoute>} />
        <Route path="/closing/:id" element={<UserRoute><Closing /></UserRoute>} />
        <Route path="/profile-user" element={<UserRoute><UserProfile /></UserRoute>} />
        <Route path="/addresses" element={<UserRoute><Addresses /></UserRoute>} />
        <Route path="/edit-user-profile" element={<UserRoute><EditUserProfile /></UserRoute>} />

        {/* Rutas Comercio (role=commerce) */}
        <Route path="/dashboard" element={<CommerceRoute><Dashboard /></CommerceRoute>} />
        <Route path="/sales-history" element={<CommerceRoute><SalesHistory /></CommerceRoute>} />
        <Route path="/profile" element={<CommerceRoute><Profile /></CommerceRoute>} />
        <Route path="/edit-profile" element={<CommerceRoute><EditProfile /></CommerceRoute>} />
        <Route path="/create-ad" element={<Navigate to="/dashboard" replace />} />
        <Route path="/niche-config" element={<CommerceRoute><NicheConfig /></CommerceRoute>} />

        {/* Rutas Comunes (ambos roles, solo requieren sesión activa) */}
        <Route path="/chat/:id" element={<AnyAuthRoute><ChatDispatch /></AnyAuthRoute>} />
        <Route path="/chat/new" element={<AnyAuthRoute><ChatDispatch /></AnyAuthRoute>} />
        <Route path="/notifications" element={<AnyAuthRoute><Notifications /></AnyAuthRoute>} />
        <Route path="/orders" element={<AnyAuthRoute><Orders /></AnyAuthRoute>} />
        <Route path="/chat-list" element={<AnyAuthRoute><ChatList /></AnyAuthRoute>} />
        <Route path="/support" element={<AnyAuthRoute><Support /></AnyAuthRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
