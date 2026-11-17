import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Package,
  Store,
  Clock,
  Tags,
  AlertTriangle,
  MapPin,
  Star,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import UserBottomNav from '../../components/layout/UserBottomNav';
import OfferSortBar from '../../components/ui/OfferSortBar';
import BrandOptionPicker from '../../components/ui/BrandOptionPicker';
import { EmptyModule, LoadingModule, DataNotice } from '../../components/ui/ModuleState';
import { useAuth } from '../../context/auth-context';
import { useModuleData } from '../../data/useModuleData';
import { sortOfferGroups } from '../../data/offerSort';
import {
  fetchBuyerOffers,
  fetchBuyerRequests,
  mapOffer,
  mapRequest,
  offerOptionAgreement,
  openChatForOffer,
  selectOfferOption,
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
  const [openingOfferId, setOpeningOfferId] = useState(null);
  const [chatError, setChatError] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectingOfferId, setSelectingOfferId] = useState(null);
  const [selectionError, setSelectionError] = useState('');
  const [sortKey, setSortKey] = useState('distance');

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

  const offers = items.map((row) => mapOffer(row, user?.location));
  const requests = (extra || []).map(mapRequest);
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const normalizeText = (value) => String(value || '').trim().toLowerCase();

  // Agrupa por solicitud (producto publicado), conservando el orden en que
  // llegan las ofertas (más recientes primero).
  const groups = [];
  const groupIndex = new Map();

  offers.forEach((offer) => {
    const key = offer.requestId || offer.id;
    let index = groupIndex.get(key);

    if (index === undefined) {
      const request = requestById.get(key);
      const product = request?.product || 'Solicitud de compra';
      const description = request?.description || '';
      const requestItems = request?.items || [];

      index = groups.length;
      groupIndex.set(key, index);
      groups.push({
        key,
        product,
        description,
        // El nombre del producto se muestra una sola vez: la descripción y
        // los ítems solo se muestran cuando aportan información distinta.
        showDescription:
          Boolean(description) && normalizeText(description) !== normalizeText(product),
        statusLabel: request?.statusLabel || '',
        items: requestItems,
        showItems:
          requestItems.length > 1 ||
          (requestItems.length === 1 &&
            normalizeText(requestItems[0].product) !== normalizeText(product)),
        offers: [],
      });
    }

    groups[index].offers.push(offer);
  });

  // Ordenar también los grupos por su mejor oferta hace que el selector tenga
  // efecto aunque cada producto haya recibido una sola propuesta.
  const sortedGroups = sortOfferGroups(groups, sortKey);

  // La elección del comprador puede venir ya guardada (recarga) o del radio
  // que acaba de marcar en esta pantalla.
  const selectedFor = (offer) => {
    const id = selectedOptions[offer.id] ?? offer.selectedOption?.id ?? null;
    return offer.brandOptions.find((option) => option.id === id) || null;
  };

  const handleSelectOption = async (offer, option) => {
    if (selectingOfferId === offer.id || selectedFor(offer)?.id === option.id) return;

    const previousId = selectedOptions[offer.id] ?? offer.selectedOption?.id ?? null;
    setSelectionError('');
    setSelectedOptions((current) => ({ ...current, [offer.id]: option.id }));
    setSelectingOfferId(offer.id);

    const result = await selectOfferOption({ offerId: offer.id, optionId: option.id });
    setSelectingOfferId(null);

    if (!result.ok) {
      setSelectedOptions((current) => ({ ...current, [offer.id]: previousId }));
      setSelectionError(result.error || 'No se pudo guardar la marca elegida.');
    }
  };

  // Abre (o crea) el hilo real entre este comprador y el comercio de la oferta.
  const handleOpenChat = async (offer) => {
    if (openingOfferId) return;
    setChatError('');
    setOpeningOfferId(offer.id);

    const result = await openChatForOffer({
      userId: user?.id,
      offer,
      subject: offer.store,
      selectedOption: offerOptionAgreement(selectedFor(offer)),
    });

    setOpeningOfferId(null);

    if (!result.item) {
      setChatError(result.error || result.notice || NOTICES.chats);
      return;
    }

    navigate(`/chat/${result.item.id}`);
  };

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
        {chatError ? <DataNotice tone="error">{chatError}</DataNotice> : null}
        {selectionError ? <DataNotice tone="error">{selectionError}</DataNotice> : null}
        {loading ? <LoadingModule label="Cargando ofertas…" /> : null}

        {!loading && offers.length > 1 ? (
          <OfferSortBar value={sortKey} onChange={setSortKey} />
        ) : null}

        {!loading && sortedGroups.map((group) => (
          <section
            key={group.key}
            className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/30"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Producto</p>
                <h2 className="font-bold text-gray-800">{group.product}</h2>
                {group.showDescription ? (
                  <p className="text-sm text-gray-600 line-clamp-2">{group.description}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-[11px] font-bold text-[#4B227A] bg-[#4B227A]/10 px-2 py-1 rounded-full border border-[#4B227A]/20">
                {group.offers.length} {group.offers.length === 1 ? 'oferta' : 'ofertas'}
              </span>
            </div>

            {group.showItems ? (
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
                          {offer.distanceLabel ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {offer.distanceLabel}
                            </span>
                          ) : null}
                          {offer.deliveryDays !== null ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {offer.deliveryDays} días
                            </span>
                          ) : null}
                          {offer.rating !== null ? (
                            <span className="flex items-center gap-1 font-semibold text-[#006E7A]">
                              <Star className="w-3 h-3 fill-current" />
                              {offer.rating.toFixed(1)}
                              {offer.ratingCount > 0 ? ` (${offer.ratingCount})` : ''}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-500">
                              <Star className="w-3 h-3" />
                              Sin calificación
                            </span>
                          )}
                          {offer.total > 0 ? (
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {offer.found}/{offer.total} disponibles
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 font-bold text-[#006E7A]">
                      {selectedFor(offer)?.priceLabel || offer.price}
                    </span>
                  </div>

                  {offer.conditions ? (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2 bg-white/70 p-2 rounded-lg border border-white/30">
                      {offer.conditions}
                    </p>
                  ) : null}

                  <BrandOptionPicker
                    options={offer.brandOptions}
                    selectedId={selectedFor(offer)?.id || null}
                    onSelect={(option) => handleSelectOption(offer, option)}
                    busy={selectingOfferId === offer.id}
                    name={`brand-offers-${offer.id}`}
                  />

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

                  {/* Abre o reutiliza el hilo real comprador ↔ comercio. */}
                  <Button
                    fullWidth
                    onClick={() => handleOpenChat(offer)}
                    disabled={openingOfferId === offer.id}
                    className="mt-3 py-2.5 text-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {openingOfferId === offer.id
                      ? 'Abriendo chat…'
                      : selectedFor(offer)
                        ? `Mensajes · ${selectedFor(offer).brand}`
                        : 'Mensajes'}
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
