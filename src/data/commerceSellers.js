// =============================================================================
// Capa de datos del equipo de vendedores afiliados.
//
// commerce_members es la fuente de verdad del rol. El dueño consulta el equipo
// con la RPC app_commerce_team; el vendedor consulta su propia membresía con
// app_my_seller_membership. Las operaciones de alta/edición/contraseña pasan por
// la Edge Function commerce-sellers porque requieren administrar usuarios de
// auth sin cerrar la sesión del dueño.
// =============================================================================

import { insforge, isInsforgeConfigured } from '../lib/insforge';
import { NOTICES, describeError, emptyResult } from './appData';

export const SELLER_DISABLED_MESSAGE =
  'Tu acceso de vendedor fue desactivado por la empresa.';

const asArray = (data) => {
  if (Array.isArray(data)) return data;
  return data ? [data] : [];
};

const runSellerRpc = async (name) => {
  if (!isInsforgeConfigured) return emptyResult(NOTICES.demo);
  try {
    const { data, error } = await insforge.database.rpc(name);
    if (error) return emptyResult(NOTICES.permissions, describeError(error));
    return { items: asArray(data), error: null, notice: null };
  } catch (error) {
    return emptyResult(NOTICES.permissions, describeError(error));
  }
};

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const sellerInitials = (fullName) =>
  String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

// Normaliza una fila de app_commerce_team para las tarjetas del equipo.
export const mapSellerMember = (row) => ({
  id: row?.id || null,
  userId: row?.user_id || null,
  fullName: row?.full_name || '',
  email: row?.email || '',
  avatarUrl: row?.avatar_url || null,
  role: row?.role === 'owner' ? 'owner' : 'seller',
  isActive: Boolean(row?.is_active),
  createdAt: row?.created_at || null,
  offersSent: finite(row?.offers_sent),
  salesClosed: finite(row?.sales_closed),
  salesAmount: finite(row?.sales_amount),
  rating:
    row?.rating === null || row?.rating === undefined || row?.rating === ''
      ? null
      : finite(row?.rating, null),
  initials: sellerInitials(row?.full_name),
});

export const fetchCommerceTeam = async () => {
  const result = await runSellerRpc('app_commerce_team');
  return { ...result, items: result.items.map(mapSellerMember) };
};

export const fetchMySellerMembership = async () => {
  const result = await runSellerRpc('app_my_seller_membership');
  const row = result.items[0] || null;
  return {
    ...result,
    item: row
      ? {
          id: row.id,
          commerceId: row.commerce_id,
          userId: row.user_id,
          fullName: row.full_name || '',
          email: row.email || '',
          avatarUrl: row.avatar_url || null,
          role: row.role === 'owner' ? 'owner' : 'seller',
          isActive: Boolean(row.is_active),
        }
      : null,
  };
};

// Invoca la Edge Function con el token de la sesión actual (el SDK lo adjunta
// automáticamente) y devuelve un contrato {ok, data, error} como el resto de la
// capa de datos.
export const invokeCommerceSellers = async (body) => {
  if (!isInsforgeConfigured) {
    return { ok: false, data: null, error: `No se guardó nada: ${NOTICES.demo}` };
  }

  try {
    const { data, error } = await insforge.functions.invoke('commerce-sellers', { body });
    if (error) return { ok: false, data: null, error: describeError(error) };
    return { ok: true, data: data || null, error: null };
  } catch (error) {
    return { ok: false, data: null, error: describeError(error) };
  }
};

const memberFromResponse = (data) => {
  const raw = Array.isArray(data?.member) ? data.member[0] : data?.member;
  return raw ? mapSellerMember(raw) : null;
};

export const createSeller = async (payload) => {
  const result = await invokeCommerceSellers({ action: 'create', ...payload });
  return { ...result, member: memberFromResponse(result.data) };
};

export const updateSeller = async (memberId, payload) => {
  const result = await invokeCommerceSellers({
    action: 'update',
    memberId,
    ...payload,
  });
  return { ...result, member: memberFromResponse(result.data) };
};

export const setSellerActive = async (memberId, isActive) => {
  const result = await invokeCommerceSellers({
    action: 'set_active',
    memberId,
    isActive,
  });
  return { ...result, member: memberFromResponse(result.data) };
};

export const resetSellerPassword = async (memberId, password) => {
  const result = await invokeCommerceSellers({
    action: 'reset_password',
    memberId,
    password,
  });
  return { ...result, success: Boolean(result.data?.success) };
};
