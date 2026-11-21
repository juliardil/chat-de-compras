// =============================================================================
// Capa de datos del módulo avanzado de clubes.
//
// Usa únicamente las RPC propias creadas en
// migrations/20261117170000_clubs-sponsorships-advanced.sql. No toca las reglas
// de comercios, talleres, ofertas ni pedidos. Mantiene el contrato
// `{ items, error, notice }` del resto de módulos y nunca inventa datos.
// =============================================================================

import { avatarsBucket, insforge, isInsforgeConfigured } from '../lib/insforge';
import {
  emptyResult,
  MAX_PROFILE_PHOTO_BYTES,
  NOTICES,
  runQuery,
  runWrite,
  validateProfilePhoto,
} from './appData';

export const CLUB_ADVANCED_NOTICES = {
  identity: 'No se pudo cargar la identidad de tu club.',
  members: 'No se pudo cargar la lista de miembros del club.',
  messages: 'No se pudo cargar el chat de tu club.',
  events: 'No se pudieron cargar las actividades del club.',
  sponsors: 'No se pudieron cargar las marcas patrocinadoras.',
  impact: 'No se pudo cargar el reporte de impacto de tu patrocinio.',
  saveIdentity: 'No se pudo actualizar la identidad del club. Verifica que seas el responsable.',
  sendMessage: 'No se pudo enviar el mensaje al canal del club.',
  event: 'No se pudo crear la actividad del club.',
  rsvp: 'No se pudo registrar tu asistencia.',
  avatar: 'No se pudo subir la imagen del club.',
  uploadImage: 'No se pudo subir la imagen al club.',
};

// -----------------------------------------------------------------------------
// Identidad visual
// -----------------------------------------------------------------------------
export const fetchClubIdentity = () =>
  runQuery((db) => db.rpc('app_club_identity'), CLUB_ADVANCED_NOTICES.identity);

export const updateClubIdentity = ({ avatarUrl, badgeEmoji, color, description }) =>
  runWrite(
    (db) =>
      db.rpc('app_update_group_identity', {
        p_avatar_url: avatarUrl ?? null,
        p_badge_emoji: badgeEmoji ?? '🏁',
        p_color: color ?? '#4B227A',
        p_description: description ?? null,
      }),
    CLUB_ADVANCED_NOTICES.saveIdentity
  );

const avatarExtension = (file) => {
  const name = String(file?.name || '');
  const dot = name.lastIndexOf('.');
  const extension = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
    return extension === 'jpeg' ? 'jpg' : extension;
  }
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[
    file?.type
  ] || 'jpg';
};

// Sube el avatar del club al bucket público de avatares y devuelve la URL.
export const uploadClubAvatar = async ({ groupId, file }) => {
  const validation = validateProfilePhoto(file);
  if (validation) return { url: null, key: null, error: validation };

  if (!isInsforgeConfigured) {
    return { url: URL.createObjectURL(file), key: null, error: null, demo: true };
  }

  if (!groupId) {
    return {
      url: null,
      key: null,
      error: 'No hay un club activo para subir la imagen.',
    };
  }

  const path = `clubs/${groupId}/avatar-${Date.now()}.${avatarExtension(file)}`;

  try {
    const { data, error } = await insforge.storage.from(avatarsBucket).upload(path, file);
    if (error) return { url: null, key: null, error: describeUploadError(error) };
    return { url: data?.url || data?.publicUrl || path, key: path, error: null };
  } catch (error) {
    return { url: null, key: null, error: describeUploadError(error) };
  }
};

const describeUploadError = (error) =>
  error?.message || error?.error || CLUB_ADVANCED_NOTICES.avatar;

const describeImageUploadError = (error) =>
  error?.message || error?.error || CLUB_ADVANCED_NOTICES.uploadImage;

// -----------------------------------------------------------------------------
// Imágenes y flyers del club
// -----------------------------------------------------------------------------
const CLUB_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const clubImageExtension = (file) => {
  const name = String(file?.name || '');
  const dot = name.lastIndexOf('.');
  const extension = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return extension === 'jpeg' ? 'jpg' : extension;
  }
  return CLUB_IMAGE_TYPES[String(file?.type || '').toLowerCase()] || null;
};

