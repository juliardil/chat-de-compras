import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Settings, 
  MapPin, 
  Bell, 
  ShieldCheck, 
  LogOut, 
  ChevronRight, 
  Camera,
  ShoppingBag,
  CreditCard
} from 'lucide-react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { useAuth } from '../../context/AuthContext';

export default function UserProfile() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const menuItems = [
    { 
      icon: User, 
      label: 'Información Personal', 
      path: '/edit-user-profile', 
      color: 'text-blue-500', 
      bgColor: 'bg-blue-50' 
    },
    { 
      icon: MapPin, 
      label: 'Mis Direcciones', 
      path: '/addresses', 
      color: 'text-orange-500', 
      bgColor: 'bg-orange-50' 
    },
    { 
      icon: Bell, 
      label: 'Notificaciones', 
      path: '/notifications', 
      color: 'text-purple-500', 
      bgColor: 'bg-purple-50' 
    },
    { 
      icon: ShieldCheck, 
      label: 'Seguridad', 
      path: '/change-password', 
      color: 'text-gray-500', 
      bgColor: 'bg-gray-100' 
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header / Profile Info */}
      <div className="bg-white px-6 pt-12 pb-8 rounded-b-[32px] shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
              <User className="w-12 h-12 text-primary" />
              {/* Optional: <img src="..." className="w-full h-full object-cover" /> */}
            </div>
            <button className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg border-2 border-white hover:bg-blue-600 transition-colors">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <h2 className="mt-4 text-xl font-bold text-dark">Usuario Demo</h2>
          <p className="text-gray-500 text-sm">usuario@ejemplo.com</p>
          
          <div className="flex gap-4 mt-6 w-full">
            <div className="flex-1 bg-gray-50 p-3 rounded-2xl flex flex-col items-center">
              <span className="text-lg font-bold text-dark">12</span>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Compras</span>
            </div>
            <div className="flex-1 bg-gray-50 p-3 rounded-2xl flex flex-col items-center">
              <span className="text-lg font-bold text-dark">4</span>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Pendientes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Section */}
      <div className="px-6 mt-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1 mb-4">Ajustes de Cuenta</h3>
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                index !== menuItems.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`${item.bgColor} p-2.5 rounded-xl`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <span className="font-semibold text-dark text-sm">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 mt-6">
        <button
          onClick={logout}
          className="w-full bg-white border border-red-100 text-red-500 font-bold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>

      <UserBottomNav />
    </div>
  );
}
