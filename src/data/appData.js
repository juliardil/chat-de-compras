// =============================================================================
// Capa de datos de la app principal (comprador y comercio).
//
// Reglas de esta capa:
//   * Nunca devuelve datos inventados. Si una consulta falla o no hay backend,
//     devuelve `items: []` + `error`/`notice` para que la interfaz muestre un
//     estado vacío explícito.
//   * Los errores de InsForge se traducen a mensajes claros para el usuario
//     (permisos/RLS, red, sesión), en lugar de romper la pantalla.
//   * Las escrituras también se intentan de verdad; si el backend las rechaza,
//     el error se propaga con el mismo formato amigable.
//
// Contexto del backend: las tablas de negocio tienen políticas RLS por usuario
// (migración 20261111172450_app-rls.sql). La app resuelve el perfil real antes
// de consultar y las escrituras se rechazan si intentan tocar datos ajenos.
// =============================================================================

import { avatarsBucket, insforge, isInsforgeConfigured } from '../lib/insforge';
import {
  filterCompatibleRequests,
  hasCommerceSegmentation,
} from '../utils/matching';
import { fetchGroupBadges } from './community';
import {
  normalizeRecommendedOptions,
  normalizeRecommendationBudget,
} from './recommendations';

export const appMode = isInsforgeConfigured ? 'insforge' : 'demo';

export const NOTICES = {
  demo:
    'Modo demostración: no hay backend InsForge configurado, por eso este módulo se muestra vacío. No se usan datos de ejemplo.',
  permissions:
    'El backend rechazó la consulta por permisos. Verifica tu sesión y que tu perfil de comprador o comercio esté activo.',
  requests:
    'No se pudieron cargar tus solicitudes. Verifica tu sesión y tu perfil de comprador.',
  offers:
    'No se pudieron cargar las ofertas. Verifica tu sesión y tu perfil.',
  orders:
    'No se pudieron cargar los pedidos. Verifica tu sesión y tu perfil.',
  chats:
    'No se pudieron cargar las conversaciones. Verifica tu sesión y tu perfil.',
  notifications:
    'Todavía no existe un módulo de notificaciones en el backend. No se muestran datos de ejemplo.',
  reviews:
    'No se pudieron cargar las calificaciones. Verifica tu sesión y tu perfil.',
  commerceMetrics:
    'No se pudieron cargar las métricas del comercio. Verifica tu sesión y que tu comercio esté aprobado.',
  commercePending:
    'Tu comercio está pendiente de aprobación. Mientras no se apruebe no verás solicitudes abiertas ni podrás enviar ofertas.',
  commerceSegmentation:
    'Tu comercio todavía no tiene configurada su segmentación (vehículos y sistemas de inventario). Actualiza tu perfil para recibir solicitudes compatibles.',
  categories:
    'No se pudieron cargar las categorías.',
  write:
    'No se pudo guardar la operación. Verifica tu sesión y tus permisos.',
};

const PERMISSION_PATTERN =
  /permission|denied|not authorized|row[- ]level|rls|policy|jwt|401|403|insufficient privilege/i;
const NETWORK_PATTERN = /network|failed to fetch|fetch failed|timeout|timed out|offline|connection/i;

const normalizeMessage = (error) =>
  String(
    (error && (error.message || error.error || error.details || error.hint)) ||
      (typeof error === 'string' ? error : '') ||
      ''
  ).trim();

const errorStatus = (error) =>
  error?.statusCode ?? error?.status ?? error?.code ?? error?.cause?.statusCode ?? null;

// -----------------------------------------------------------------------------
// Distancias
// La distancia entre comprador y comercio se calcula con la fórmula de
// Haversine a partir de coordenadas reales. Si falta alguna coordenada se
// devuelve null: la interfaz no muestra una distancia inventada.
// -----------------------------------------------------------------------------
const EARTH_RADIUS_KM = 6371;

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const inputs = [lat1, lon1, lat2, lon2];
  // null/undefined/vacío significan «sin coordenada»; no deben convertirse en 0.
  if (inputs.some((value) => value === null || value === undefined || value === '')) return null;

  const values = inputs.map((value) => Number(value));
  if (!values.every((value) => Number.isFinite(value))) return null;

  const [fromLat, fromLon, toLat, toLon] = values;
  if (Math.abs(fromLat) > 90 || Math.abs(toLat) > 90) return null;
  if (Math.abs(fromLon) > 180 || Math.abs(toLon) > 180) return null;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function formatDistance(km) {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `${meters} m`;
  }
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Traduce cualquier error de InsForge/SDK a un mensaje entendible por el usuario.
export function describeError(error, fallback = 'No se pudo completar la operación.') {
  if (!error) return fallback;

  const message = normalizeMessage(error);
  const status = errorStatus(error);

  if (status === 401 || status === 403 || PERMISSION_PATTERN.test(message)) {
    return 'El backend rechazó la operación por permisos. Verifica tu sesión y que tu perfil esté activo.';
  }

  if (NETWORK_PATTERN.test(message)) {
    return 'No se pudo conectar con InsForge. Revisa tu conexión e inténtalo de nuevo.';
  }

  return message || fallback;
}

const asArray = (payload) => {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : [payload];
};

export const emptyResult = (notice, error = null) => ({ items: [], error, notice });

// Ejecuta una consulta de lectura y normaliza la respuesta. `build` recibe el
// cliente de base de datos y devuelve el builder de la consulta.
// Se exportan para que los módulos nuevos (p. ej. comunidades) reutilicen el
// mismo contrato de errores sin duplicar la lógica de esta capa.
export const runQuery = async (build, notice) => {
  if (!isInsforgeConfigured) {
    return emptyResult(NOTICES.demo);
  }

  try {
    const { data, error } = await build(insforge.database);
    if (error) {
      return emptyResult(notice, describeError(error));
    }
    return { items: asArray(data), error: null, notice: null };
  } catch (error) {
    return emptyResult(notice, describeError(error));
  }
};

// Ejecuta una escritura. Devuelve `{ ok, data, error }` sin lanzar excepciones
// para que cada pantalla decida qué mostrar.
export const runWrite = async (build, fallback) => {
  if (!isInsforgeConfigured) {
    return { ok: false, data: null, error: `No se guardó nada: ${NOTICES.demo}` };
  }

  try {
    const { data, error } = await build(insforge.database);
    if (error) return { ok: false, data: null, error: describeError(error, fallback) };
    return { ok: true, data: Array.isArray(data) ? data : data ? [data] : [], error: null };
  } catch (error) {
    return { ok: false, data: null, error: describeError(error, fallback) };
  }
};

const requireUserId = (userId, notice) => {
  if (!userId) {
    return emptyResult(notice, 'No hay una sesión activa para consultar estos datos.');
  }
  return null;
};

// -----------------------------------------------------------------------------
// Utilidades de formato compartidas por las pantallas
// -----------------------------------------------------------------------------
export function formatRelativeDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;

  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatClockTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export function formatCurrency(amount, currency = 'MXN') {
  if (amount === null || amount === undefined || amount === '') return '—';
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `$${numeric.toFixed(2)}`;
  }
}

// Estados reales según las migraciones (check constraints de las tablas).
export const REQUEST_STATUS_LABELS = {
  open: 'Recibiendo ofertas',
  hidden: 'Oculta',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export const ORDER_STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  shipped: 'En camino',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  disputed: 'En disputa',
};

// -----------------------------------------------------------------------------
// Perfil de comprador / comercio
// -----------------------------------------------------------------------------
// Crea el perfil de negocio la primera vez y lo mantiene sincronizado con
// auth.users.profile. El backend decide si la cuenta es comprador o comercio y
// fija el estado inicial: la app nunca puede aprobar un comercio.
export const ensureProfile = async () => {
  if (!isInsforgeConfigured) {
    return { ok: false, data: null, error: null, skipped: true };
  }

  try {
    const { data, error } = await insforge.database.rpc('app_ensure_profile');
    if (error) return { ok: false, data: null, error: describeError(error), skipped: false };
    return { ok: true, data: data || null, error: null, skipped: false };
  } catch (error) {
    return { ok: false, data: null, error: describeError(error), skipped: false };
  }
};

// -----------------------------------------------------------------------------
// Fotos de perfil
// -----------------------------------------------------------------------------
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Valida el archivo antes de subirlo. Devuelve null si es válido.
export const validateProfilePhoto = (file) => {
  if (!file) return 'Selecciona una imagen para tu perfil.';
  if (!String(file.type || '').startsWith('image/')) {
    return 'El archivo debe ser una imagen.';
  }
  if (file.type && !PROFILE_PHOTO_TYPES.includes(file.type)) {
    return 'Usa una imagen JPG, PNG, WEBP o GIF.';
  }
  if (Number(file.size) > MAX_PROFILE_PHOTO_BYTES) {
    return 'La imagen no puede superar 5 MB.';
  }
  return null;
};

