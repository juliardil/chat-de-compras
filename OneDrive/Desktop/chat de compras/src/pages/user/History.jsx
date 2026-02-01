import React from 'react';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function History() {
  const history = [
    { id: 101, product: 'Nike Air Force 1', store: 'UrbanKicks', date: '20 Oct, 2023', price: 120, image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=100' },
    { id: 102, product: 'Monitor Dell 27"', store: 'TechMaster', date: '15 Sep, 2023', price: 350, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=100' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white px-6 py-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-dark">Historial de Compras</h1>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {history.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
            <img src={item.image} alt={item.product} className="w-20 h-20 rounded-lg object-cover bg-gray-100" />
            
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-dark text-sm">{item.product}</h3>
                <span className="text-primary font-bold text-sm">${item.price}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{item.store} • {item.date}</p>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md">
                  <CheckCircle2 className="w-3 h-3" /> Completado
                </span>
                
                <button className="text-primary text-xs font-semibold flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors">
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
