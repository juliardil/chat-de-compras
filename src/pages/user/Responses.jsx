import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Star, MessageCircle, MapPin, Package, Check, X as XIcon, Store } from 'lucide-react';
import Button from '../../components/ui/Button';
import SafeImage from '../../components/ui/SafeImage';
import { EmptyModule, LoadingModule, DataNotice } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import { fetchBuyerOffers, mapOffer, NOTICES } from '../../data/appData';

// Actualización estética Junio 2026

export default function Responses() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [selectedAvailability, setSelectedAvailability] = useState(null);

  // La solicitud viene del formulario (datos reales que escribió la persona).
  const requestDraft = Array.isArray(location.state?.products) ? location.state.products[0] : null;
  const requestId = location.state?.requestId || null;
  const publishError = location.state?.publishError || null;

  const { items, loading, error, notice } = useModuleData(
    () => (requestId ? fetchBuyerOffers(user?.id) : Promise.resolve({ items: [], error: null, notice: NOTICES.offers })),
    [user?.id, requestId]
  );

  const offers = items.map(mapOffer);
  const requestTitle = requestDraft?.item || (requestId ? 'Solicitud de compra' : 'Sin solicitud seleccionada');
  const requestDetail = requestDraft
    ? [requestDraft.vehicleBrand, requestDraft.vehicleModel, requestDraft.yearFrom]
        .filter(Boolean)
        .join(' ')
    : 'Las ofertas se muestran al abrir una solicitud publicada.';

  return (
    <div className="min-h-screen bg-[#E7E7E7] flex flex-col">
      <header className="bg-white/80 backdrop-blur-md px-4 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-10 border-b border-white/30">
        <button aria-label="Volver a categorías" onClick={() => navigate('/categories')} className="p-2 -ml-2 hover:bg-white/50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Respuestas</h1>
          <p className="text-xs text-[#006E7A] font-medium">
            {loading ? 'Cargando ofertas…' : `${offers.length} ${offers.length === 1 ? 'oferta recibida' : 'ofertas recibidas'}`}
          </p>
        </div>
      </header>

      {publishError ? (
        <div className="px-4 pt-4">
          <DataNotice tone="error">{publishError}</DataNotice>
        </div>
      ) : null}

      {/* Fixed Request Summary */}
      <div className="bg-[#0197AF]/10 px-6 py-4 border-b border-[#0197AF]/20">
        <div className="flex items-start gap-3">
          <div className="bg-white/80 p-2 rounded-lg shadow-sm border border-white/30">
            <Store className="w-6 h-6 text-[#006E7A]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{requestTitle}</h3>
            <p className="text-sm text-gray-600">{requestDetail}</p>
          </div>
        </div>
      </div>

      {/* Offers List */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {loading ? <LoadingModule label="Cargando ofertas…" /> : null}

        {!loading && offers.map((offer) => (
          <div key={offer.id} className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/30">
            <div className="flex gap-4">
              <SafeImage src={null} alt={offer.store} className="w-20 h-20 rounded-xl object-cover bg-white/70" />
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-gray-800">{offer.store}</h3>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {offer.items.length > 0 && (
                      <button
                        onClick={() => setSelectedAvailability(offer)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors hover:opacity-80 border ${
                          offer.found === offer.total
                            ? 'bg-[#00EED0]/20 text-[#4B227A] border-[#00EED0]/30'
                            : 'bg-[#4B227A]/20 text-[#4B227A] border-[#4B227A]/30'
                        }`}
                      >
                        <Package className="w-3 h-3" />
                        {offer.found}/{offer.total}
                      </button>
                    )}
                    {offer.deliveryDays !== null && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 bg-white/70 px-2 py-1 rounded-full border border-white/30">
                        <Clock className="w-3 h-3" />
                        {offer.deliveryDays} días
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-gray-600 bg-white/70 px-2 py-1 rounded-full border border-white/30">
                      <MapPin className="w-3 h-3" />
                      Comercio
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-3 h-3 text-[#006E7A]" />
                  <span className="text-xs font-medium">Sin calificación</span>
                </div>

                <div className="text-lg font-bold text-[#006E7A] mb-2">
                  {offer.price}
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4 line-clamp-2 bg-white/70 p-2 rounded-lg border border-white/30">
              {offer.conditions || 'Sin condiciones adicionales.'}
            </p>

            <Button
              fullWidth
              size="sm"
              onClick={() => navigate(`/chat/${offer.requestId || offer.id}`)}
              className="py-2.5"
            >
              <MessageCircle className="w-4 h-4" />
              CHATEAR
            </Button>
          </div>
        ))}

        {!loading && offers.length === 0 && (
          <EmptyModule
            icon={Package}
            title="Sin ofertas"
            description="Todavía no hay ofertas de comercios para esta solicitud."
            notice={error || notice || NOTICES.offers}
            tone={error ? 'error' : 'info'}
          />
        )}
      </div>

      {/* Availability Modal */}
      {selectedAvailability && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/80 backdrop-blur-md w-full max-w-sm rounded-2xl p-6 shadow-xl border border-white/30 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedAvailability(null)}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
            >
              <XIcon className="w-6 h-6" />
            </button>

            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#006E7A]" />
              Disponibilidad de Productos
            </h3>

            <div className="space-y-3">
              {selectedAvailability.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/70 border border-white/30">
                  <span className="text-sm font-medium text-gray-800">{item.name}</span>
                  {item.status === 'available' ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-[#4B227A] bg-[#00EED0]/20 px-2 py-1 rounded-lg border border-[#00EED0]/30">
                      <Check className="w-3 h-3" /> Disponible
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-gray-800 bg-[#4B227A]/20 px-2 py-1 rounded-lg border border-[#4B227A]/30">
                      <XIcon className="w-3 h-3" /> No disponible
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/30 flex justify-between items-center">
              <span className="text-sm text-gray-600">Resumen</span>
              <span className="font-bold text-gray-800">
                {selectedAvailability.found} de {selectedAvailability.total} encontrados
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
