// =============================================================================
// Capa de datos del módulo de comunidades / clubes de compradores.
//
// Módulo aislado: usa únicamente las RPC propias creadas en
// migrations/20261117020000_groups-communities.sql. No lee ni escribe las
// tablas purchase_requests, purchase_offers, commerce_profiles ni sus RLS.
// Reutiliza el contrato `{ items, error, notice }` de la capa principal.
// =============================================================================

import { isInsforgeConfigured } from '../lib/insforge';
import { emptyResult, NOTICES, runQuery, runWrite } from './appData';

export const COMMUNITY_NOTICES = {
  load: 'No se pudo cargar tu club. Verifica tu sesión e inténtalo de nuevo.',
  badges: 'No se pudieron cargar las insignias de club de las solicitudes.',
  create: 'No se pudo crear el club. Revisa el nombre y vuelve a intentarlo.',
  join: 'No se pudo unir al club. Verifica el código de invitación.',
  leave: 'No se pudo salir del club. Inténtalo de nuevo.',
};

// Estado del club del usuario autenticado. `items[0]` es null cuando no
// pertenece a ninguno; el código de invitación solo llega a sus miembros.
export const fetchMyGroup = () =>
  runQuery((db) => db.rpc('app_my_group'), COMMUNITY_NOTICES.load);

export const createGroup = ({ name, inviteCode = null }) =>
  runWrite(
    (db) =>
      db.rpc('app_create_group', {
        p_name: name,
        p_invite_code: inviteCode || null,
      }),
    COMMUNITY_NOTICES.create
  );

export const joinGroup = ({ inviteCode }) =>
  runWrite(
    (db) => db.rpc('app_join_group', { p_invite_code: inviteCode }),
    COMMUNITY_NOTICES.join
  );

export const leaveGroup = () =>
  runWrite((db) => db.rpc('app_leave_group'), COMMUNITY_NOTICES.leave);

// Insignias para el vendedor. Recibe ids de buyer_profiles (tal como vienen en
// purchase_requests.buyer_id); la RPC resuelve el mapeo al usuario del club.
// Solo devuelve clubes verificados y nunca el código de invitación.
export const fetchGroupBadges = (buyerIds = []) => {
  if (!isInsforgeConfigured) {
    return Promise.resolve(emptyResult(NOTICES.demo));
  }

  const ids = [...new Set((Array.isArray(buyerIds) ? buyerIds : []).filter(Boolean))];
  if (ids.length === 0) {
    return Promise.resolve(emptyResult(null));
  }

  return runQuery(
    (db) => db.rpc('app_group_badges', { p_buyer_ids: ids }),
    COMMUNITY_NOTICES.badges
  );
};
