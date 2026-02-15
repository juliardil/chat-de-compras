import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Placeholder imports - we will create these files next
import Splash from './pages/Splash';
import Welcome from './pages/Welcome';
import Login from './pages/auth/Login';
import RegisterUser from './pages/auth/RegisterUser';
import RegisterCommerce from './pages/auth/RegisterCommerce';
import RecoverPassword from './pages/auth/RecoverPassword';

// User Flow
import Categories from './pages/user/Categories';
import NicheExploration from './pages/user/NicheExploration';
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

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <Splash />;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl relative overflow-hidden">
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/welcome" element={<Welcome />} />
        
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register-user" element={<RegisterUser />} />
        <Route path="/register-commerce" element={<RegisterCommerce />} />
        <Route path="/recover-password" element={<RecoverPassword />} />

        {/* User Routes */}
        <Route path="/categories" element={<Categories />} />
        <Route path="/niches" element={<NicheExploration />} />
        <Route path="/request" element={<RequestForm />} />
        <Route path="/responses" element={<Responses />} />
        <Route path="/chat/:id" element={<ChatDispatch />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/history" element={<History />} />
        <Route path="/closing/:id" element={<Closing />} />
        <Route path="/profile-user" element={<UserProfile />} />
        <Route path="/addresses" element={<Addresses />} />
        <Route path="/edit-user-profile" element={<EditUserProfile />} />

        {/* Commerce Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sales-history" element={<SalesHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/edit-profile" element={<EditProfile />} />
        <Route path="/create-ad" element={<CreateAd />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/niche-config" element={<NicheConfig />} />

        {/* Common */}
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/chat-list" element={<ChatList />} />
        <Route path="/support" element={<Support />} />
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
