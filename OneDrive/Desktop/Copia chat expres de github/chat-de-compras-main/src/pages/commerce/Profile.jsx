import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Store, Star, Award, LogOut, Edit2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import { supabase } from '../../lib/supabaseClient';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileImage, setProfileImage] = useState(
    user?.profile?.avatar_url ||
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200'
  );
  const fileInputRef = useRef(null);
  const [stats, setStats] = useState({ rating: 5, sales: 0 });
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
        const { count: salesCount, error } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('commerce_id', user.id);
        if (error) throw error;
        const rating = Number(user.profile?.rating || 5);
        const sales = Number(user.profile?.sales_count || salesCount || 0);
        setStats({ rating, sales });
      } catch (e) {
        setStats({
          rating: Number(user.profile?.rating || 5),
          sales: Number(user.profile?.sales_count || 0),
        });
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [user?.id, user.profile?.rating, user.profile?.sales_count]);

  const tier = user.profile?.tier || 'FREE';
  const memberSince = user.profile?.member_since ? new Date(user.profile.member_since).getFullYear() : new Date().getFullYear();
  const tierRenewal = user.profile?.tier_renewal_date
    ? new Date(user.profile.tier_renewal_date).toLocaleDateString()
    : 'Sin renovación';

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <div className="bg-white/80 backdrop-blur-md pb-6 pt-10 px-6 rounded-b-[2rem] shadow-sm border-b border-white/30 relative">
        <button
          onClick={logout}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-[#4B227A] hover:bg-[#4B227A]/10 rounded-full transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#00EED0] to-[#4B227A] mb-4 relative shadow-[0_0_20px_rgba(0,238,208,0.4)]">
            <img
              src={profileImage}
              alt="Profile"
              className="w-full h-full rounded-full object-cover border-4 border-white"
            />
            <button
              onClick={handleImageClick}
              className="absolute bottom-0 right-0 bg-gray-800 text-white p-1.5 rounded-full border-2 border-white shadow-sm hover:bg-gray-700 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {user.profile?.trade_name || user.profile?.full_name || user?.name || 'Comercio'}
          </h1>
          <p className="text-gray-600 text-sm mb-4">Miembro desde {memberSince}</p>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              {loadingStats ? (
                <Loader2 className="w-4 h-4 text-[#00EED0] animate-spin" />
              ) : (
                <div className="flex items-center gap-1 font-bold text-gray-800 text-lg">
                  {stats.rating.toFixed(1)} <Star className="w-4 h-4 text-[#00EED0] fill-current" />
                </div>
              )}
              <span className="text-xs text-gray-500">Rating</span>
            </div>
            <div className="w-[1px] h-8 bg-white/40" />
            <div className="flex flex-col items-center">
              {loadingStats ? (
                <Loader2 className="w-4 h-4 text-[#4B227A] animate-spin" />
              ) : (
                <div className="font-bold text-gray-800 text-lg">{stats.sales}</div>
              )}
              <span className="text-xs text-gray-500">Ventas</span>
            </div>
            <div className="w-[1px] h-8 bg-white/40" />
            <div className="flex flex-col items-center">
              <div className="font-bold text-[#0197AF] text-lg">{tier}</div>
              <span className="text-xs text-gray-500">Nivel</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div>
          <h2 className="font-bold text-gray-800 mb-4">Información del Negocio</h2>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                Descripción
              </label>
              <p className="text-sm text-gray-700 mt-1">
                {user.profile?.description ||
                  'Comercio especializado en repuestos y accesorios automotrices. Envíos rápidos y atención personalizada.'}
              </p>
            </div>

            <div className="h-[1px] bg-white/40" />

            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                Categoría principal
              </label>
              <p className="text-sm text-gray-700 mt-1">
                {user.profile?.main_category || 'Automotriz'}
              </p>
            </div>

            <div className="h-[1px] bg-white/40" />

            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                Membresía
              </label>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-r from-[#00EED0] to-[#0197AF] p-1.5 rounded-lg text-white">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">Plan {tier}</p>
                    <p className="text-xs text-gray-600">Renueva el {tierRenewal}</p>
                  </div>
                </div>
                <Button variant="outline" className="py-1.5 px-3 text-xs h-auto border-[#0197AF]/30 text-[#0197AF]">
                  Gestionar
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate('/edit-profile')}
            variant="outline"
            fullWidth
            className="rounded-xl border-[#4B227A]/30 text-[#4B227A] font-bold flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Editar Perfil Comercial
          </Button>

          <button
            onClick={logout}
            className="w-full bg-white/80 backdrop-blur-md border border-[#4B227A]/20 text-[#4B227A] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B227A]/10 transition-colors shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      <CommerceBottomNav />
    </div>
  );
}
