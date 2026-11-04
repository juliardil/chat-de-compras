
import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import frenosImg from '../../assets/repuesto-frenos.svg';
import bateriaImg from '../../assets/repuesto-bateria.svg';

// Actualización estética Junio 2026

export default function History() {
  const navigate = useNavigate();

  const history = [
    { id: 101, product: 'Pastillas de freno delanteras', store: 'Repuestos del Sur', date: '20 Oct, 2026', price: 120, image: frenosImg },
    { id: 102, product: 'Batería 12V 60Ah', store: 'AutoPartes Gómez', date: '15 Sep, 2026', price: 145, image: bateriaImg }
  ];

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-white/30 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-800">Historial de Compras</h1>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {history.map((item) => (
          <div key={item.id} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white/30 flex gap-4">
            <img src={item.image} alt={item.product} className="w-20 h-20 rounded-xl object-cover bg-white/50" />
            
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-800 text-sm">{item.product}</h3>
                <span className="text-[#006E7A] font-bold text-sm">${item.price}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{item.store} • {item.date}</p>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#4B227A] flex items-center gap-1 bg-[#4B227A]/10 px-2 py-1 rounded-md border border-[#4B227A]/20">
                  <CheckCircle2 className="w-3 h-3" /> Completado
                </span>
                
                <button
                  onClick={() => navigate('/request')}
                  className="text-[#006E7A] text-xs font-semibold flex items-center gap-1 hover:bg-[#0197AF]/10 px-2 py-1 rounded-md transition-colors border border-[#0197AF]/20"
                >
                  <RefreshCw className="w-3 h-3" /> Repetir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <UserBottomNav />
    </div>
  );
}

