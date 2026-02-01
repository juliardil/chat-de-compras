import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { Clock, MessageCircle, ChevronRight } from 'lucide-react';

export default function Tracking() {
  const navigate = useNavigate();

  const activeRequests = [
    { id: 1, product: 'iPhone 15 Pro Max', status: 'receiving_offers', offers: 3, time: 'Hace 10 min' },
    { id: 2, product: 'MacBook Air M2', status: 'negotiating', offers: 1, time: 'Hace 1h' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white px-6 py-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-dark">Mis Solicitudes</h1>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {activeRequests.map((req) => (
          <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-dark">{req.product}</h3>
              <span className="text-xs text-gray-500">{req.time}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {req.status === 'receiving_offers' ? (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
                    Recibiendo ofertas
                  </span>
                ) : (
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-md text-xs font-medium">
                    En negociación
                  </span>
                )}
                {req.offers > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MessageCircle className="w-3 h-3" /> {req.offers}
                  </span>
                )}
              </div>
              
              <button 
                onClick={() => navigate('/responses')}
                className="text-primary text-sm font-medium flex items-center hover:underline"
              >
                Ver <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {activeRequests.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            No tienes solicitudes activas
          </div>
        )}
      </div>

      <UserBottomNav />
    </div>
  );
}
