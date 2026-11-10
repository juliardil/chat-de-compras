import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  Bell, 
  History,
  ShieldCheck, 
  LogOut, 
  ChevronRight, 
  Camera,
  CheckCircle
} from 'lucide-react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { useAuth } from '../../context/auth-context';

// Perfil del comprador. El nombre y el correo vienen de la sesión real
// (InsForge cuando está configurado; demo local en caso contrario). Las
// estadísticas de compras solo existen en la demo: el módulo de pedidos de la
// app aún no está conectado al backend.
export default function UserProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, mode } = useAuth();
  const [profileImage, setProfileImage] = useState(null);
  const fileInputRef = useRef(null);
  const justUpdated = Boolean(location.state?.profileUpdated);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfileImage(url);
    }
  };

  const menuItems = [
    { 
      icon: User, 
      label: 'Información Personal', 
      path: '/edit-user-profile', 
      color: 'text-[#006E7A]', 
      bgColor: 'bg-[#0197AF]/10' 
    },
    { 
      icon: MapPin, 
      label: 'Mis Direcciones', 
      path: '/addresses', 
      color: 'text-[#4B227A]', 
      bgColor: 'bg-[#4B227A]/10' 
    },
    { 
      icon: Bell, 
      label: 'Notificaciones', 
      path: '/notifications', 
      color: 'text-[#006E7A]', 
      bgColor: 'bg-[#00EED0]/20' 
    },
    { 
      icon: History, 
      label: 'Historial', 
      path: '/history', 
      color: 'text-[#006E7A]', 
      bgColor: 'bg-[#0197AF]/10' 
    },
    { 
      icon: ShieldCheck, 
      label: 'Seguridad', 
      path: '/change-password', 
      color: 'text-gray-600', 
      bgColor: 'bg-white/70' 
    }
  ];

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24">
      {/* Header / Profile Info */}
      <div className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-8 rounded-b-[32px] shadow-sm border-b border-white/30">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#4B227A]/10 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-[#4B227A]" />
              )}
            </div>
            <button 
              aria-label="Cambiar foto de perfil"
              onClick={handleImageClick}
              className="absolute bottom-0 right-0 p-2 bg-[#00EED0] text-gray-900 rounded-full shadow-lg shadow-[#00EED0]/40 border-2 border-white hover:bg-[#00EED0]/90 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-800">{user?.name || 'Usuario'}</h2>
          <p className="text-gray-600 text-sm">{user?.email || '—'}</p>

          {justUpdated ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700">
              <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Información actualizada
            </p>
          ) : null}

          {mode === 'demo' ? (
            <div className="flex gap-4 mt-6 w-full">
              <div className="flex-1 bg-white/70 backdrop-blur-sm p-3 rounded-2xl flex flex-col items-center border border-white/30">
                <span className="text-lg font-bold text-gray-800">12</span>
                <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wider">Compras</span>
              </div>
              <div className="flex-1 bg-white/70 backdrop-blur-sm p-3 rounded-2xl flex flex-col items-center border border-white/30">
                <span className="text-lg font-bold text-gray-800">4</span>
                <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wider">Pendientes</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Menu Section */}
      <div className="px-6 mt-8">
        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-widest ml-1 mb-4">Ajustes de Cuenta</h3>
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden border border-white/30">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between p-4 hover:bg-white/90 transition-colors ${
                index !== menuItems.length - 1 ? 'border-b border-white/40' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`${item.bgColor} p-2.5 rounded-xl border border-white/30`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <span className="font-semibold text-gray-800 text-sm">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 mt-6">
        <button
          onClick={logout}
          className="w-full bg-white/80 backdrop-blur-md border border-[#4B227A]/20 text-[#4B227A] font-bold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-[#4B227A]/10 transition-colors shadow-sm"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>

      <UserBottomNav />
    </div>
  );
}