const profilePhotoExtension = (file) => {
  const name = String(file?.name || '');
  const dot = name.lastIndexOf('.');
  const extension = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
    return extension === 'jpeg' ? 'jpg' : extension;
  }
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }[file?.type] || 'jpg';
};

// Subida al MISMO bucket público de avatares. Tanto la foto de perfil como los
// logos comparten validación, cliente y forma de obtener la URL pública.
const uploadToAvatars = async (path, file, fallbackMessage) => {
  try {
    const bucket = insforge.storage.from(avatarsBucket);
    const { data, error } = await bucket.upload(path, file);
    if (error) {
      return { url: null, key: null, error: describeError(error, fallbackMessage) };
    }

    const publicUrl = data?.url || bucket.getPublicUrl(path)?.data?.publicUrl || null;
    if (!publicUrl) {
      return { url: null, key: null, error: 'La imagen se subió, pero no se obtuvo su URL pública.' };
    }

    return { url: publicUrl, key: data?.key || path, error: null };
  } catch (error) {
    return { url: null, key: null, error: describeError(error, fallbackMessage) };
  }
};

// Sube la foto al bucket público y devuelve su URL. En modo demostración se
// mantiene una URL local para que la vista previa funcione sin backend.
export const uploadProfilePhoto = async ({ userId, role, file }) => {
  const validation = validateProfilePhoto(file);
  if (validation) return { url: null, key: null, error: validation };

  if (!isInsforgeConfigured) {
    return { url: URL.createObjectURL(file), key: null, error: null, demo: true };
  }

  if (!userId) {
    return {
      url: null,
      key: null,
      error: 'No hay una sesión activa para subir la foto de perfil.',
    };
  }

  const folder = role === 'commerce' ? 'commerce' : 'buyer';
  const path = `${folder}/${userId}/avatar-${Date.now()}.${profilePhotoExtension(file)}`;

  return uploadToAvatars(path, file, 'No se pudo subir la foto de perfil.');
};

// Logos de negocios y marcas: mismo bucket, mismas validaciones (JPG/PNG/WEBP/
// GIF, máx. 5 MB) y mismo contrato de retorno que la foto de perfil.
export const uploadLogo = async ({ userId, scope, file }) => {
  const validation = validateProfilePhoto(file);
  if (validation) return { url: null, key: null, error: validation };

  if (!isInsforgeConfigured) {
    return { url: URL.createObjectURL(file), key: null, error: null, demo: true };
  }

  if (!userId) {
    return { url: null, key: null, error: 'No hay una sesión activa para subir el logo.' };
  }

  const safeScope = ['workshop', 'commerce', 'sponsor'].includes(scope) ? scope : 'business';
  const path = `logos/${safeScope}/${userId}/logo-${Date.now()}.${profilePhotoExtension(file)}`;

  return uploadToAvatars(path, file, 'No se pudo subir el logo.');
};

// Fotos de productos del inventario: mismo bucket público y mismas validaciones
// que la foto de perfil y los logos. La ruta `inventory/...` mantiene los
// archivos separados sin crear un storage paralelo ni tocar los existentes.
export const uploadInventoryPhoto = async ({ userId, file }) => {
  const validation = validateProfilePhoto(file);
  if (validation) return { url: null, key: null, error: validation };

  if (!isInsforgeConfigured) {
    return { url: URL.createObjectURL(file), key: null, error: null, demo: true };
  }

  if (!userId) {
    return {
      url: null,
      key: null,
      error: 'No hay una sesión activa para subir la foto del producto.',
    };
  }

  const path = `inventory/${userId}/photo-${Date.now()}.${profilePhotoExtension(file)}`;
  return uploadToAvatars(path, file, 'No se pudo subir la foto del producto.');
};

// Fotos del mini-catálogo «Recomiéndame». Mismo bucket público y mismas
// validaciones; la ruta nueva mantiene los archivos separados y la política de
// Storage exige que la carpeta sea la del usuario autenticado.
export const uploadRecommendationPhoto = async ({ userId, file }) => {
  const validation = validateProfilePhoto(file);
  if (validation) return { url: null, key: null, error: validation };

  if (!isInsforgeConfigured) {
    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : null;
    return { url: previewUrl, key: null, error: null, demo: true };
  }

  if (!userId) {
    return {
      url: null,
      key: null,
      error: 'No hay una sesión activa para subir la foto de la opción.',
    };
  }

  const path = `offers/recommendations/${userId}/option-${Date.now()}.${profilePhotoExtension(file)}`;
  return uploadToAvatars(path, file, 'No se pudo subir la foto de la opción.');
};

// -----------------------------------------------------------------------------
// Solicitudes del comprador
// -----------------------------------------------------------------------------
// Las tablas de negocio referencian buyer_profiles.id, no el id de auth.users.
// Este helper resuelve el perfil real del comprador antes de consultar.
export const fetchBuyerProfileId = async (userId) => {
  if (!isInsforgeConfigured) return emptyResult(NOTICES.demo);
  if (!userId) {
    return emptyResult(NOTICES.requests, 'No hay una sesión activa para consultar estos datos.');
  }

  const result = await runQuery(
    (db) => db.from('buyer_profiles').select('id,display_name').eq('user_id', userId).limit(1),
    NOTICES.requests
  );

  return { ...result, item: result.items[0] || null };
};

export const fetchBuyerRequests = async (userId) => {
  const guard = requireUserId(userId, NOTICES.requests);
  if (guard) return guard;

  const buyer = await fetchBuyerProfileId(userId);
  if (!buyer.item) {
    return emptyResult(buyer.notice || NOTICES.requests, buyer.error);
  }

  const requests = await runQuery(
    (db) =>
      db
        .from('purchase_requests')
        .select('*')
        .eq('buyer_id', buyer.item.id)
        .order('created_at', { ascending: false }),
    NOTICES.requests
  );

  if (requests.items.length === 0) return requests;

  // Conteo real de ofertas por solicitud. Si no se puede leer, el contador
  // queda en null (la interfaz no muestra un número inventado).
  const requestIds = requests.items.map((request) => request.id).filter(Boolean);
  if (requestIds.length === 0) return requests;

  const offers = await runQuery(
    (db) => db.from('purchase_offers').select('request_id').in('request_id', requestIds),
    NOTICES.offers
  );

  if (offers.error) {
    return {
      ...requests,
      items: requests.items.map((request) => ({ ...request, offers_count: null })),
    };
  }

  const counts = offers.items.reduce((acc, offer) => {
    acc[offer.request_id] = (acc[offer.request_id] || 0) + 1;
    return acc;
  }, {});

  return {
    ...requests,
    items: requests.items.map((request) => ({
      ...request,
      offers_count: counts[request.id] || 0,
    })),
  };
};

const toPositiveInteger = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
};

const readItemImages = (item) => {
  const raw = Array.isArray(item?.images) ? item.images : [];
  return raw
    .map((image) => (typeof image === 'string' ? image : image?.url || image?.src || ''))
    .filter(Boolean);
};

// Normaliza un ítem guardado en purchase_requests.items. El formulario del
// comprador usa `item`, `quantity`, `vehicleBrand`… y versiones anteriores
// pudieron guardar esos mismos datos con otras claves o como texto. El panel
// del comercio necesita una forma estable para mostrar todos los campos.
export const mapRequestItem = (item = {}, index = 0) => ({
  key: item.id ?? `item-${index}`,
  category: item.category || '',
  product: item.item || item.name || item.description || 'Producto',
  vehicleType: item.vehicleType || item.vehicle_type || '',
  vehicleBrand: item.vehicleBrand || item.vehicle_brand || '',
  vehicleModel: item.vehicleModel || item.vehicle_model || '',
  yearFrom: item.yearFrom ?? item.year_from ?? '',
  yearTo: item.yearTo ?? item.year_to ?? '',
  reference: item.reference || item.part_number || '',
  // En «Recomiéndame», `brand` identifica el vehículo; no debe mostrarse como
  // marca del repuesto. El panel usa `vehicleBrand` para ese dato.
  brand: item.is_recommendation ? '' : item.brand || '',
  condition: item.condition || '',
  quantity: toPositiveInteger(item.quantity ?? item.cantidad, 1),
  notes: item.notes || '',
  images: readItemImages(item),
});

export const mapRequest = (row) => ({
  id: row.id,
  product: row.title || 'Solicitud sin título',
  description: row.description || '',
  status: row.status || 'open',
  statusLabel: REQUEST_STATUS_LABELS[row.status] || row.status || 'Sin estado',
  budget: formatCurrency(row.budget_amount, row.currency),
  time: formatRelativeDate(row.created_at),
  offers: Number.isFinite(Number(row.offers_count)) && row.offers_count !== null
    ? Number(row.offers_count)
    : null,
  isRecommendation: Boolean(row.is_recommendation),
  preferences: String(row.preferences ?? '').trim(),
  items: Array.isArray(row.items) ? row.items.map(mapRequestItem) : [],
});