// Los flyers y fotos del club aceptan solo JPG, PNG o WEBP y hasta 5 MB.
export const validateClubImage = (file) => {
  if (!file) return 'Selecciona una imagen JPG, PNG o WEBP.';
  const type = String(file.type || '').toLowerCase();
  if (type && !CLUB_IMAGE_TYPES[type]) return 'Usa una imagen JPG, PNG o WEBP.';
  if (!clubImageExtension(file)) return 'Usa una imagen JPG, PNG o WEBP.';
  if (Number(file.size) > MAX_PROFILE_PHOTO_BYTES) return 'La imagen no puede superar 5 MB.';
  return null;
};

// Sube al bucket público `avatars` en clubs/{groupId}/events|chat/...
// La RPC con SECURITY DEFINER comprueba group_is_member antes de subir.
export const uploadClubImage = async ({ groupId, file, kind = 'chat' }) => {
  const validation = validateClubImage(file);
  if (validation) return { url: null, key: null, error: validation };

  const extension = clubImageExtension(file);
  if (!extension) return { url: null, key: null, error: 'Usa una imagen JPG, PNG o WEBP.' };

  if (!isInsforgeConfigured) {
    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : null;
    return { url: previewUrl, key: null, error: null, demo: true };
  }

  if (!groupId) {
    return {
      url: null,
      key: null,
      error: 'No hay un club activo para subir la imagen.',
    };
  }

  try {
    const { data: canUpload, error: accessError } = await insforge.database.rpc(
      'app_group_can_upload_image',
      { p_group_id: groupId }
    );
    if (accessError) return { url: null, key: null, error: describeImageUploadError(accessError) };
    if (canUpload !== true) {
      return { url: null, key: null, error: 'Solo los miembros del club pueden publicar imágenes.' };
    }

    const folder = kind === 'events' ? 'events' : 'chat';
    const suffix = Math.random().toString(36).slice(2, 8);
    const path = `clubs/${groupId}/${folder}/image-${Date.now()}-${suffix}.${extension}`;
    const { data, error } = await insforge.storage.from(avatarsBucket).upload(path, file);
    if (error) return { url: null, key: null, error: describeImageUploadError(error) };
    return { url: data?.url || data?.publicUrl || path, key: path, error: null };
  } catch (error) {
    return { url: null, key: null, error: describeImageUploadError(error) };
  }
};

// -----------------------------------------------------------------------------
// Miembros del club
// -----------------------------------------------------------------------------
export const fetchClubMembers = () =>
  runQuery((db) => db.rpc('app_group_members'), CLUB_ADVANCED_NOTICES.members);

// -----------------------------------------------------------------------------
// Chat interno del club
// -----------------------------------------------------------------------------
export const fetchClubMessages = () =>
  runQuery((db) => db.rpc('app_group_messages', { p_limit: 40 }), CLUB_ADVANCED_NOTICES.messages);

export const sendClubMessage = (body, imageUrl = null) =>
  runWrite(
    (db) =>
      db.rpc('app_group_send_message', {
        p_body: body,
        p_image_url: imageUrl ?? null,
      }),
    CLUB_ADVANCED_NOTICES.sendMessage
  );

// -----------------------------------------------------------------------------
// Eventos y asistencia
// -----------------------------------------------------------------------------
export const fetchClubEvents = () =>
  runQuery((db) => db.rpc('app_group_events'), CLUB_ADVANCED_NOTICES.events);

export const createClubEvent = ({ title, description, location, startsAt, imageUrl = null }) =>
  runWrite(
    (db) =>
      db.rpc('app_group_create_event', {
        p_title: title,
        p_description: description || null,
        p_location: location || null,
        p_starts_at: startsAt,
        p_image_url: imageUrl ?? null,
      }),
    CLUB_ADVANCED_NOTICES.event
  );

export const rsvpClubEvent = (eventId, status) =>
  runWrite(
    (db) => db.rpc('app_group_rsvp', { p_event_id: eventId, p_status: status }),
    CLUB_ADVANCED_NOTICES.rsvp
  );

// -----------------------------------------------------------------------------
// Patrocinios y métrica de impacto para la marca
// -----------------------------------------------------------------------------
export const fetchClubSponsors = () =>
  runQuery((db) => db.rpc('app_club_sponsors'), CLUB_ADVANCED_NOTICES.sponsors);

export const fetchSponsorImpact = () => {
  if (!isInsforgeConfigured) {
    return Promise.resolve(emptyResult(NOTICES.demo));
  }
  return runQuery((db) => db.rpc('app_sponsor_impact'), CLUB_ADVANCED_NOTICES.impact);
};
