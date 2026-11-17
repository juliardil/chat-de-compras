// =============================================================================
// Capa de datos · Respuestas de mis ofertas y chat de negociación.
//
// Reutiliza purchase_offers / chat_threads / chat_messages a través de RPCs
// SECURITY DEFINER (migración 20261117180000). El servidor comprueba que la
// oferta pertenezca al taller o comercio de la sesión: aquí no se confía en el
// id recibido desde la interfaz.
//
// El contrato de errores es el mismo que el resto de la app: nunca se inventan
// datos y en modo demostración se devuelven listas vacías con un aviso.
// =============================================================================

import { insforge, isInsforgeConfigured } from '../lib/insforge';
import { describeError, runQuery, runWrite } from './appData';

export const OFFER_RESPONSE_NOTICES = {
  load: 'No se pudieron cargar las respuestas de tus ofertas. Verifica tu sesión e inténtalo de nuevo.',
  detail: 'No se pudo cargar la negociación. Verifica tu sesión e inténtalo de nuevo.',
  message: 'No se pudo enviar el mensaje. Revisa tu sesión e inténtalo de nuevo.',
  notes: 'No se pudieron guardar los detalles del servicio. Inténtalo de nuevo.',
  confirm: 'No se pudo confirmar el servicio. Inténtalo de nuevo.',
};

// Bandeja del proveedor: solo sus propias ofertas (workshop_id / commerce_id).
export const fetchMyOfferResponses = () =>
  runQuery((db) => db.rpc('app_my_offer_responses'), OFFER_RESPONSE_NOTICES.load);

// Oferta + mensajes del hilo, con comprobación de propiedad en el backend.
// La RPC devuelve UN objeto `{ offer, messages }`; runQuery lo envuelve en un
// array, así que aquí lo reconstruimos para la pantalla de chat.
export const fetchOfferNegotiation = async (offerId) => {
  const result = await runQuery(
    (db) => db.rpc('app_offer_negotiation', { p_offer_id: offerId }),
    OFFER_RESPONSE_NOTICES.detail
  );
  const payload = result.items?.[0];
  if (result.error || !payload?.offer) return result;
  return {
    ...result,
    items: Array.isArray(payload.messages) ? payload.messages : [],
    extra: payload.offer,
  };
};

export const sendOfferNegotiationMessage = (offerId, body) =>
  runWrite(
    (db) =>
      db.rpc('app_send_offer_negotiation_message', {
        p_offer_id: offerId,
        p_body: body,
      }),
    OFFER_RESPONSE_NOTICES.message
  );

export const saveOfferNegotiationNotes = (offerId, notes) =>
  runWrite(
    (db) =>
      db.rpc('app_save_offer_negotiation_notes', {
        p_offer_id: offerId,
        p_notes: notes || '',
      }),
    OFFER_RESPONSE_NOTICES.notes
  );

export const confirmOfferService = (offerId) =>
  runWrite(
    (db) => db.rpc('app_confirm_offer_service', { p_offer_id: offerId }),
    OFFER_RESPONSE_NOTICES.confirm
  );

// Suscripción en tiempo real al canal de una oferta.
// Devuelve siempre una función de limpieza, también en modo demostración.
export function subscribeOfferNegotiation(offerId, handlers = {}) {
  const realtime = insforge?.realtime;
  if (!isInsforgeConfigured || !offerId || !realtime?.subscribe) return () => {};

  const channel = `offer-negotiation:${offerId}`;
  let active = true;

  const scoped = (event) => (payload) => {
    if (!active) return;
    // El cliente puede tener varios canales abiertos: ignora eventos ajenos.
    if (payload?.meta?.channel && payload.meta.channel !== channel) return;
    if (payload?.offerId && payload.offerId !== offerId) return;
    handlers[event]?.(payload);
  };

  const onMessage = scoped('onMessage');
  const onConfirmation = scoped('onConfirmation');

  realtime.on?.('message_created', onMessage);
  realtime.on?.('confirmation_changed', onConfirmation);

  Promise.resolve()
    .then(() => realtime.subscribe(channel))
    .then((response) => {
      if (!active) {
        realtime.unsubscribe?.(channel);
        return;
      }
      if (response && response.ok === false) {
        handlers.onError?.(
          response.error?.message || 'No se pudo conectar con el chat en tiempo real.'
        );
      } else {
        handlers.onConnected?.();
      }
    })
    .catch((error) => {
      if (active) handlers.onError?.(describeError(error, OFFER_RESPONSE_NOTICES.detail));
    });

  return () => {
    active = false;
    realtime.off?.('message_created', onMessage);
    realtime.off?.('confirmation_changed', onConfirmation);
    realtime.unsubscribe?.(channel);
  };
}