// -----------------------------------------------------------------------------
// Opciones de marca de una oferta
// -----------------------------------------------------------------------------
// Las ofertas nuevas guardan un arreglo `brand_options`. Las antiguas solo
// tenían `total_amount`: se presentan como una única opción por defecto para
// que la interfaz no cambie de forma (y la selección siga funcionando).
export const DEFAULT_OFFER_BRAND = 'Opción estándar';
const LEGACY_OPTION_ID = 'legacy-default';

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeSingleBrandOption = (option, index = 0) => {
  const photo = String(option?.photo ?? option?.photo_url ?? '').trim();
  return {
    id: String(option?.id ?? `option-${index + 1}`),
    brand: String(option?.brand ?? '').trim(),
    price: finiteNumber(option?.price),
    available: option?.available !== false,
    isRecommended: Boolean(option?.is_recommended ?? option?.isRecommended),
    note: String(option?.note ?? '').trim(),
    // La foto es aditiva: solo aparece cuando la oferta la trae para no
    // cambiar la forma de las opciones antiguas ni sus acuerdos de chat.
    ...(photo ? { photo } : {}),
  };
};

// Las alternativas de una tarjeta de producto viajan en `item.brand_options`
// y su precio es por unidad (el precio base sigue siendo `unitPrice`).
export const normalizeItemBrandOptions = (item) => {
  const rawOptions = Array.isArray(item?.brand_options) ? item.brand_options : [];
  return rawOptions
    .map((option, index) => normalizeSingleBrandOption(option, index))
    .filter((option) => option.brand && option.price !== null && option.price > 0);
};

// Acepta tanto el mapa guardado en `selected_item_options` como el arreglo que
// viaja en el hilo de chat (`selected_offer_items`).
export const normalizeSelectedItemOptions = (value) => {
  const entries = Array.isArray(value)
    ? value.map((entry) => [String(entry?.item_key ?? entry?.key ?? ''), entry?.option ?? entry])
    : value && typeof value === 'object'
      ? Object.entries(value)
      : [];

  return entries.reduce((result, [key, option]) => {
    if (!key || !option || typeof option !== 'object') return result;
    const normalized = normalizeSingleBrandOption(option);
    if (!normalized.brand || normalized.price === null) return result;
    result[key] = normalized;
    return result;
  }, {});
};

const brandOptionMatches = (option, stored) => {
  const id = stored?.id != null ? String(stored.id) : null;
  const storedPrice = finiteNumber(stored?.price);
  return Boolean(
    (id && option.id === id) ||
      (option.brand === String(stored?.brand || '').trim() &&
        storedPrice !== null &&
        option.price === storedPrice)
  );
};

export const normalizeBrandOptions = (row) => {
  const rawOptions = Array.isArray(row?.brand_options) ? row.brand_options : [];
  const options = rawOptions
    .map((option, index) => normalizeSingleBrandOption(option, index))
    .filter((option) => option.brand && option.price !== null);

  if (options.length > 0) return options;

  const amount = finiteNumber(row?.total_amount);
  if (amount === null || amount <= 0) return [];

  return [
    {
      id: LEGACY_OPTION_ID,
      brand: DEFAULT_OFFER_BRAND,
      price: amount,
      available: true,
      isRecommended: true,
      note: '',
    },
  ];
};

// Instantánea que se guarda en el hilo de chat como acuerdo inicial.
export const offerOptionAgreement = (option) =>
  option
    ? {
        id: option.id,
        brand: option.brand,
        price: option.price,
        available: option.available !== false,
        is_recommended: Boolean(option.isRecommended),
        note: option.note || '',
      }
    : null;

// Cada elección por producto se guarda como acuerdo inicial del chat con el
// contexto del ítem (nombre y cantidad) para que ambas partes vean la misma
// desglose de marcas.
export const offerItemAgreement = (entries = []) => {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => {
      const option = offerOptionAgreement(entry?.option ?? entry);
      if (!option) return null;

      return {
        item_key: String(entry?.item_key ?? entry?.key ?? ''),
        item_name: String(entry?.item_name ?? entry?.name ?? ''),
        quantity: finiteNumber(entry?.quantity) ?? 1,
        ...option,
      };
    })
    .filter(Boolean);
};

export const getSelectedOfferOption = (row, currency = row?.currency) => {
  const stored =
    row?.selected_option && typeof row.selected_option === 'object' ? row.selected_option : null;
  if (!stored) return null;

  const options = normalizeBrandOptions(row);
  const match = options.find((option) => brandOptionMatches(option, stored));

  if (!match) return null;
  return { ...match, selectedAt: row?.selected_at || null, currency: currency || 'MXN' };
};

// -----------------------------------------------------------------------------
// Ofertas recibidas por el comprador
// -----------------------------------------------------------------------------
export const fetchBuyerOffers = async (userId) => {
  const guard = requireUserId(userId, NOTICES.offers);
  if (guard) return guard;

  const requests = await fetchBuyerRequests(userId);
  if (requests.items.length === 0) {
    return emptyResult(requests.notice || NOTICES.offers, requests.error);
  }

  const requestIds = requests.items.map((request) => request.id).filter(Boolean);
  if (requestIds.length === 0) return emptyResult(NOTICES.offers);

  const offers = await runQuery(
    (db) =>
      db
        .from('purchase_offers')
        .select('*')
        .in('request_id', requestIds)
        .order('created_at', { ascending: false }),
    NOTICES.offers
  );

  if (offers.items.length === 0) return offers;

  // Las propuestas de Taller Verificado son ofertas sin comercio: su nombre
  // vive en workshop_profiles (RLS permite leer los perfiles verificados).
  const workshopIds = [...new Set(offers.items.map((offer) => offer.workshop_id).filter(Boolean))];
  const workshopById = {};
  if (workshopIds.length > 0) {
    const workshops = await runQuery(
      (db) =>
        db
          .from('workshop_profiles')
          .select('id,workshop_name,is_verified,logo_url')
          .in('id', workshopIds),
      NOTICES.offers
    );
    workshops.items.forEach((workshop) => {
      workshopById[workshop.id] = workshop;
    });
  }

  // Los nombres comerciales, la ubicación y la confiabilidad viven en
  // commerce_profiles / commerce_reviews. Si una consulta no está permitida,
  // se usa un valor neutro (nunca inventado).
  const commerceIds = [...new Set(offers.items.map((offer) => offer.commerce_id).filter(Boolean))];
  const commerceById = {};

  if (commerceIds.length > 0) {
    const profiles = await runQuery(
      (db) =>
        db
          .from('commerce_profiles')
          .select('id,trade_name,latitude,longitude,avatar_url,logo_url')
          .in('id', commerceIds),
      NOTICES.offers
    );

    profiles.items.forEach((profile) => {
      commerceById[profile.id] = profile;
    });

    // Confiabilidad: promedio de reseñas publicadas. La política RLS permite
    // leer las reseñas publicadas de cualquier comercio.
    const reviews = await runQuery(
      (db) =>
        db
          .from('commerce_reviews')
          .select('commerce_id,rating')
          .in('commerce_id', commerceIds)
          .eq('status', 'published'),
      NOTICES.reviews
    );

    const ratingTotals = reviews.items.reduce((acc, review) => {
      const commerceId = review.commerce_id;
      const rating = Number(review.rating);
      if (!commerceId || !Number.isFinite(rating)) return acc;

      const current = acc[commerceId] || { sum: 0, count: 0 };
      acc[commerceId] = { sum: current.sum + rating, count: current.count + 1 };
      return acc;
    }, {});

    Object.entries(ratingTotals).forEach(([commerceId, totals]) => {
      if (!commerceById[commerceId]) return;
      commerceById[commerceId] = {
        ...commerceById[commerceId],
        rating: totals.sum / totals.count,
        rating_count: totals.count,
      };
    });
  }

  return {
    items: offers.items.map((offer) => {
      const commerce = commerceById[offer.commerce_id] || {};
      const workshop = workshopById[offer.workshop_id] || null;
      return {
        ...offer,
        commerce_name: commerce.trade_name || workshop?.workshop_name || '',
        commerce_avatar_url: commerce.avatar_url || null,
        commerce_logo_url: commerce.logo_url || null,
        workshop_logo_url: workshop?.logo_url || null,
        commerce_latitude: commerce.latitude ?? null,
        commerce_longitude: commerce.longitude ?? null,
        commerce_rating: commerce.rating ?? null,
        commerce_rating_count: commerce.rating_count ?? 0,
        workshop_name: workshop?.workshop_name || null,
      };
    }),
    error: offers.error,
    notice: offers.notice,
  };
};

// Insignia B2B para el vendedor: solo talleres verificados, sin datos fiscales.
export const fetchWorkshopBadges = (buyerIds = []) => {
  if (!isInsforgeConfigured) {
    return Promise.resolve(emptyResult(NOTICES.demo));
  }

  const ids = [...new Set((Array.isArray(buyerIds) ? buyerIds : []).filter(Boolean))];
  if (ids.length === 0) {
    return Promise.resolve(emptyResult(null));
  }

  return runQuery(
    (db) => db.rpc('app_workshop_b2b_badges', { p_buyer_ids: ids }),
    NOTICES.offers
  );
};

