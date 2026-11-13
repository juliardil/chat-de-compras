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

import { insforge, isInsforgeConfigured } from '../lib/insforge';

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

const emptyResult = (notice, error = null) => ({ items: [], error, notice });

// Ejecuta una consulta de lectura y normaliza la respuesta. `build` recibe el
// cliente de base de datos y devuelve el builder de la consulta.
const runQuery = async (build, notice) => {
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
const runWrite = async (build, fallback) => {
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
  brand: item.brand || '',
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
  items: Array.isArray(row.items) ? row.items.map(mapRequestItem) : [],
});

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

  // Los nombres comerciales viven en commerce_profiles. Si esa consulta no
  // está permitida, se usa un nombre genérico (nunca inventado).
  const commerceIds = [...new Set(offers.items.map((offer) => offer.commerce_id).filter(Boolean))];
  let commerceNames = {};
  if (commerceIds.length > 0) {
    const profiles = await runQuery(
      (db) => db.from('commerce_profiles').select('id,trade_name').in('id', commerceIds),
      NOTICES.offers
    );
    commerceNames = profiles.items.reduce((acc, profile) => {
      acc[profile.id] = profile.trade_name;
      return acc;
    }, {});
  }

  return {
    items: offers.items.map((offer) => ({ ...offer, commerce_name: commerceNames[offer.commerce_id] || '' })),
    error: offers.error,
    notice: offers.notice,
  };
};

export const mapOffer = (row) => {
  const items = Array.isArray(row.items) ? row.items : [];
  const isAvailable = (item) => item?.available !== false;
  const availableItems = items.filter((item) => item && isAvailable(item));

  return {
    id: row.id,
    requestId: row.request_id,
    commerceId: row.commerce_id || null,
    store: row.commerce_name || 'Comercio',
    price: formatCurrency(row.total_amount, row.currency),
    deliveryDays: row.delivery_days ?? null,
    conditions: row.conditions || '',
    status: row.status,
    found: availableItems.length,
    total: items.length,
    // Solo las unidades que el comercio sí cotizó.
    quantityTotal: availableItems.reduce(
      (total, item) => total + toPositiveInteger(item.quantity ?? item.cantidad, 1),
      0
    ),
    items: items.map((item) => {
      const available = isAvailable(item);
      const quantity = toPositiveInteger(item?.quantity ?? item?.cantidad, 1);
      const unitPrice = Number(item?.unitPrice ?? item?.unit_price);
      const totalPrice = Number(item?.totalPrice ?? item?.total_price);

      return {
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
      };
    }),
  };
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
// Chats
// -----------------------------------------------------------------------------
export const fetchCommerceIdForUser = async (userId) => {
  if (!isInsforgeConfigured) return emptyResult(NOTICES.demo);
  if (!userId) return emptyResult(NOTICES.chats, 'No hay una sesión activa para consultar estos datos.');

  const result = await runQuery(
    (db) => db.from('commerce_profiles').select('id,trade_name,status').eq('owner_user_id', userId).limit(1),
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
    return fetchChatThreadsBy('commerce_id', commerce.item.id);
  }

  const buyer = await fetchBuyerProfileId(userId);
  if (!buyer.item) {
    return emptyResult(buyer.notice || NOTICES.chats, buyer.error);
  }

  return fetchChatThreadsBy('buyer_id', buyer.item.id);
};

const fetchChatThreadsBy = (column, id) =>
  runQuery(
    (db) =>
      db
        .from('chat_threads')
        .select('*')
        .eq(column, id)
        .order('last_message_at', { ascending: false }),
    NOTICES.chats
  );

export const mapChatThread = (row) => ({
  id: row.id,
  subject: row.subject || 'Conversación',
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
export const ensureChatThread = async ({ buyerId, commerceId, subject, orderId = null }) => {
  if (!isInsforgeConfigured) {
    return { item: null, error: null, notice: NOTICES.demo };
  }
  if (!buyerId || !commerceId) {
    return emptyResult(
      NOTICES.chats,
      'No se pudo identificar al comprador o al comercio de esta conversación.'
    );
  }

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
  if (existing.items[0]) return { item: existing.items[0], error: null, notice: null };

  const created = await runWrite(
    (db) =>
      db.from('chat_threads').insert([
        {
          buyer_id: buyerId,
          commerce_id: commerceId,
          order_id: orderId,
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
export const openChatForOffer = async ({ userId, offer, subject }) => {
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
  });
};

// -----------------------------------------------------------------------------
// Comercio: oportunidades, métricas y ventas
// -----------------------------------------------------------------------------
export const fetchOpenRequests = async (commerceId) => {
  if (!commerceId) return emptyResult(NOTICES.commerceMetrics);

  return runQuery(
    (db) =>
      db
        .from('purchase_requests')
        .select('id,title,description,items,budget_amount,currency,status,expires_at,created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50),
    NOTICES.commerceMetrics
  );
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
    user: '',
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
export const createPurchaseRequest = async (payload) =>
  runWrite(
    (db) => db.from('purchase_requests').insert([payload]),
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
