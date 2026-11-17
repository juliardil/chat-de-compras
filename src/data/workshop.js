// =============================================================================
// Capa de datos del módulo de Talleres Verificados.
//
// Módulo aislado: usa únicamente las RPC propias creadas en
// migrations/20261117040000_workshops-verified.sql. No modifica solicitudes,
// ofertas, clubes ni sus políticas. Reutiliza el contrato de errores de appData.
// =============================================================================

import { runQuery, runWrite } from './appData';

export const WORKSHOP_NOTICES = {
  load: 'No se pudo cargar el registro de tu taller. Verifica tu sesión e inténtalo de nuevo.',
  save: 'No se pudo guardar el taller. Revisa los datos e inténtalo de nuevo.',
  jobs: 'No se pudieron cargar los trabajos disponibles. Inténtalo de nuevo.',
  proposals: 'No se pudieron cargar tus propuestas. Inténtalo de nuevo.',
  proposal: 'No se pudo enviar la propuesta. Revisa los datos e inténtalo de nuevo.',
  chat: 'No se pudo abrir la conversación con el cliente. Inténtalo de nuevo.',
  history: 'No se pudo cargar el historial por placa. Inténtalo de nuevo.',
};

// Catálogo sugerido. El usuario puede combinar varias; la RPC persistirá el
// arreglo resultante en workshop_profiles.specialties.
export const WORKSHOP_SPECIALTIES = [
  'Mecánica general',
  'Motos',
  'Electricidad',
  'Latonería',
  'Pintura',
  'Aire acondicionado',
  'Frenos',
  'Suspensión',
  'Diagnóstico electrónico',
];

// Devuelve cero filas cuando el usuario autenticado todavía no registró taller.
export const fetchMyWorkshop = () =>
  runQuery((db) => db.rpc('app_my_workshop'), WORKSHOP_NOTICES.load);

export const saveWorkshop = ({
  workshopName,
  nitOrId,
  address,
  phone,
  specialties = [],
}) =>
  runWrite(
    (db) =>
      db.rpc('app_save_workshop', {
        p_workshop_name: workshopName,
        p_nit_or_id: nitOrId,
        p_address: address,
        p_phone: phone,
        p_specialties: specialties,
      }),
    WORKSHOP_NOTICES.save
  );

// -----------------------------------------------------------------------------
// Fase 3 · Marketplace de servicios
// -----------------------------------------------------------------------------
// Solicitudes de instalación/reparación abiertas, con insignia de club activo.
export const fetchAvailableServiceJobs = () =>
  runQuery((db) => db.rpc('app_available_service_jobs'), WORKSHOP_NOTICES.jobs);

export const fetchMyServiceProposals = () =>
  runQuery((db) => db.rpc('app_my_service_proposals'), WORKSHOP_NOTICES.proposals);

// Cotización reutilizando purchase_offers: precio de mano de obra, tiempo
// estimado y notas. El backend valida que el taller esté activo y verificado.
export const createServiceProposal = ({ requestId, laborAmount, estimatedDays, notes = '' }) =>
  runWrite(
    (db) =>
      db.rpc('app_create_service_proposal', {
        p_request_id: requestId,
        p_labor_amount: laborAmount,
        p_estimated_days: estimatedDays,
        p_notes: notes || null,
      }),
    WORKSHOP_NOTICES.proposal
  );

// Abre el mismo chat_threads / chat_messages del flujo de ofertas.
export const openWorkshopOfferChat = (offerId) =>
  runQuery(
    (db) => db.rpc('app_open_workshop_offer_chat', { p_offer_id: offerId }),
    WORKSHOP_NOTICES.chat
  );

// -----------------------------------------------------------------------------
// Fase 4 · Historial por placa
// -----------------------------------------------------------------------------
export const fetchWorkshopPlateHistory = (plate = '') =>
  runQuery(
    (db) => db.rpc('app_workshop_plate_history', { p_plate: plate || null }),
    WORKSHOP_NOTICES.history
  );
