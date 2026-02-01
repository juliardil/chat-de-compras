import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommerceBottomNav from '../../components/layout/CommerceBottomNav';
import { Shirt, Smartphone, Car, ChevronDown, Check, User, ChevronRight, Lock } from 'lucide-react';

export default function NicheConfig() {
  const navigate = useNavigate();
  const [niches, setNiches] = useState([
    { 
      id: 'tech', 
      name: 'Tecnología', 
      icon: Smartphone, 
      active: true, 
      demand: 'high',
      subcategories: [
        { id: 'phones', name: 'Celulares', active: true },
        { id: 'laptops', name: 'Laptops', active: true },
        { id: 'acc', name: 'Accesorios', active: false }
      ]
    },
    { 
      id: 'fashion', 
      name: 'Moda', 
      icon: Shirt, 
      active: false, 
      demand: 'medium',
      subcategories: []
    }
  ]);

  const toggleNiche = (id) => {
    setNiches(niches.map(n => n.id === id ? { ...n, active: !n.active } : n));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white px-6 py-5 border-b border-gray-100">
        <h1 className="text-xl font-bold text-dark">Configuración</h1>
        <p className="text-sm text-gray-500">Administra tus preferencias y perfil</p>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {/* Acceso a Perfil */}
        <div 
          onClick={() => navigate('/edit-profile')}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-dark text-sm">Perfil del Comercio</h3>
              <p className="text-xs text-gray-500">Editar información pública</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        {/* Cambiar Contraseña */}
        <div 
          onClick={() => navigate('/change-password')}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-dark text-sm">Seguridad</h3>
              <p className="text-xs text-gray-500">Cambiar contraseña</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>

        <h2 className="font-bold text-dark text-lg px-2 pt-2">Nichos Activos</h2>
        <p className="text-sm text-gray-500 px-2 -mt-2 mb-2">Selecciona qué solicitudes quieres recibir</p>

        {niches.map((niche) => (
          <div key={niche.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${niche.active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <niche.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-dark">{niche.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      niche.demand === 'high' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {niche.demand === 'high' ? '🔥 Alta demanda' : '⚡ Demanda media'}
                    </span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => toggleNiche(niche.id)}
                className={`w-12 h-7 rounded-full transition-colors relative ${niche.active ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${niche.active ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {niche.active && niche.subcategories.length > 0 && (
              <div className="bg-gray-50 p-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {niche.subcategories.map(sub => (
                    <button 
                      key={sub.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                        sub.active 
                          ? 'bg-blue-50 border-blue-200 text-primary' 
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
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
