
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Car, Check, User, ChevronRight, Lock } from 'lucide-react';

// Actualización estética Junio 2026

export default function NicheConfig() {
  const navigate = useNavigate();
  const [niches, setNiches] = useState([
    { 
      id: 'automotive', 
      name: 'Automotriz', 
      icon: Car, 
      active: true, 
      demand: 'high',
      subcategories: [
        { id: 'motor', name: 'Motor', active: true },
        { id: 'brakes', name: 'Frenos', active: true },
        { id: 'suspension', name: 'Suspensión', active: true },
        { id: 'electric', name: 'Eléctrico', active: false },
        { id: 'tires', name: 'Llantas y Neumáticos', active: false },
        { id: 'interior', name: 'Interior / Exterior', active: false },
        { id: 'lubricants', name: 'Lubricantes y Fluidos', active: false },
        { id: 'mechanic', name: 'Taller Mecánico', active: false },
        { id: 'accessories', name: 'Accesorios Vehiculares', active: false },
        { id: 'audio', name: 'Audio y Sonido', active: false },
        { id: 'security', name: 'Seguridad Vehicular', active: false }
      ]
    }
  ]);

  const toggleNiche = (id) => {
    setNiches(niches.map(n => n.id === id ? { ...n, active: !n.active } : n));
  };

  const toggleSubcategory = (nicheId, subId) => {
    setNiches(niches.map(n => {
      if (n.id === nicheId) {
        return {
          ...n,
          subcategories: n.subcategories.map(s => 
            s.id === subId ? { ...s, active: !s.active } : s
          )
        };
      }
      return n;
    }));
  };

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-6 py-5 border-b border-white/30">
        <h1 className="text-xl font-bold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-600">Administra tus preferencias y perfil</p>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {/* Acceso a Perfil */}
        <div 
          onClick={() => navigate('/edit-profile')}
          className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/30 flex items-center justify-between cursor-pointer hover:bg-white/90 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0197AF]/20 rounded-full flex items-center justify-center text-[#0197AF]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Perfil del Comercio</h3>
              <p className="text-xs text-gray-600">Editar información pública</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </div>

        {/* Cambiar Contraseña */}
        <div 
          onClick={() => navigate('/change-password')}
          className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/30 flex items-center justify-between cursor-pointer hover:bg-white/90 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#4B227A]/20 rounded-full flex items-center justify-center text-[#4B227A]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Seguridad</h3>
              <p className="text-xs text-gray-600">Cambiar contraseña</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </div>

        <h2 className="font-bold text-gray-800 text-lg px-2 pt-2">Nichos Activos</h2>
        <p className="text-sm text-gray-600 px-2 -mt-2 mb-2">Selecciona qué solicitudes quieres recibir</p>

        {niches.map((niche) => (
          <div key={niche.id} className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-white/30 overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${niche.active ? 'bg-[#00EED0] text-gray-900 shadow-[0_0_10px_rgba(0,238,208,0.4)]' : 'bg-white/70 text-gray-600 border border-white/30'}`}>
                  <niche.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{niche.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      niche.demand === 'high' ? 'bg-[#00EED0]/20 text-[#4B227A] border border-[#00EED0]/30' : 'bg-[#4B227A]/10 text-[#4B227A] border border-[#4B227A]/20'
                    }`}>
                      {niche.demand === 'high' ? '🔥 Alta demanda' : '⚡ Demanda media'}
                    </span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => toggleNiche(niche.id)}
                className={`w-12 h-7 rounded-full transition-colors relative ${niche.active ? 'bg-[#00EED0]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${niche.active ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {niche.active && niche.subcategories.length > 0 && (
              <div className="bg-[#E7E7E7]/80 p-4 border-t border-white/30">
                <div className="flex flex-wrap gap-2">
                  {niche.subcategories.map(sub => (
                    <button 
                      key={sub.id}
                      onClick={() => toggleSubcategory(niche.id, sub.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                        sub.active 
                          ? 'bg-[#00EED0]/20 border-[#00EED0]/30 text-[#4B227A]' 
                          : 'bg-white/70 border-white/30 text-gray-600 hover:border-[#0197AF]/30'
                      }`}
                    >
                      {sub.name}
                      {sub.active && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <CommerceBottomNav />
    </div>
  );
}

