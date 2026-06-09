
import React from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Store, Star, Award, LogOut, Edit2, Plus, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';

// Actualización estética Junio 2026

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();

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
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200" 
              alt="Profile" 
              className="w-full h-full rounded-full object-cover border-4 border-white"
            />
            <button className="absolute bottom-0 right-0 bg-gray-800 text-white p-1.5 rounded-full border-2 border-white shadow-sm">
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-1">TechMaster Store</h1>
          <p className="text-gray-600 text-sm mb-4">Miembro desde 2023</p>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 font-bold text-gray-800 text-lg">
                4.8 <Star className="w-4 h-4 text-[#00EED0] fill-current" />
              </div>
              <span className="text-xs text-gray-500">Rating</span>
            </div>
            <div className="w-[1px] h-8 bg-white/40" />
            <div className="flex flex-col items-center">
              <div className="font-bold text-gray-800 text-lg">156</div>
              <span className="text-xs text-gray-500">Ventas</span>
            </div>
            <div className="w-[1px] h-8 bg-white/40" />
            <div className="flex flex-col items-center">
              <div className="font-bold text-[#0197AF] text-lg">PRO</div>
              <span className="text-xs text-gray-500">Nivel</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {/* Ad Creation Section */}
        <div className="bg-gradient-to-r from-[#0197AF] to-[#4B227A] rounded-2xl p-5 text-white shadow-lg shadow-[#0197AF]/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                <Zap className="w-4 h-4 text-[#00EED0] fill-current" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Publicidad</span>
            </div>
            <h3 className="text-lg font-bold mb-1">Impulsa tus ventas</h3>
            <p className="text-sm text-white/90 mb-4 max-w-[80%]">
              Crea historias promocionales para destacar en la exploración de nichos.
            </p>
            <Button 
              onClick={() => navigate('/create-ad')}
              className="bg-[#00EED0] hover:bg-[#00EED0]/90 text-gray-900 border-none shadow-[0_0_15px_rgba(0,238,208,0.6)] text-xs py-2 h-auto"
            >
              <Plus className="w-4 h-4 mr-1" />
              Crear Nueva Historia
            </Button>
          </div>
        </div>

        <div>
          <h2 className="font-bold text-gray-800 mb-4">Información del Negocio</h2>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Descripción</label>
              <p className="text-sm text-gray-700 mt-1">
                Especialistas en tecnología Apple. Garantía oficial y los mejores precios del mercado. Envíos a todo el país.
              </p>
            </div>
            
            <div className="h-[1px] bg-white/40" />

            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Nichos Activos</label>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-3 py-1 bg-[#0197AF]/10 text-[#0197AF] rounded-lg text-xs font-bold border border-[#0197AF]/20">Tecnología</span>
                <span className="px-3 py-1 bg-white/50 text-gray-600 rounded-lg text-xs font-bold border border-white/30">Accesorios</span>
              </div>
            </div>

            <div className="h-[1px] bg-white/40" />

            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Membresía</label>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-r from-[#00EED0] to-[#0197AF] p-1.5 rounded-lg text-white">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">Plan Premium</p>
                    <p className="text-xs text-gray-600">Renueva el 01/05/2026</p>
                  </div>
                </div>
                <Button variant="outline" className="py-1.5 px-3 text-xs h-auto border-[#0197AF]/30 text-[#0197AF]">
                  Gestionar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
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

