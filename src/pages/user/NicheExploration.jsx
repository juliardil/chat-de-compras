
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Car } from 'lucide-react';
import Button from '../../components/ui/Button';
import UserBottomNav from '../../components/layout/UserBottomNav';

// Página de Exploración - Exclusiva Automotriz

export default function NicheExploration() {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-[#E7E7E7] flex flex-col">
      {/* Header */}
      <header className="px-8 pt-12 pb-6 bg-white/70 backdrop-blur-md border-b border-white/30">
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 hover:bg-white/50 rounded-full"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Explorar Automotriz</h1>
        </div>
        <p className="text-gray-600">
          Conecta con comercios locales para repuestos y servicios
        </p>
      </header>

      {/* Contenido principal - Categorías de Inventario */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">¿Qué estás buscando?</h2>
        
        <div className="grid grid-cols-1 gap-3">
          {[
            'Motor', 'Frenos', 'Suspensión', 'Eléctrico',
            'Llantas y Neumáticos', 'Interior / Exterior',
            'Lubricantes y Fluidos', 'Taller Mecánico',
            'Accesorios Vehiculares', 'Audio y Sonido', 'Seguridad Vehicular'
          ].map((item, index) => (
            <button
              key={index}
              onClick={() => navigate('/request', { state: { system: item } })}
              className="w-full p-4 bg-white/80 backdrop-blur-md rounded-xl border border-white/30 shadow-sm hover:border-[#00EED0]/50 hover:bg-[#00EED0]/5 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-medium">{item}</span>
                <ArrowLeft className="w-4 h-4 text-gray-500 rotate-180" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Botón general */}
      <div className="px-6 pb-4 z-30 bg-white/60 backdrop-blur-md border-t border-white/30">
        <Button 
          fullWidth 
          onClick={() => navigate('/request')}
          className="py-4 shadow-lg shadow-[#00EED0]/30"
        >
          <Car className="w-5 h-5 mr-2" />
          👉 Otra solicitud automotriz
        </Button>
      </div>

      <UserBottomNav />
    </div>
  );
}
