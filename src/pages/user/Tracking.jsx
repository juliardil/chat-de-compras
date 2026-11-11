import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { MessageCircle, ChevronRight, ClipboardList } from 'lucide-react';
import { EmptyModule, LoadingModule } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import { fetchBuyerRequests, mapRequest, NOTICES } from '../../data/appData';

// Actualización estética Junio 2026

export default function Tracking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading, error, notice } = useModuleData(
    () => fetchBuyerRequests(user?.id),
    [user?.id]
  );

  const activeRequests = items.map(mapRequest);

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-20">
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-white/30">
        <h1 className="text-xl font-bold text-gray-800">Mis Solicitudes</h1>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {loading ? <LoadingModule label="Cargando solicitudes…" /> : null}

        {!loading && activeRequests.map((req) => (
          <div key={req.id} className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/30">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-gray-800">{req.product}</h3>
              <span className="text-xs text-gray-600">{req.time}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-[#0197AF]/20 text-[#006E7A] px-2 py-1 rounded-md text-xs font-medium border border-[#0197AF]/30">
                  {req.statusLabel}
                </span>
                {req.offers > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-600">
                    <MessageCircle className="w-3 h-3" /> {req.offers}
                  </span>
                )}
              </div>

              <button
                onClick={() => navigate('/responses', { state: { requestId: req.id } })}
                className="text-[#006E7A] text-sm font-medium flex items-center hover:underline"
              >
                Ver <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {!loading && activeRequests.length === 0 && (
          <EmptyModule
            icon={ClipboardList}
            title="Sin solicitudes activas"
            description="Cuando publiques una solicitud de compra aparecerá aquí."
            notice={error || notice || NOTICES.requests}
            tone={error ? 'error' : 'info'}
          />
        )}
      </div>

      <UserBottomNav />
    </div>
  );
}
