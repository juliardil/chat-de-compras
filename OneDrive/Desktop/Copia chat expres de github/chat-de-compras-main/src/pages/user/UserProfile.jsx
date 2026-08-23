import React, { useState, useRef, useEffect } from 'react';
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
  CreditCard,
  Loader2,
} from 'lucide-react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

export default function UserProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileImage, setProfileImage] = useState(user?.avatar_url || null);
  const fileInputRef = useRef(null);
  const [stats, setStats] = useState({ total: 0, pending: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

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

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        setLoadingStats(true);
        const { data: completed, error: cErr } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('buyer_id', user.id)
          .in('status', ['completed', 'shipped']);
        if (cErr) throw cErr;

        const { data: pending, error: pErr } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('buyer_id', user.id)
          .in('status', ['pending', 'in_progress', 'matched', 'negotiating']);
        if (pErr) throw pErr;

        setStats({
          total: Number(completed?.length || 0) || user.profile?.total_purchases || 0,
          pending: Number(pending?.length || 0) || 0,
        });
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [user?.id, user.profile?.total_purchases]);

  const menuItems = [
    {
      icon: User,
      label: 'Información Personal',
      path: '/edit-user-profile',
      color: 'text-[#0197AF]',
      bgColor: 'bg-[#0197AF]/10',
    },
    {
      icon: MapPin,
      label: 'Mis Direcciones',
      path: '/addresses',
      color: 'text-[#4B227A]',
      bgColor: 'bg-[#4B227A]/10',
    },
    {
      icon: Bell,
      label: 'Notificaciones',
      path: '/notifications',
      color: 'text-[#00EED0]',
      bgColor: 'bg-[#00EED0]/20',
    },
    {
      icon: ShieldCheck,
      label: 'Seguridad',
      path: '/change-password',
      color: 'text-gray-600',
      bgColor: 'bg-white/70',
    },
  ];

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24">
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
          <h2 className="mt-4 text-xl font-bold text-gray-800">
            {user?.profile?.full_name || user?.name || 'Usuario'}
          </h2>
          <p className="text-gray-600 text-sm">{user?.email || 'Sin correo registrado'}</p>

          <div className="flex gap-4 mt-6 w-full">
            <div className="flex-1 bg-white/70 backdrop-blur-sm p-3 rounded-2xl flex flex-col items-center border border-white/30">
              {loadingStats ? (
                <Loader2 className="w-5 h-5 text-[#00EED0] animate-spin mb-1" />
              ) : (
                <>
                  <span className="text-lg font-bold text-gray-800">{stats.total}</span>
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                    Compras
                  </span>
                </>
              )}
            </div>
            <div className="flex-1 bg-white/70 backdrop-blur-sm p-3 rounded-2xl flex flex-col items-center border border-white/30">
              {loadingStats ? (
                <Loader2 className="w-5 h-5 text-[#4B227A] animate-spin mb-1" />
              ) : (
                <>
                  <span className="text-lg font-bold text-gray-800">{stats.pending}</span>
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                    Pendientes
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mt-8">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest ml-1 mb-4">
          Ajustes de Cuenta
        </h3>
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
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      </div>

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
