
import React from 'react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';

// Actualización estética Junio 2026

export default function History() {
  const history = [
    { id: 101, product: 'Nike Air Force 1', store: 'UrbanKicks', date: '20 Oct, 2023', price: 120, image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=100' },
    { id: 102, product: 'Monitor Dell 27"', store: 'TechMaster', date: '15 Sep, 2023', price: 350, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=100' }
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
                <span className="text-[#00EED0] font-bold text-sm">${item.price}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{item.store} • {item.date}</p>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#4B227A] flex items-center gap-1 bg-[#4B227A]/10 px-2 py-1 rounded-md border border-[#4B227A]/20">
                  <CheckCircle2 className="w-3 h-3" /> Completado
                </span>
                
                <button className="text-[#0197AF] text-xs font-semibold flex items-center gap-1 hover:bg-[#0197AF]/10 px-2 py-1 rounded-md transition-colors border border-[#0197AF]/20">
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