export const mapOffer = (row, buyerLocation = null) => {
  const items = Array.isArray(row.items) ? row.items : [];
  const isAvailable = (item) => item?.available !== false;
  const availableItems = items.filter((item) => item && isAvailable(item));

  const amount = Number(row.total_amount);
  const rating = Number(row.commerce_rating);
  const ratingCount = Number(row.commerce_rating_count);
  const distanceKm = calculateDistanceKm(
    buyerLocation?.latitude,
    buyerLocation?.longitude,
    row.commerce_latitude,
    row.commerce_longitude
  );

  const hasItemOptions = items.some(
    (item) => Array.isArray(item?.brand_options) && item.brand_options.length > 0
  );
  const storedItemSelections = normalizeSelectedItemOptions(row.selected_item_options);

  // Mini-catálogo «Recomiéndame». Se expone tal cual y también como opciones de
  // marca para reutilizar la selección y el acuerdo de chat ya existentes.
  const recommendedOptions = normalizeRecommendedOptions(row.recommended_options);
  const isRecommendationOffer = recommendedOptions.length > 0;

  // El selector global queda solo para ofertas antiguas que no traen
  // alternativas por producto. Las nuevas usan un selector dentro de cada ítem.
  const brandOptions = isRecommendationOffer
    ? recommendedOptions.map((option) => ({
        ...option,
        priceLabel: formatCurrency(option.price, row.currency),
      }))
    : hasItemOptions
      ? []
      : normalizeBrandOptions(row).map((option) => ({
          ...option,
          priceLabel: formatCurrency(option.price, row.currency),
        }));
  const chosen = hasItemOptions ? null : getSelectedOfferOption(row, row.currency);
  const selectedOption = chosen
    ? { ...chosen, priceLabel: formatCurrency(chosen.price, row.currency) }
    : null;

  const mappedItems = items.map((item, index) => {
    const available = isAvailable(item);
    const quantity = toPositiveInteger(item?.quantity ?? item?.cantidad, 1);
    const unitPrice = Number(item?.unitPrice ?? item?.unit_price);
    const totalPrice = Number(item?.totalPrice ?? item?.total_price);
    const itemKey = String(item?.key ?? item?.id ?? `item-${index + 1}`);

    const itemBrandOptions = normalizeItemBrandOptions(item).map((option) => ({
      ...option,
      amount: Number((option.price * quantity).toFixed(2)),
      priceLabel: formatCurrency(option.price, row.currency),
      amountLabel: formatCurrency(option.price * quantity, row.currency),
    }));
    const stored = storedItemSelections[itemKey];
    const matched = stored
      ? itemBrandOptions.find((option) => brandOptionMatches(option, stored)) || null
      : null;
    const selectedBrandOption = matched
      ? {
          ...matched,
          selectedAt: storedItemSelections[itemKey]?.selected_at || null,
        }
      : null;

    return {
      key: itemKey,
      name: item?.name || item?.title || item?.description || 'Producto',
      quantity,
      status: available ? 'available' : 'missing',
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      totalPrice: available && Number.isFinite(totalPrice) ? totalPrice : 0,
      priceLabel:
        available && Number.isFinite(totalPrice) && totalPrice > 0
          ? formatCurrency(totalPrice, row.currency)
          : '',
      notes: item?.notes || '',
      // Imagen del producto enviada por la tienda. Es opcional y no altera
      // las ofertas antiguas que solo traen logo/avatar del negocio.
      photo:
        item?.photo ||
        item?.photo_url ||
        readItemImages(item)[0] ||
        null,
      bonus: String(item?.bonus || '').trim(),
      brandOptions: itemBrandOptions,
      selectedOption: selectedBrandOption,
    };
  });

  const selectedItemOptions = mappedItems.reduce((result, item) => {
    if (item.selectedOption) result[item.key] = item.selectedOption;
    return result;
  }, {});

  return {
    id: row.id,
    requestId: row.request_id,
    commerceId: row.commerce_id || null,
    workshopId: row.workshop_id || null,
    workshopName: row.workshop_name || null,
    isWorkshopProposal: Boolean(row.workshop_id),
    laborAmount: row.labor_amount ?? null,
    estimatedDays: row.estimated_days ?? null,
    store: row.commerce_name || 'Comercio',
    avatar: row.commerce_avatar_url || null,
    logo: row.workshop_logo_url || row.commerce_logo_url || null,
    price: formatCurrency(row.total_amount, row.currency),
    amount: Number.isFinite(amount) ? amount : null,
    currency: row.currency || 'MXN',
    deliveryDays: row.delivery_days ?? null,
    // Distancia real solo cuando ambas partes tienen coordenadas guardadas.
    distanceKm,
    distanceLabel: formatDistance(distanceKm),
    // Confiabilidad = promedio de reseñas publicadas del comercio.
    rating: Number.isFinite(rating) ? rating : null,
    ratingCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    conditions: row.conditions || '',
    status: row.status,
    // Bono/descuento o servicio incluido a nivel de oferta (aditivo).
    bonus: String(row.bonus || '').trim(),
    // Primera imagen de producto disponible para la tarjeta de la oferta.
    photo:
      row.photo_url ||
      row.photo ||
      recommendedOptions.find((option) => option.image_url)?.image_url ||
      mappedItems.find((item) => item.photo)?.photo ||
      null,
    // Opciones del carrusel «Recomiéndame» (vacío en ofertas tradicionales).
    isRecommendationOffer,
    recommendedOptions: isRecommendationOffer
      ? recommendedOptions.map((option) => ({
          ...option,
          priceLabel: formatCurrency(option.price, row.currency),
        }))
      : [],
    brandOptions,
    brandOptionsByItem: hasItemOptions && !isRecommendationOffer,
    selectedOption,
    selectedItemOptions,
    selectedAt: row.selected_at || null,
    found: availableItems.length,
    total: items.length,
    // Solo las unidades que el comercio sí cotizó.
    quantityTotal: availableItems.reduce(
      (total, item) => total + toPositiveInteger(item.quantity ?? item.cantidad, 1),
      0
    ),
    items: mappedItems,
  };
};

// Importe que debe mostrar el comprador: usa las marcas elegidas por producto
// cuando existen y respeta la selección global de las ofertas anteriores.
export const getOfferEffectiveAmount = (offer) => {
  const items = Array.isArray(offer?.items) ? offer.items : [];
  const hasItemOptions = items.some(
    (item) => Array.isArray(item?.brandOptions) && item.brandOptions.length > 0
  );

  if (!hasItemOptions) {
    if (offer?.selectedOption && Number(offer.selectedOption.price) > 0) {
      return Number(offer.selectedOption.price);
    }
    return finiteNumber(offer?.amount) ?? 0;
  }

  return items.reduce((total, item) => {
    if (item?.status === 'missing') return total;
    const quantity = Math.max(1, Number(item?.quantity) || 1);
    if (item?.selectedOption && Number.isFinite(item.selectedOption.price)) {
      return total + item.selectedOption.price * quantity;
    }
    return total + (finiteNumber(item?.totalPrice) ?? 0);
  }, 0);
};

// Guarda la marca elegida por el comprador. La política RLS de purchase_offers
// solo deja escribir al comercio, así que se usa el RPC que valida al comprador
// titular de la solicitud.
export const selectOfferOption = async ({ offerId, optionId }) => {
  if (!isInsforgeConfigured) {
    return {
      ok: false,
      data: null,
      skipped: true,
      error: `No se guardó nada: ${NOTICES.demo}`,
    };
  }
  if (!offerId || !optionId) {
    return { ok: false, data: null, error: 'No se indicó la opción elegida.' };
  }

  try {
    const { data, error } = await insforge.database.rpc('app_select_offer_option', {
      p_offer_id: offerId,
      p_option_id: String(optionId),
    });
    if (error) {
      return {
        ok: false,
        data: null,
        error: describeError(error, 'No se pudo guardar la marca elegida.'),
      };
    }
    return { ok: true, data: data ?? null, error: null };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: describeError(error, 'No se pudo guardar la marca elegida.'),
    };
  }
};

