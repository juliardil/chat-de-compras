import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Package, Store, Clock, Tags, AlertTriangle } from 'lucide-react';
import Button from '../../components/ui/Button';
import UserBottomNav from '../../components/layout/UserBottomNav';
import { EmptyModule, LoadingModule } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import {
  fetchBuyerOffers,
  fetchBuyerRequests,
  mapOffer,
  mapRequest,
  NOTICES,
} from '../../data/appData';

// Sección «Ofertas» del comprador.
// No crea una segunda lógica de ofertas: reutiliza las mismas consultas
// (fetchBuyerOffers / fetchBuyerRequests) y los mismos mapeos (mapOffer /
// mapRequest) que usa el detalle de la solicitud en Responses. Solo agrupa
// las propuestas ya recibidas por producto y expone el acceso a la
// conversación existente con cada comercio.
export default function Offers() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { items, extra, loading, error, notice } = useModuleData(async () => {
    const [offersResult, requestsResult] = await Promise.all([
      fetchBuyerOffers(user?.id),
      fetchBuyerRequests(user?.id),
    ]);

    return {
      items: offersResult.items,
      extra: requestsResult.items,
      error: offersResult.error || requestsResult.error || null,
      notice: offersResult.notice || requestsResult.notice || null,
    };
  }, [user?.id]);

  const offers = items.map(mapOffer);
  const requests = (extra || []).map(mapRequest);
  const requestById = new Map(requests.map((request) => [request.id, request]));

  // Agrupa por solicitud (producto publicado), conservando el orden en que
  // llegan las ofertas (más recientes primero).
  const groups = [];
  const groupIndex = new Map();

  offers.forEach((offer) => {
    const key = offer.requestId || offer.id;
    let index = groupIndex.get(key);

    if (index === undefined) {
      const request = requestById.get(key);
      index = groups.length;
      groupIndex.set(key, index);
      groups.push({
        key,
        product: request?.product || 'Solicitud de compra',
        description: request?.description || '',
        statusLabel: request?.statusLabel || '',
        items: request?.items || [],
        offers: [],
      });
    }

    groups[index].offers.push(offer);
  });

  return (
    <div className="min-h-screen bg-[#E7E7E7] pb-24">
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-white/30 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Tags className="w-5 h-5 text-[#006E7A]" />
          Ofertas
        </h1>
        <p className="text-xs text-[#006E7A] font-medium">
          {loading
            ? 'Cargando ofertas…'
            : `${offers.length} ${offers.length === 1 ? 'oferta recibida' : 'ofertas recibidas'}`}
        </p>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {loading ? <LoadingModule label="Cargando ofertas…" /> : null}

        {!loading && groups.map((group) => (
          <section
            key={group.key}
            className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/30"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Producto</p>
                <h2 className="font-bold text-gray-800">{group.product}</h2>
                {group.description ? (
                  <p className="text-sm text-gray-600 line-clamp-2">{group.description}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-[11px] font-bold text-[#4B227A] bg-[#4B227A]/10 px-2 py-1 rounded-full border border-[#4B227A]/20">
                {group.offers.length} {group.offers.length === 1 ? 'oferta' : 'ofertas'}
              </span>
            </div>

            {group.items.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {group.items.map((item, index) => (
                  <span
                    key={`${group.key}-item-${index}`}
                    className="text-[11px] text-gray-700 bg-white/70 px-2 py-1 rounded-full border border-white/40"
                  >
                    {item.product || 'Producto'} × {item.quantity}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              {group.offers.map((offer) => (
                <article
                  key={offer.id}
                  className="rounded-xl border border-white/40 bg-white/70 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#0197AF]/15 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 text-[#006E7A]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{offer.store}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                          {offer.deliveryDays !== null ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {offer.deliveryDays} días
                            </span>
                          ) : null}
                          {offer.total > 0 ? (
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {offer.found}/{offer.total} disponibles
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 font-bold text-[#006E7A]">{offer.price}</span>
                  </div>

                  {offer.conditions ? (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2 bg-white/70 p-2 rounded-lg border border-white/30">
                      {offer.conditions}
                    </p>
                  ) : null}

                  {offer.items.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {offer.items.map((item, index) => (
                        <li
                          key={`${offer.id}-availability-${index}`}
                          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${
                            item.status === 'available'
                              ? 'text-[#4B227A] bg-[#00EED0]/20 border-[#00EED0]/30'
                              : 'text-gray-700 bg-[#4B227A]/10 border-[#4B227A]/20'
                          }`}
                        >
                          {item.status === 'available' ? null : <AlertTriangle className="w-3 h-3" />}
                          {item.name} × {item.quantity}
                          {item.status === 'available'
                            ? item.priceLabel
                              ? ` · ${item.priceLabel}`
                              : ''
                            : ' (no disponible)'}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {/* Misma clave de conversación que usa el detalle de la
                      oferta existente: no se crea un chat nuevo. */}
                  <Button
                    fullWidth
                    onClick={() => navigate(`/chat/${offer.requestId || offer.id}`)}
                    className="mt-3 py-2.5 text-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Mensajes
                  </Button>
                </article>
              ))}
            </div>
          </section>
        ))}

        {!loading && groups.length === 0 ? (
          <EmptyModule
            icon={Package}
            title="Sin ofertas recibidas"
            description="Cuando un comercio responda a tus productos publicados, sus propuestas aparecerán aquí agrupadas por producto."
            notice={error || notice || NOTICES.offers}
            tone={error ? 'error' : 'info'}
          />
        ) : null}
      </div>

      <UserBottomNav />
    </div>
  );
}
