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
// Contexto del backend: las tablas de negocio existen (purchase_requests,
// purchase_offers, purchase_orders, chat_threads, chat_messages,
// commerce_reviews, commerce_categories), pero hoy solo las tablas admin_*
// tienen permisos para `authenticated`. Cuando se añadan las políticas RLS
// correspondientes, estas mismas consultas empezarán a devolver datos reales
// sin cambiar la interfaz.
// =============================================================================

import { insforge, isInsforgeConfigured } from '../lib/insforge';

export const appMode = isInsforgeConfigured ? 'insforge' : 'demo';

export const NOTICES = {
  demo:
    'Modo demostración: no hay backend InsForge configurado, por eso este módulo se muestra vacío. No se usan datos de ejemplo.',
  permissions:
    'El backend rechazó la consulta por permisos: tu sesión es válida, pero todavía no existen políticas RLS que permitan a compradores y comercios leer estos datos.',
  requests:
    'El listado se llenará cuando se habiliten los permisos de lectura sobre purchase_requests para tu cuenta.',
  offers:
    'Las ofertas de los comercios se guardan en purchase_offers; ese acceso todavía no está habilitado para tu cuenta.',
  orders:
    'Los pedidos se guardan en purchase_orders; ese acceso todavía no está habilitado para tu cuenta.',
  chats:
    'Las conversaciones se guardan en chat_threads y chat_messages; ese acceso todavía no está habilitado para tu cuenta.',
  notifications:
    'Todavía no existe un módulo de notificaciones en el backend. No se muestran datos de ejemplo.',
  reviews:
    'Las calificaciones se guardan en commerce_reviews; ese acceso todavía no está habilitado para tu cuenta.',
  commerceMetrics:
    'Las métricas del comercio requieren agregados sobre purchase_orders que todavía no están disponibles para tu cuenta.',
  categories:
    'Las categorías se guardan en commerce_categories; ese acceso todavía no está habilitado para tu cuenta.',
  write:
    'La operación de escritura todavía no está habilitada en el backend para tu cuenta.',
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
    return 'El backend rechazó la operación por permisos. Tu sesión es válida, pero aún no hay políticas RLS que permitan acceder a estos datos.';
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
  items: Array.isArray(row.items) ? row.items : [],
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
  const available = items.filter((item) => item && item.available !== false).length;

  return {
    id: row.id,
    requestId: row.request_id,
    store: row.commerce_name || 'Comercio',
    price: formatCurrency(row.total_amount, row.currency),
    deliveryDays: row.delivery_days ?? null,
    conditions: row.conditions || '',
    status: row.status,
    found: available,
    total: items.length,
    items: items.map((item) => ({
      name: item.name || item.title || 'Producto',
      status: item.available === false ? 'missing' : 'available',
    })),
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
    (db) => db.from('commerce_profiles').select('id,trade_name').eq('owner_user_id', userId).limit(1),
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
  status: row.status || 'open',
  lastMessageAt: row.last_message_at || row.created_at,
  time: formatRelativeDate(row.last_message_at || row.created_at),
  unread: Number(row.unread_count) || 0,
});

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

// -----------------------------------------------------------------------------
// Comercio: oportunidades, métricas y ventas
// -----------------------------------------------------------------------------
export const fetchOpenRequests = async (commerceId) => {
  if (!commerceId) return emptyResult(NOTICES.commerceMetrics);

  return runQuery(
    (db) =>
      db
        .from('purchase_requests')
        .select('*')
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

export const mapOpportunity = (row) => ({
  id: row.id,
  product: row.title || 'Solicitud sin título',
  details: row.description || '',
  budget: formatCurrency(row.budget_amount, row.currency),
  timeLeft: formatRelativeDate(row.expires_at || row.created_at),
  image: null,
  user: '',
  rating: null,
  transactions: null,
});

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

export const sendChatMessage = async (payload) =>
  runWrite((db) => db.from('chat_messages').insert([payload]), 'No se pudo enviar el mensaje.');