// Guarda todas las marcas elegidas por producto en una sola llamada. `selections`
// es un mapa { item_key: option_id }; el RPC valida pertenencia y disponibilidad.
export const selectOfferItemBrands = async ({ offerId, selections = {} }) => {
  if (!isInsforgeConfigured) {
    return {
      ok: false,
      data: null,
      skipped: true,
      error: `No se guardó nada: ${NOTICES.demo}`,
    };
  }
  if (!offerId || !selections || typeof selections !== 'object') {
    return { ok: false, data: null, error: 'No se indicaron las marcas elegidas.' };
  }

  const payload = Object.entries(selections).reduce((result, [key, value]) => {
    const optionId = typeof value === 'object' ? value?.id : value;
    if (key && optionId) result[String(key)] = String(optionId);
    return result;
  }, {});

  if (Object.keys(payload).length === 0) {
    return { ok: false, data: null, error: 'No se indicaron las marcas elegidas.' };
  }

  try {
    const { data, error } = await insforge.database.rpc('app_select_offer_item_brands', {
      p_offer_id: offerId,
      p_selections: payload,
    });
    if (error) {
      return {
        ok: false,
        data: null,
        error: describeError(error, 'No se pudieron guardar las marcas elegidas.'),
      };
    }
    return { ok: true, data: data ?? null, error: null };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: describeError(error, 'No se pudieron guardar las marcas elegidas.'),
    };
  }
};

// -----------------------------------------------------------------------------
// Pedidos
// -----------------------------------------------------------------------------
const fetchOrdersBy = (column, id, notice) =>
  runQuery(
    (db) =>
      db
        .from('purchase_orders')
        .select('*')
        .eq(column, id)
        .order('created_at', { ascending: false }),
    notice
  );

export const fetchBuyerOrders = async (userId) => {
  const guard = requireUserId(userId, NOTICES.orders);
  if (guard) return guard;

  const buyer = await fetchBuyerProfileId(userId);
  if (!buyer.item) {
    return emptyResult(buyer.notice || NOTICES.orders, buyer.error);
  }

  return fetchOrdersBy('buyer_id', buyer.item.id, NOTICES.orders);
};

const ACTIVE_ORDER_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'shipped']);
const COMPLETED_ORDER_STATUSES = new Set(['delivered', 'completed']);

export const mapOrder = (row) => {
  const snapshot = row.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {};
  const items = Array.isArray(row.items) ? row.items : [];
  const firstItem = items[0] || {};

  return {
    id: row.id,
    number: row.order_number || `#${String(row.id).slice(0, 8)}`,
    product: snapshot.product || firstItem.name || 'Pedido',
    store: snapshot.store || snapshot.tradeName || 'Comercio',
    price: formatCurrency(row.total_amount, row.currency),
    status: row.status,
    statusLabel: ORDER_STATUS_LABELS[row.status] || row.status || 'Sin estado',
    statusDetail: formatRelativeDate(row.completed_at || row.delivered_at || row.confirmed_at || row.placed_at),
    address: snapshot.address || '',
    image: snapshot.image || null,
    tracking: snapshot.tracking || '',
    completedAt: row.completed_at || row.delivered_at || null,
    active: ACTIVE_ORDER_STATUSES.has(row.status),
  };
};

export const splitOrders = (orders) => ({
  active: orders.filter((order) => order.active),
  completed: orders.filter((order) => COMPLETED_ORDER_STATUSES.has(order.status)),
});

