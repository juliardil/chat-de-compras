import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { RefreshCw, CheckCircle2, ShoppingBag } from 'lucide-react';
import SafeImage from '../../components/ui/SafeImage';
import { EmptyModule, LoadingModule } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import { fetchBuyerOrders, mapOrder, splitOrders, NOTICES } from '../../data/appData';

// Actualización estética Junio 2026

export default function History() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading, error, notice } = useModuleData(
    () => fetchBuyerOrders(user?.id),
    [user?.id]
  );

  const history = splitOrders(items.map(mapOrder)).completed;

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-white/30 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-800">Historial de Compras</h1>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {loading ? <LoadingModule label="Cargando historial…" /> : null}

        {!loading && history.map((item) => (
          <div key={item.id} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white/30 flex gap-4">
            <SafeImage src={item.image} alt={item.product} className="w-20 h-20 rounded-xl object-cover bg-white/50" />

            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-800 text-sm">{item.product}</h3>
                <span className="text-[#006E7A] font-bold text-sm">{item.price}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {item.store} {item.statusDetail ? `• ${item.statusDetail}` : ''}
              </p>

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#4B227A] flex items-center gap-1 bg-[#4B227A]/10 px-2 py-1 rounded-md border border-[#4B227A]/20">
                  <CheckCircle2 className="w-3 h-3" /> {item.statusLabel}
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

        {!loading && history.length === 0 && (
          <EmptyModule
            icon={ShoppingBag}
            title="Sin compras registradas"
            description="Tus compras completadas aparecerán aquí."
            notice={error || notice || NOTICES.orders}
            tone={error ? 'error' : 'info'}
          />
        )}
      </div>

      <UserBottomNav />
    </div>
  );
}