// -----------------------------------------------------------------------------
// Pedido creado desde el chat
// -----------------------------------------------------------------------------
const generateOrderNumber = () => {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${date}-${random}`;
};

const formatShippingAddress = (data = {}) =>
  [
    String(data.street || '').trim(),
    String(data.interior || '').trim() ? `Int. ${String(data.interior).trim()}` : '',
    String(data.neighborhood || '').trim(),
    String(data.city || '').trim(),
  ]
    .filter(Boolean)
    .join(', ');

const normalizeShipping = (data = {}) => ({
  name: String(data.name || '').trim(),
  phone: String(data.phone || '').trim(),
  street: String(data.street || '').trim(),
  interior: String(data.interior || '').trim(),
  neighborhood: String(data.neighborhood || '').trim(),
  city: String(data.city || '').trim(),
  references: String(data.references || '').trim(),
});

// Registra el pedido real cuando el comprador confirma la compra. Usa la oferta
// guardada en el hilo (productos, importe y moneda reales) y guarda una copia
// del envío en el snapshot. Es idempotente por conversación: si el hilo ya
// tiene pedido, devuelve ese mismo y no crea otro.
export const createOrderForChat = async ({ chatId, shipping }) => {
  if (!isInsforgeConfigured) {
    return { ok: false, skipped: true, orderId: null, commerceId: null, error: null };
  }
  if (!chatId) {
    return {
      ok: false,
      orderId: null,
      commerceId: null,
      error: 'No se indicó una conversación.',
    };
  }

  const threadResult = await fetchChatThread(chatId);
  const thread = threadResult.item;
  if (threadResult.error || !thread) {
    return {
      ok: false,
      orderId: null,
      commerceId: null,
      error: threadResult.error || 'No se encontró la conversación de la compra.',
    };
  }

  if (thread.order_id) {
    const existingOrder = await fetchOrderById(thread.order_id);
    const isNewOffer = Boolean(
      thread.offer_id &&
        existingOrder.item &&
        existingOrder.item.offer_id &&
        existingOrder.item.offer_id !== thread.offer_id
    );

    // La misma compra: no se duplica el pedido. Si la conversación se abrió
    // desde otra oferta, se registra una compra nueva y se re-vincula el hilo.
    if (!isNewOffer) {
      return { ok: true, existing: true, orderId: thread.order_id, commerceId: thread.commerce_id };
    }
  }

  // Sin oferta no hay productos ni importe reales que registrar. Antes de
  // rendirse, recupera la oferta real más reciente del comprador con este
  // comercio (por ejemplo, un hilo creado antes de guardar offer_id).
  let offerId = thread.offer_id;

  if (!offerId) {
    const requestsResult = await runQuery(
      (db) => db.from('purchase_requests').select('id').eq('buyer_id', thread.buyer_id),
      NOTICES.orders
    );
    const requestIds = requestsResult.items.map((request) => request.id).filter(Boolean);

    if (requestIds.length > 0) {
      const latestOffer = await runQuery(
        (db) =>
          db
            .from('purchase_offers')
            .select('*')
            .eq('commerce_id', thread.commerce_id)
            .eq('status', 'active')
            .in('request_id', requestIds)
            .order('created_at', { ascending: false })
            .limit(1),
        NOTICES.orders
      );
      offerId = latestOffer.items[0]?.id || null;
    }
  }

  if (!offerId) {
    return { ok: true, skipped: true, orderId: null, commerceId: thread.commerce_id };
  }

  const offerResult = await runQuery(
    (db) => db.from('purchase_offers').select('*').eq('id', offerId).limit(1),
    NOTICES.orders
  );
  const offer = offerResult.items[0];
  if (!offer) {
    return {
      ok: false,
      orderId: null,
      commerceId: thread.commerce_id,
      error: offerResult.error || 'No se encontró la oferta de esta compra.',
    };
  }

  const commerceId = offer.commerce_id || thread.commerce_id;
  const commerceResult = await runQuery(
    (db) => db.from('commerce_profiles').select('id,trade_name').eq('id', commerceId).limit(1),
    NOTICES.orders
  );

  // Preferimos las elecciones por producto. Las ofertas anteriores siguen
  // resolviéndose con la opción global guardada en la oferta o en el hilo.
  const itemSelections = {
    ...normalizeSelectedItemOptions(offer.selected_item_options),
    ...normalizeSelectedItemOptions(thread.selected_offer_items),
  };
  const selectedOption =
    getSelectedOfferOption(offer) ||
    (thread.selected_offer_option
      ? getSelectedOfferOption({ ...offer, selected_option: thread.selected_offer_option })
      : null);
  const offerAmount = finiteNumber(offer.total_amount);

  const items = Array.isArray(offer.items) ? offer.items : [];
  const selectedItemOptions = [];
  const orderItems = items.map((item, index) => {
    const itemKey = String(item?.key ?? item?.id ?? `item-${index + 1}`);
    const stored = itemSelections[itemKey];
    const match = stored
      ? normalizeItemBrandOptions(item).find((option) => brandOptionMatches(option, stored))
      : null;
    if (!match) {
      // Las ofertas sin alternativas por producto conservan la marca global.
      return Object.keys(itemSelections).length === 0 && selectedOption
        ? { ...item, brand: selectedOption.brand }
        : { ...item };
    }

    const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1);
    const totalPrice = Number((match.price * quantity).toFixed(2));
    selectedItemOptions.push({
      item_key: itemKey,
      item_name: item?.name || item?.title || item?.description || '',
      quantity,
      ...offerOptionAgreement(match),
      total_price: totalPrice,
    });

    return {
      ...item,
      brand: match.brand,
      unitPrice: match.price,
      totalPrice,
      brand_note: match.note || null,
    };
  });

  const hasItemAgreement = selectedItemOptions.length > 0;
  const effectiveTotal = hasItemAgreement
    ? orderItems.reduce((total, item) => total + (finiteNumber(item.totalPrice) ?? 0), 0)
    : selectedOption?.price > 0
      ? selectedOption.price
      : (offerAmount ?? 0);
  const agreedBrand = hasItemAgreement
    ? selectedItemOptions
        .map((entry) => `${entry.item_name || entry.item_key}: ${entry.brand}`)
        .join(' · ')
    : selectedOption?.brand || '';
  const firstAvailable = items.find((item) => item && item.available !== false) || items[0] || {};

  let product =
    firstAvailable.name || firstAvailable.title || firstAvailable.description || '';

  // Si la oferta no trae ítems detallados, el título real de la solicitud es el
  // mejor nombre disponible para el pedido (nunca se inventa uno).
  if (!product && offer.request_id) {
    const requestResult = await runQuery(
      (db) => db.from('purchase_requests').select('title').eq('id', offer.request_id).limit(1),
      NOTICES.orders
    );
    product = requestResult.items[0]?.title || '';
  }

  const normalizedShipping = normalizeShipping(shipping);

  const snapshot = {
    product: product || 'Pedido',
    store: commerceResult.items[0]?.trade_name || '',
    address: formatShippingAddress(normalizedShipping),
    shipping: normalizedShipping,
    placedAt: new Date().toISOString(),
    // Acuerdo inicial fijado en el chat: marcas elegidas por producto y, para
    // ofertas antiguas, la opción global.
    brand: agreedBrand,
    selectedItemOptions,
    selectedOption: selectedOption
      ? {
          id: selectedOption.id,
          brand: selectedOption.brand,
          price: selectedOption.price,
          note: selectedOption.note || '',
        }
      : null,
  };

  let lastError = 'No se pudo registrar el pedido.';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const orderNumber = generateOrderNumber();
    const created = await runWrite(
      (db) =>
        db.from('purchase_orders').insert([
          {
            order_number: orderNumber,
            request_id: offer.request_id || null,
            offer_id: offer.id,
            buyer_id: thread.buyer_id,
            commerce_id: commerceId,
            status: 'pending',
            total_amount: Number(effectiveTotal.toFixed(2)),
            currency: offer.currency || 'MXN',
            snapshot,
            items: orderItems,
          },
        ]),
      'No se pudo registrar el pedido.'
    );

    if (created.ok) {
      let order = created.data[0] || null;

      // El backend puede no devolver la fila insertada: se recupera por número.
      if (!order) {
        const found = await runQuery(
          (db) =>
            db.from('purchase_orders').select('*').eq('order_number', orderNumber).limit(1),
          NOTICES.orders
        );
        order = found.items[0] || null;
      }

      if (!order) {
        return {
          ok: false,
          orderId: null,
          commerceId,
          error: 'El pedido se creó, pero no se pudo recuperar. Revisa «Mis pedidos».',
        };
      }

      // Vincula el pedido y la oferta a la conversación para que ambas partes
      // consulten la misma compra.
      const linked = await runWrite(
        (db) =>
          db
            .from('chat_threads')
            .update({ order_id: order.id, offer_id: offerId })
            .eq('id', chatId),
        'No se pudo vincular el pedido a la conversación.'
      );

      return {
        ok: true,
        orderId: order.id,
        orderNumber: order.order_number || orderNumber,
        commerceId,
        linkError: linked.ok ? null : linked.error,
      };
    }

    lastError = created.error || lastError;

    // Solo reintenta si el número de pedido chocó con otro existente.
    if (!/duplicate|unique|already exists/i.test(String(created.error || ''))) break;
  }

  return { ok: false, orderId: null, commerceId, error: lastError };
};

// Actualiza el estado del pedido vinculado a una conversación. Se usa cuando el
// comercio confirma/envía y cuando el comprador confirma la recepción.
export const updateOrderStatusForChat = async ({ chatId, status, patch = {} }) => {
  if (!isInsforgeConfigured) {
    return { ok: false, skipped: true, orderId: null, error: null };
  }

  const threadResult = await fetchChatThread(chatId);
  const thread = threadResult.item;
  if (threadResult.error || !thread) {
    return {
      ok: false,
      orderId: null,
      error: threadResult.error || 'No se encontró la conversación de la compra.',
    };
  }

  if (!thread.order_id) {
    return { ok: true, skipped: true, orderId: null, error: null };
  }

  const updated = await runWrite(
    (db) => db.from('purchase_orders').update({ status, ...patch }).eq('id', thread.order_id),
    'No se pudo actualizar el pedido.'
  );

  return {
    ok: updated.ok,
    orderId: thread.order_id,
    error: updated.error,
  };
};

// -----------------------------------------------------------------------------
// Chats
// -----------------------------------------------------------------------------
export const fetchCommerceIdForUser = async (userId) => {
  if (!isInsforgeConfigured) return emptyResult(NOTICES.demo);
  if (!userId) return emptyResult(NOTICES.chats, 'No hay una sesión activa para consultar estos datos.');

  const result = await runQuery(
    (db) => db.from('commerce_profiles').select('id,trade_name,status,vehicle_types,inventory_systems').eq('owner_user_id', userId).limit(1),
    NOTICES.chats
  );

  return { ...result, item: result.items[0] || null };
};

export const fetchChatThreads = async ({ userId, role }) => {
  if (!userId) {
    return emptyResult(NOTICES.chats, 'No hay una sesión activa para consultar estos datos.');
  }

  if (role === 'commerce') {
    const commerce = await fetchCommerceIdForUser(userId);
    if (!commerce.item) return emptyResult(commerce.notice || NOTICES.chats, commerce.error);
    return fetchChatThreadsBy('commerce_id', commerce.item.id, role);
  }

  const buyer = await fetchBuyerProfileId(userId);
  if (!buyer.item) {
    return emptyResult(buyer.notice || NOTICES.chats, buyer.error);
  }

  return fetchChatThreadsBy('buyer_id', buyer.item.id, role);
};

// Agrega el nombre y la foto de la contraparte a cada conversación. El
// comprador puede leer el perfil público de los comercios aprobados; el
// comercio usa una RPC que solo devuelve id, nombre y avatar de compradores
// con los que tiene relación.
const attachChatCounterparts = async (threads, role) => {
  const isCommerce = role === 'commerce';
  const ids = [
    ...new Set(
      threads
        .map((thread) => (isCommerce ? thread.buyer_id : thread.commerce_id))
        .filter(Boolean)
    ),
  ];

  if (ids.length === 0) return threads;

  const result = isCommerce
    ? await runQuery((db) => db.rpc('app_buyer_avatars', { p_ids: ids }), NOTICES.chats)
    : await runQuery(
        (db) =>
          db
            .from('commerce_profiles')
            .select('id,trade_name,avatar_url')
            .in('id', ids),
        NOTICES.chats
      );

  if (result.error) return threads;

  const profileById = result.items.reduce((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {});

  return threads.map((thread) => {
    const profile = profileById[isCommerce ? thread.buyer_id : thread.commerce_id] || {};
    return {
      ...thread,
      counterpart_name: (isCommerce ? profile.display_name : profile.trade_name) || '',
      counterpart_avatar_url: profile.avatar_url || null,
    };
  });
};

const fetchChatThreadsBy = async (column, id, role) => {
  const result = await runQuery(
    (db) =>
      db
        .from('chat_threads')
        .select('*')
        .eq(column, id)
        .order('last_message_at', { ascending: false }),
    NOTICES.chats
  );

  if (result.error || result.items.length === 0) return result;
  return { ...result, items: await attachChatCounterparts(result.items, role) };
};

export const mapChatThread = (row) => ({
  id: row.id,
  subject: row.subject || 'Conversación',
  counterpartName: row.counterpart_name || '',
  avatar: row.counterpart_avatar_url || null,
  status: row.status || 'active',
  lastMessageAt: row.last_message_at || row.created_at,
  time: formatRelativeDate(row.last_message_at || row.created_at),
  unread: Number(row.unread_count) || 0,
});

export const fetchChatThread = async (chatId) => {
  if (!chatId) return emptyResult(NOTICES.chats, 'No se indicó una conversación.');

  const result = await runQuery(
    (db) => db.from('chat_threads').select('*').eq('id', chatId).limit(1),
    NOTICES.chats
  );

  return { ...result, item: result.items[0] || null };
};

// Resuelve la contraparte de una conversación para pintar su foto y nombre en
// la cabecera del chat.
export const fetchChatCounterpart = async (thread, role) => {
  const empty = { id: null, name: '', avatarUrl: null };
  if (!thread) return empty;

  if (role === 'commerce') {
    if (!thread.buyer_id) return empty;
    const result = await runQuery(
      (db) => db.rpc('app_buyer_avatars', { p_ids: [thread.buyer_id] }),
      NOTICES.chats
    );
    const profile = result.items[0] || {};
    return {
      id: profile.id || thread.buyer_id,
      name: profile.display_name || '',
      avatarUrl: profile.avatar_url || null,
    };
  }

  if (!thread.commerce_id) return empty;
  const result = await runQuery(
    (db) =>
      db
        .from('commerce_profiles')
        .select('id,trade_name,avatar_url')
        .eq('id', thread.commerce_id)
        .limit(1),
    NOTICES.chats
  );
  const profile = result.items[0] || {};
  return {
    id: profile.id || thread.commerce_id,
    name: profile.trade_name || '',
    avatarUrl: profile.avatar_url || null,
  };
};

export const fetchOrderById = async (orderId) => {
  if (!orderId) return emptyResult(NOTICES.orders, 'No se indicó un pedido.');

  const result = await runQuery(
    (db) => db.from('purchase_orders').select('*').eq('id', orderId).limit(1),
    NOTICES.orders
  );

  return { ...result, item: result.items[0] || null };
};

export const fetchChatMessages = async (chatId) => {
  if (!chatId) return emptyResult(NOTICES.chats, 'No se indicó una conversación.');

  return runQuery(
    (db) =>
      db
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true }),
    NOTICES.chats
  );
};

// Convierte una fila de chat_messages al formato de burbuja que usan las
// pantallas: «buyer» a la derecha del comprador, «seller» a la derecha del
// comercio y «system» centrado.
export const mapChatMessage = (row) => {
  const senderType = row?.sender_type;
  const sender =
    senderType === 'commerce' ? 'seller' : senderType === 'buyer' ? 'buyer' : 'system';

  return {
    id: row?.id,
    text: row?.body || '',
    sender,
    senderType: senderType || 'system',
    senderName: row?.sender_name || '',
    createdAt: row?.created_at || null,
    time: formatClockTime(row?.created_at),
  };
};

// Reutiliza la conversación entre un comprador y un comercio; si no existe la
// crea. El backend aplica RLS: solo el comprador o el comercio dueños pueden
// leerla y escribir en ella.
export const ensureChatThread = async ({
  buyerId,
  commerceId,
  subject,
  orderId = null,
  offerId = null,
  selectedOption = null,
  selectedItemOptions = [],
}) => {
  if (!isInsforgeConfigured) {
    return { item: null, error: null, notice: NOTICES.demo };
  }
  if (!buyerId || !commerceId) {
    return emptyResult(
      NOTICES.chats,
      'No se pudo identificar al comprador o al comercio de esta conversación.'
    );
  }

  const itemAgreement = offerItemAgreement(selectedItemOptions);

  const existing = await runQuery(
    (db) =>
      db
        .from('chat_threads')
        .select('*')
        .eq('buyer_id', buyerId)
        .eq('commerce_id', commerceId)
        .order('created_at', { ascending: false })
        .limit(1),
    NOTICES.chats
  );

  if (existing.error) return { item: null, error: existing.error, notice: existing.notice };

  const thread = existing.items[0];
  if (thread) {
    // La oferta es el contexto de la compra. Se sincroniza al abrir el chat
    // desde una oferta; si ya había un pedido de otra oferta, la nueva oferta
    // representa una compra nueva (el pedido anterior se conserva intacto).
    // La opción elegida se guarda también en el hilo para que el acuerdo sea
    // visible para ambos lados. Si se abre otra oferta sin elección, se limpia.
    const patch = {};
    if (offerId && thread.offer_id !== offerId) {
      patch.offer_id = offerId;
      patch.selected_offer_option = selectedOption || null;
      patch.selected_offer_items = itemAgreement;
    } else {
      if (selectedOption) patch.selected_offer_option = selectedOption;
      if (itemAgreement.length > 0) patch.selected_offer_items = itemAgreement;
    }

    if (Object.keys(patch).length > 0) {
      const updated = await runWrite(
        (db) => db.from('chat_threads').update(patch).eq('id', thread.id),
        'No se pudo preparar la compra en esta conversación.'
      );
      if (updated.ok) {
        return { item: { ...thread, ...patch }, error: null, notice: null };
      }
      return { item: thread, error: updated.error, notice: null };
    }

    return { item: thread, error: null, notice: null };
  }

  const created = await runWrite(
    (db) =>
      db.from('chat_threads').insert([
        {
          buyer_id: buyerId,
          commerce_id: commerceId,
          order_id: orderId,
          offer_id: offerId,
          selected_offer_option: selectedOption || null,
          selected_offer_items: itemAgreement,
          subject: subject || 'Conversación',
          status: 'active',
        },
      ]),
    'No se pudo iniciar la conversación.'
  );

  if (!created.ok) return { item: null, error: created.error, notice: null };
  if (created.data[0]) return { item: created.data[0], error: null, notice: null };

  // Algunos backends no devuelven la fila insertada; se vuelve a consultar.
  return fetchChatThreadFromPair(buyerId, commerceId);
};

const fetchChatThreadFromPair = async (buyerId, commerceId) => {
  const result = await runQuery(
    (db) =>
      db
        .from('chat_threads')
        .select('*')
        .eq('buyer_id', buyerId)
        .eq('commerce_id', commerceId)
        .order('created_at', { ascending: false })
        .limit(1),
    NOTICES.chats
  );

  return { item: result.items[0] || null, error: result.error, notice: result.notice };
};

// Abre (o crea) la conversación del comprador con el comercio de una oferta.
export const openChatForOffer = async ({
  userId,
  offer,
  subject,
  selectedOption = null,
  selectedItemOptions = [],
}) => {
  const guard = requireUserId(userId, NOTICES.chats);
  if (guard) return { ...guard, item: null };

  if (!offer?.commerceId) {
    return {
      item: null,
      error: 'La oferta no tiene un comercio asociado.',
      notice: NOTICES.chats,
    };
  }

  const buyer = await fetchBuyerProfileId(userId);
  if (!buyer.item) {
    return {
      item: null,
      error: buyer.error,
      notice: buyer.notice || NOTICES.chats,
    };
  }

  return ensureChatThread({
    buyerId: buyer.item.id,
    commerceId: offer.commerceId,
    subject: subject || offer.store || 'Conversación',
    offerId: offer.id || null,
    selectedOption,
    selectedItemOptions,
  });
};

// -----------------------------------------------------------------------------
// Comercio: oportunidades, métricas y ventas
// -----------------------------------------------------------------------------
export const fetchOpenRequests = async (commerceId) => {
  if (!isInsforgeConfigured) return emptyResult(NOTICES.demo);
  if (!commerceId) return emptyResult(NOTICES.commerceMetrics);

  // La segmentación vive en el perfil del comercio. Se resuelve primero para
  // no descargar solicitudes que este comercio no puede atender.
  const commerce = await runQuery(
    (db) =>
      db
        .from('commerce_profiles')
        .select('id,status,vehicle_types,inventory_systems')
        .eq('id', commerceId)
        .limit(1),
    NOTICES.commerceMetrics
  );

  if (commerce.error) {
    return emptyResult(
      commerce.notice || NOTICES.commerceMetrics,
      commerce.error
    );
  }

  const profile = commerce.items[0] || null;
  if (!profile) return emptyResult(NOTICES.commerceMetrics);

  if (!hasCommerceSegmentation(profile)) {
    return emptyResult(NOTICES.commerceSegmentation);
  }

  const result = await runQuery(
    (db) =>
      db
        .from('purchase_requests')
        // `buyer_id` se necesita para resolver avatar e insignia del club.
        .select(
          'id,buyer_id,title,description,items,category,vehicle_type,budget_amount,budget,preferences,is_recommendation,currency,status,expires_at,created_at,request_type,vehicle_plate,service_zone'
        )
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50),
    NOTICES.commerceMetrics
  );

  if (result.error) return result;

  // Segunda barrera además de RLS: cubre solicitudes antiguas con la
  // segmentación solo en `items` y evita que un comercio vea solicitudes
  // ajenas a su nicho si la migración de matching aún no está aplicada.
  const compatibleRequests = filterCompatibleRequests(result.items, profile);
  const buyerIds = [
    ...new Set(compatibleRequests.map((request) => request.buyer_id).filter(Boolean)),
  ];
  let buyerById = {};
  let badgeByBuyer = {};
  let workshopBadgeByBuyer = {};

  if (buyerIds.length > 0) {
    // RPC acotada: solo id, nombre y avatar de compradores con los que este
    // comercio tiene relación o cuya solicitud abierta puede atender.
    // Las insignias de club y B2B son informativas: un fallo no rompe el tablero.
    const [buyers, badges, workshopBadges] = await Promise.all([
      runQuery(
        (db) => db.rpc('app_buyer_avatars', { p_ids: buyerIds }),
        NOTICES.commerceMetrics
      ),
      fetchGroupBadges(buyerIds),
      fetchWorkshopBadges(buyerIds),
    ]);

    if (!buyers.error) {
      buyerById = buyers.items.reduce((acc, buyer) => {
        acc[buyer.id] = buyer;
        return acc;
      }, {});
    }

    if (!badges.error) {
      badgeByBuyer = badges.items.reduce((acc, badge) => {
        acc[badge.buyer_id] = badge;
        return acc;
      }, {});
    }

    if (!workshopBadges.error) {
      workshopBadgeByBuyer = workshopBadges.items.reduce((acc, badge) => {
        acc[badge.buyer_id] = badge;
        return acc;
      }, {});
    }
  }

  return {
    ...result,
    items: compatibleRequests.map((request) => {
      const buyer = buyerById[request.buyer_id] || {};
      const badge = badgeByBuyer[request.buyer_id] || null;
      const workshopBadge = workshopBadgeByBuyer[request.buyer_id] || null;
      return {
        ...request,
        buyer_name: buyer.display_name || '',
        buyer_avatar_url: buyer.avatar_url || null,
        buyer_workshop: workshopBadge
          ? { name: workshopBadge.workshop_name, isVerified: workshopBadge.is_verified }
          : null,
        buyer_group: badge
          ? {
              name: badge.group_name,
              memberCount: badge.member_count,
              minMembers: badge.min_members,
              isVerified: badge.is_verified,
            }
          : null,
      };
    }),
  };
};

export const fetchCommerceSales = async (commerceId) => {
  if (!commerceId) return emptyResult(NOTICES.commerceMetrics);

  return runQuery(
    (db) =>
      db
        .from('purchase_orders')
        .select('*')
        .eq('commerce_id', commerceId)
        .order('created_at', { ascending: false })
        .limit(200),
    NOTICES.commerceMetrics
  );
};

const cleanRecommendationText = (value) => String(value ?? '').trim();

export const mapOpportunity = (row) => {
  const items = Array.isArray(row.items) ? row.items.map(mapRequestItem) : [];
  const firstImage = items.find((item) => item.images.length > 0)?.images[0] || null;

  return {
    id: row.id,
    product: row.title || 'Solicitud sin título',
    details: row.description || '',
    budget: formatCurrency(row.budget_amount, row.currency),
    timeLeft: formatRelativeDate(row.expires_at || row.created_at),
    image: firstImage,
    items,
    quantityTotal: items.reduce((total, item) => total + item.quantity, 0),
    buyerName: row.buyer_name || 'Comprador',
    buyerAvatar: row.buyer_avatar_url || null,
    groupBadge: row.buyer_group || null,
    workshopBadge: row.buyer_workshop || null,
    requestType: row.request_type || 'part',
    vehiclePlate: row.vehicle_plate || null,
    serviceZone: row.service_zone || null,
    // Solicitudes «Recomiéndame»: el comercio arma un mini-catálogo en lugar de
    // cotizar una referencia exacta.
    isRecommendation: Boolean(row.is_recommendation),
    recommendationProduct:
      cleanRecommendationText(items[0]?.product) || cleanRecommendationText(row.title),
    recommendationBudget: formatCurrency(
      row.budget ?? row.budget_amount,
      row.currency
    ),
    preferences: cleanRecommendationText(row.preferences || items[0]?.notes),
    user: row.buyer_name || '',
    rating: null,
    transactions: null,
  };
};

// -----------------------------------------------------------------------------
// Notificaciones / reseñas / categorías
// -----------------------------------------------------------------------------
// No existe tabla de notificaciones en el backend: se devuelve vacío a
// propósito para no inventar actividad.
export const fetchNotifications = async () => emptyResult(NOTICES.notifications);

export const fetchBuyerReviews = async (userId) => {
  const guard = requireUserId(userId, NOTICES.reviews);
  if (guard) return guard;

  const buyer = await fetchBuyerProfileId(userId);
  if (!buyer.item) {
    return emptyResult(buyer.notice || NOTICES.reviews, buyer.error);
  }

  return runQuery(
    (db) =>
      db
        .from('commerce_reviews')
        .select('*')
        .eq('buyer_id', buyer.item.id)
        .order('created_at', { ascending: false }),
    NOTICES.reviews
  );
};

export const fetchCategories = async () =>
  runQuery(
    (db) =>
      db
        .from('commerce_categories')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
    NOTICES.categories
  );

// -----------------------------------------------------------------------------
// Escrituras (se intentan de verdad; el backend puede rechazarlas)
// -----------------------------------------------------------------------------
const normalizeSegmentationText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

// Construye el payload de una solicitud nueva. La categoría y el tipo de
// vehículo se promueven a columnas principales y, si no vienen explícitos, se
// toman del primer ítem para no perder el dato que capturó el comprador.
// También elimina la clave camelCase `vehicleType`, que no es una columna.
export const buildPurchaseRequestPayload = (payload = {}) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  const { vehicleType, ...rest } = source;
  const items = Array.isArray(rest.items) ? rest.items : [];
  const firstItem = items[0] && typeof items[0] === 'object' ? items[0] : {};

  const category =
    normalizeSegmentationText(rest.category) ||
    normalizeSegmentationText(firstItem.category) ||
    null;
  const vehicleTypeValue =
    normalizeSegmentationText(rest.vehicle_type) ||
    normalizeSegmentationText(vehicleType) ||
    normalizeSegmentationText(firstItem.vehicle_type) ||
    normalizeSegmentationText(firstItem.vehicleType) ||
    null;

  const next = { ...rest };
  if (category) next.category = category;
  else delete next.category;

  if (vehicleTypeValue) next.vehicle_type = vehicleTypeValue;
  else delete next.vehicle_type;

  // Módulo de talleres: solo se envían cuando vienen explícitos. Las
  // solicitudes actuales siguen cayendo en el default 'part' del backend.
  const requestType = normalizeSegmentationText(rest.request_type);
  if (next.request_type === undefined && requestType) {
    next.request_type = requestType;
  }
  const vehiclePlate = normalizeSegmentationText(rest.vehicle_plate);
  if (next.vehicle_plate === undefined && vehiclePlate) {
    next.vehicle_plate = vehiclePlate;
  } else if (next.vehicle_plate === undefined) {
    delete next.vehicle_plate;
  }
  const serviceZone = normalizeSegmentationText(rest.service_zone);
  if (next.service_zone === undefined && serviceZone) {
    next.service_zone = serviceZone;
  } else if (next.service_zone === undefined) {
    delete next.service_zone;
  }
  // Especialidad del trabajo de servicio: la RPC de /workshop-jobs la usa para
  // mostrárselo solo a los talleres que la tienen en su perfil.
  const specialty = normalizeSegmentationText(rest.specialty);
  if (specialty) next.specialty = specialty;
  else delete next.specialty;
  const serviceModality = normalizeSegmentationText(rest.service_modality);
  if (serviceModality) next.service_modality = serviceModality;
  else delete next.service_modality;

  // Modo «Recomiéndame»: las columnas nuevas solo se envían cuando el
  // comprador pidió recomendaciones. Las solicitudes tradicionales conservan
  // su payload exacto y caen en el default is_recommendation = false.
  if (rest.is_recommendation === true) {
    next.is_recommendation = true;
    const budget = normalizeRecommendationBudget(rest.budget ?? rest.budget_amount);
    if (budget !== null) {
      next.budget = budget;
      next.budget_amount = budget;
    } else {
      delete next.budget;
    }
    const preferences = normalizeSegmentationText(rest.preferences);
    if (preferences) next.preferences = preferences;
    else delete next.preferences;

    // Marca y modelo opcionales del vehículo: se guardan dentro del JSONB con
    // las claves que ya entiende el panel del comercio y se eliminan de la
    // raíz porque purchase_requests no tiene columnas `brand`/`model`.
    const vehicleBrand = normalizeSegmentationText(rest.brand);
    const vehicleModel = normalizeSegmentationText(rest.model);
    if (vehicleBrand || vehicleModel) {
      next.items = items.map((item, index) =>
        index === 0
          ? {
              ...item,
              ...(vehicleBrand
                ? { brand: vehicleBrand, vehicleBrand: normalizeSegmentationText(item.vehicleBrand) || vehicleBrand }
                : {}),
              ...(vehicleModel
                ? { model: vehicleModel, vehicleModel: normalizeSegmentationText(item.vehicleModel) || vehicleModel }
                : {}),
            }
          : item
      );
    }
    delete next.brand;
    delete next.model;
    delete next.year; // El año ya no se captura; nunca fue una columna de la tabla.
  } else {
    delete next.is_recommendation;
    delete next.budget;
    delete next.preferences;
    delete next.brand;
    delete next.model;
    delete next.year;
  }

  return next;
};

export const createPurchaseRequest = async (payload) =>
  runWrite(
    (db) => db.from('purchase_requests').insert([buildPurchaseRequestPayload(payload)]),
    'No se pudo publicar la solicitud.'
  );

export const createOffer = async (payload) =>
  runWrite((db) => db.from('purchase_offers').insert([payload]), 'No se pudo enviar la oferta.');

export const createReview = async (payload) =>
  runWrite((db) => db.from('commerce_reviews').insert([payload]), 'No se pudo guardar la calificación.');

export const sendChatMessage = async (payload) => {
  const result = await runWrite(
    (db) => db.from('chat_messages').insert([payload]),
    'No se pudo enviar el mensaje.'
  );

  if (!result.ok) return result;

  // Mantiene ordenada la lista de conversaciones por el último mensaje.
  await runWrite(
    (db) =>
      db
        .from('chat_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', payload.chat_id),
    'No se pudo actualizar la conversación.'
  );

  return result;
};
