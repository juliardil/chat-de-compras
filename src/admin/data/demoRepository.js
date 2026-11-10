import { getPermissionsForRole, ROLE_BY_KEY, ROLES } from '../auth/permissions';
import {
  COMMERCE_TRANSITIONS,
  documentTypeLabel,
} from '../constants/phase2';
import {
  DELIVERY_EVIDENCE_LABELS,
  DELIVERY_INCIDENT_LABELS,
  DELIVERY_INCIDENT_TYPES,
  DELIVERY_TRANSITIONS,
  OFFER_TRANSITIONS,
  ORDER_DISPUTE_RESOLUTIONS,
  ORDER_TRANSITIONS,
  REQUEST_TRANSITIONS,
  deliveryTransitionPermission,
  offerActionKey,
  offerActionPermission,
  orderTransitionPermission,
  requestActionKey,
  requestActionPermission,
} from '../constants/phase3';
import {
  CAMPAIGN_TRANSITIONS,
  CHAT_ACCESS_DEFAULT_HOURS,
  CHAT_ACCESS_TRANSITIONS,
  COMMUNICATION_SEGMENT_LABELS,
  COMMUNICATION_TEMPLATE_TRANSITIONS,
  MODERATION_PRIORITY_LABELS,
  MODERATION_REPORT_TYPE_LABELS,
  MODERATION_TRANSITIONS,
  REVIEW_TRANSITIONS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_SLA_HOURS,
  SUPPORT_TRANSITIONS,
  campaignActionKey,
  campaignPermission,
  chatAccessEffectiveStatus,
  moderationActionKey,
  moderationActionPermission,
  reviewActionKey,
  reviewActionPermission,
  supportActionKey,
  supportStatusPermission,
} from '../constants/phase4';
import {
  ANALYTICS_EXPORT_NOTICE,
  DEFAULT_ANALYTICS_RANGE,
  GLOBAL_SEARCH_LIMIT,
  GLOBAL_SEARCH_MIN_LENGTH,
  GLOBAL_SEARCH_TYPES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  analyticsRangeDays,
  analyticsRangeLabel,
  paymentCountsAsCollected,
  paymentIsReconcilable,
} from '../constants/phase5';
import { buildPhase2Audit, buildPhase2Seed } from './demoSeedPhase2';
import { buildPhase3Audit, buildPhase3Seed } from './demoSeedPhase3';
import { buildPhase4Audit, buildPhase4Seed } from './demoSeedPhase4';
import { buildPhase5Audit, buildPhase5Seed } from './demoSeedPhase5';
import { maskEmail, maskPhone, slugify } from '../utils/mask';
import { buildCsv, csvDateStamp } from '../utils/csv';

const STORE_KEY = 'chat_compras_admin_demo_v1';
const SESSION_KEY = 'chat_compras_admin_demo_session_v1';
const STORE_VERSION = 5;

// Credenciales exclusivas del modo demostración. No existen en producción.
export const DEMO_PASSWORD = 'Demo1234!';

export const DEMO_ACCOUNTS = [
  { email: 'superadmin@demo.local', name: 'Ana Torres', roleKey: 'superadmin' },
  { email: 'admin@demo.local', name: 'Diego Ramírez', roleKey: 'admin' },
  { email: 'comercios@demo.local', name: 'María Salas', roleKey: 'commerce_manager' },
  { email: 'moderador@demo.local', name: 'Javier Peña', roleKey: 'moderator' },
  { email: 'soporte@demo.local', name: 'Lucía Fernández', roleKey: 'support' },
  { email: 'analista@demo.local', name: 'Tomás Ríos', roleKey: 'analyst' },
];

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const nowIso = () => new Date().toISOString();

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

function buildSeed() {
  const members = DEMO_ACCOUNTS.map((account, index) => ({
    id: `demo-member-${index + 1}`,
    email: account.email,
    name: account.name,
    roleKey: account.roleKey,
    status: 'active',
    createdAt: hoursAgo(24 * (30 - index)),
    lastLoginAt: index === 0 ? hoursAgo(2) : hoursAgo(20 + index * 5),
  }));

  const phase2 = buildPhase2Seed();
  const phase3 = buildPhase3Seed();
  const phase4 = buildPhase4Seed();
  const phase5 = buildPhase5Seed();

  return {
    version: STORE_VERSION,
    ...phase2,
    ...phase3,
    ...phase4,
    ...phase5,
    members,
    invitations: [
      {
        id: 'demo-invitation-1',
        email: 'laura.analista@demo.local',
        name: 'Laura Gómez',
        roleKey: 'analyst',
        status: 'pending',
        createdAt: hoursAgo(6),
        invitedByName: 'Ana Torres',
      },
    ],
    audit: [
      ...buildPhase5Audit(),
      ...buildPhase4Audit(),
      ...buildPhase3Audit(),
      ...buildPhase2Audit(),
      {
        id: 'demo-audit-1',
        createdAt: hoursAgo(2),
        actorId: 'demo-member-1',
        actorName: 'Ana Torres',
        actorRole: 'superadmin',
        action: 'auth.login',
        module: 'Autenticación',
        entityType: 'admin_member',
        entityId: 'demo-member-1',
        reason: null,
        metadata: { result: 'success' },
      },
      {
        id: 'demo-audit-2',
        createdAt: hoursAgo(5),
        actorId: 'demo-member-1',
        actorName: 'Ana Torres',
        actorRole: 'superadmin',
        action: 'staff.invite',
        module: 'Personal',
        entityType: 'admin_invitation',
        entityId: 'demo-invitation-1',
        reason: 'Alta de analista para reportes',
        metadata: { email: 'laura.analista@demo.local', roleKey: 'analyst' },
      },
      {
        id: 'demo-audit-3',
        createdAt: hoursAgo(9),
        actorId: 'demo-member-2',
        actorName: 'Diego Ramírez',
        actorRole: 'admin',
        action: 'auth.login',
        module: 'Autenticación',
        entityType: 'admin_member',
        entityId: 'demo-member-2',
        reason: null,
        metadata: { result: 'success' },
      },
    ],
  };
}

function upgradeStore(stored) {
  if (!stored || typeof stored !== 'object') return null;

  const phase2 = buildPhase2Seed();
  const phase3 = buildPhase3Seed();
  const phase4 = buildPhase4Seed();
  const phase5 = buildPhase5Seed();
  const upgraded = {
    ...stored,
    version: STORE_VERSION,
    members: Array.isArray(stored.members) ? stored.members : [],
    invitations: Array.isArray(stored.invitations) ? stored.invitations : [],
    buyers: Array.isArray(stored.buyers) ? stored.buyers : phase2.buyers,
    categories: Array.isArray(stored.categories) ? stored.categories : phase2.categories,
    commerces: Array.isArray(stored.commerces) ? stored.commerces : phase2.commerces,
    commerceDocuments: Array.isArray(stored.commerceDocuments)
      ? stored.commerceDocuments
      : phase2.commerceDocuments,
    requests: Array.isArray(stored.requests) ? stored.requests : phase3.requests,
    offers: Array.isArray(stored.offers) ? stored.offers : phase3.offers,
    orders: Array.isArray(stored.orders) ? stored.orders : phase3.orders,
    orderEvents: Array.isArray(stored.orderEvents) ? stored.orderEvents : phase3.orderEvents,
    orderDisputes: Array.isArray(stored.orderDisputes) ? stored.orderDisputes : phase3.orderDisputes,
    deliveries: Array.isArray(stored.deliveries) ? stored.deliveries : phase3.deliveries,
    deliveryIncidents: Array.isArray(stored.deliveryIncidents)
      ? stored.deliveryIncidents
      : phase3.deliveryIncidents,
    deliveryEvidence: Array.isArray(stored.deliveryEvidence)
      ? stored.deliveryEvidence
      : phase3.deliveryEvidence,
    chats: Array.isArray(stored.chats) ? stored.chats : phase4.chats,
    chatAccessRequests: Array.isArray(stored.chatAccessRequests)
      ? stored.chatAccessRequests
      : phase4.chatAccessRequests,
    moderationReports: Array.isArray(stored.moderationReports)
      ? stored.moderationReports
      : phase4.moderationReports,
    reviews: Array.isArray(stored.reviews) ? stored.reviews : phase4.reviews,
    supportTickets: Array.isArray(stored.supportTickets)
      ? stored.supportTickets
      : phase4.supportTickets,
    communicationTemplates: Array.isArray(stored.communicationTemplates)
      ? stored.communicationTemplates
      : phase4.communicationTemplates,
    communicationCampaigns: Array.isArray(stored.communicationCampaigns)
      ? stored.communicationCampaigns
      : phase4.communicationCampaigns,
    paymentTransactions: Array.isArray(stored.paymentTransactions)
      ? stored.paymentTransactions
      : phase5.paymentTransactions,
    paymentPayouts: Array.isArray(stored.paymentPayouts)
      ? stored.paymentPayouts
      : phase5.paymentPayouts,
    audit: Array.isArray(stored.audit) ? stored.audit : [],
  };

  // Cada fase añade su semilla y sus eventos de auditoría al migrar un almacén
  // anterior, sin tocar miembros, invitaciones ni eventos ya existentes.
  if (stored.version === 1) {
    upgraded.audit = [
      ...buildPhase5Audit(),
      ...buildPhase4Audit(),
      ...buildPhase3Audit(),
      ...buildPhase2Audit(),
      ...upgraded.audit,
    ].slice(0, 200);
  } else if (stored.version === 2) {
    upgraded.audit = [
      ...buildPhase5Audit(),
      ...buildPhase4Audit(),
      ...buildPhase3Audit(),
      ...upgraded.audit,
    ].slice(0, 200);
  } else if (stored.version === 3) {
    upgraded.audit = [
      ...buildPhase5Audit(),
      ...buildPhase4Audit(),
      ...upgraded.audit,
    ].slice(0, 200);
  } else if (stored.version === 4) {
    upgraded.audit = [...buildPhase5Audit(), ...upgraded.audit].slice(0, 200);
  }

  return upgraded;
}

function readStore() {
  const stored = upgradeStore(readJson(STORE_KEY, null));

  if (stored && stored.members.length) {
    writeJson(STORE_KEY, stored);
    return stored;
  }

  const seed = buildSeed();
  writeJson(STORE_KEY, seed);
  return seed;
}

function saveStore(store) {
  writeJson(STORE_KEY, store);
}

function appendAudit(store, entry) {
  const record = {
    id: makeId(),
    createdAt: nowIso(),
    reason: null,
    metadata: {},
    ...entry,
  };
  store.audit = [record, ...store.audit].slice(0, 200);
  return record;
}

function toSession(member) {
  const role = ROLE_BY_KEY[member.roleKey];
  return {
    memberId: member.id,
    email: member.email,
    name: member.name,
    roleKey: member.roleKey,
    roleName: role ? role.name : member.roleKey,
    status: member.status,
    permissions: getPermissionsForRole(member.roleKey),
  };
}

function findMemberByEmail(store, email) {
  const normalized = email.trim().toLowerCase();
  return store.members.find((member) => member.email.toLowerCase() === normalized);
}

const actorHas = (actor, permissionKey) => {
  if (!permissionKey) return true;
  return Array.isArray(actor?.permissions) && actor.permissions.includes(permissionKey);
};

function requirePermission(actor, permissionKey, message) {
  if (!actorHas(actor, permissionKey)) {
    throw new Error(message || 'No tienes permiso para realizar esta acción.');
  }
}

function requireReason(reason) {
  if (!reason || !String(reason).trim()) {
    throw new Error('Debes indicar un motivo.');
  }
}

function presentBuyer(buyer, viewPii) {
  return {
    ...buyer,
    email: viewPii ? buyer.email : maskEmail(buyer.email),
    phone: viewPii ? buyer.phone : maskPhone(buyer.phone),
    piiMasked: !viewPii,
  };
}

function summarizeDocuments(documents) {
  return documents.reduce(
    (summary, document) => {
      summary.total += 1;
      if (summary[document.status] !== undefined) summary[document.status] += 1;
      return summary;
    },
    { total: 0, pending: 0, verified: 0, rejected: 0 }
  );
}

function decorateCategory(store, category) {
  const children = store.categories.filter((item) => item.parentId === category.id);
  const parent = category.parentId
    ? store.categories.find((item) => item.id === category.parentId)
    : null;

  return {
    ...category,
    parentName: parent?.name || null,
    childCount: children.length,
    activeChildCount: children.filter((child) => child.status === 'active').length,
    commerceCount: store.commerces.filter((commerce) => commerce.categoryId === category.id).length,
  };
}

// -----------------------------------------------------------------------------
// Presentación de operaciones
// -----------------------------------------------------------------------------
function buyerName(store, buyerId) {
  return store.buyers.find((buyer) => buyer.id === buyerId)?.name || null;
}

function commerceName(store, commerceId) {
  return store.commerces.find((commerce) => commerce.id === commerceId)?.tradeName || null;
}

function categoryName(store, categoryId) {
  return store.categories.find((category) => category.id === categoryId)?.name || null;
}

function decorateRequest(store, request) {
  const offers = store.offers.filter((offer) => offer.requestId === request.id);
  return {
    ...request,
    buyerName: buyerName(store, request.buyerId),
    categoryName: categoryName(store, request.categoryId),
    itemCount: Array.isArray(request.items) ? request.items.length : 0,
    offerCount: offers.length,
    activeOfferCount: offers.filter((offer) => offer.status === 'active').length,
  };
}

function decorateOffer(store, offer) {
  const request = store.requests.find((item) => item.id === offer.requestId);
  return {
    ...offer,
    requestTitle: request?.title || null,
    buyerName: request ? buyerName(store, request.buyerId) : null,
    commerceName: commerceName(store, offer.commerceId),
    itemCount: Array.isArray(offer.items) ? offer.items.length : 0,
  };
}

function presentIncident(incident) {
  return {
    ...incident,
    typeLabel: DELIVERY_INCIDENT_LABELS[incident.incidentType] || incident.incidentType,
  };
}

function presentEvidence(evidence) {
  const { storagePath, ...metadata } = evidence;
  return {
    ...metadata,
    typeLabel: DELIVERY_EVIDENCE_LABELS[evidence.evidenceType] || evidence.evidenceType,
    hasFile: Boolean(storagePath),
  };
}

function decorateDelivery(store, delivery, { details = false } = {}) {
  const order = store.orders.find((item) => item.id === delivery.orderId);
  const incidents = store.deliveryIncidents.filter(
    (incident) => incident.deliveryId === delivery.id
  );
  const evidence = store.deliveryEvidence.filter((item) => item.deliveryId === delivery.id);

  return {
    ...delivery,
    orderNumber: order?.orderNumber || null,
    orderStatus: order?.status || null,
    orderTotalAmount: order?.totalAmount ?? null,
    buyerName: order ? buyerName(store, order.buyerId) : null,
    commerceName: order ? commerceName(store, order.commerceId) : null,
    incidentCount: incidents.length,
    openIncidentCount: incidents.filter((incident) => incident.status === 'open').length,
    evidenceCount: evidence.length,
    ...(details
      ? {
          incidents: incidents
            .slice()
            .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
            .map(presentIncident),
          evidence: evidence
            .slice()
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
            .map(presentEvidence),
        }
      : {}),
  };
}

function decorateOrder(store, order, { details = false, canViewDeliveries = false } = {}) {
  const delivery = store.deliveries.find((item) => item.orderId === order.id);
  const openDispute = store.orderDisputes.find(
    (dispute) => dispute.orderId === order.id && dispute.status === 'open'
  );

  const base = {
    ...order,
    buyerName: buyerName(store, order.buyerId),
    commerceName: commerceName(store, order.commerceId),
    itemCount: Array.isArray(order.items) ? order.items.length : 0,
    deliveryId: delivery?.id || null,
    deliveryStatus: canViewDeliveries ? delivery?.status || null : null,
    hasOpenDispute: Boolean(openDispute),
  };

  if (!details) return base;

  return {
    ...base,
    timeline: store.orderEvents
      .filter((event) => event.orderId === order.id)
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    disputes: store.orderDisputes
      .filter((dispute) => dispute.orderId === order.id)
      .slice()
      .sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt)),
    delivery:
      canViewDeliveries && delivery ? decorateDelivery(store, delivery, { details: true }) : null,
    deliveryRestricted: !canViewDeliveries,
  };
}

// -----------------------------------------------------------------------------
// Presentación de confianza y atención (Fase 4)
// -----------------------------------------------------------------------------
function activeChatAccess(store, chatId, actor) {
  if (!actor?.memberId) return null;
  return (
    store.chatAccessRequests.find(
      (request) =>
        request.chatId === chatId &&
        request.requestedById === actor.memberId &&
        chatAccessEffectiveStatus(request) === 'approved'
    ) || null
  );
}

export function presentChatAccess(request) {
  const effectiveStatus = chatAccessEffectiveStatus(request);
  return {
    ...request,
    effectiveStatus,
    isActive: effectiveStatus === 'approved',
  };
}

function decorateChat(store, chat, actor) {
  const { messages, ...metadata } = chat;
  const order = store.orders.find((item) => item.id === chat.orderId);
  const access = activeChatAccess(store, chat.id, actor);
  const ownRequests = store.chatAccessRequests
    .filter((request) => request.chatId === chat.id && request.requestedById === actor?.memberId)
    .slice()
    .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

  return {
    ...metadata,
    buyerName: buyerName(store, chat.buyerId),
    commerceName: commerceName(store, chat.commerceId),
    orderNumber: order?.orderNumber || null,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    lastMessagePreview:
      Array.isArray(messages) && messages.length
        ? messages[messages.length - 1].body.slice(0, 140)
        : null,
    canReadContent: Boolean(access),
    activeAccessRequestId: access?.id || null,
    accessExpiresAt: access?.expiresAt || null,
    myAccessRequest: ownRequests.length ? presentChatAccess(ownRequests[0]) : null,
  };
}

function presentModerationReport(report, actor) {
  return {
    ...report,
    typeLabel: MODERATION_REPORT_TYPE_LABELS[report.reportType] || report.reportType,
    priorityLabel: MODERATION_PRIORITY_LABELS[report.priority] || report.priority,
    assignedToMe: Boolean(actor?.memberId && report.assignedToId === actor.memberId),
  };
}

function presentReview(store, review) {
  const order = store.orders.find((item) => item.id === review.orderId);
  return {
    ...review,
    buyerName: buyerName(store, review.buyerId),
    commerceName: commerceName(store, review.commerceId),
    orderNumber: order?.orderNumber || null,
  };
}

function presentSupportTicket(store, ticket, { details = false } = {}) {
  const { messages, ...metadata } = ticket;
  const order = ticket.orderId
    ? store.orders.find((item) => item.id === ticket.orderId)
    : null;
  const isOverdue =
    ['open', 'in_progress', 'waiting_user'].includes(ticket.status) &&
    Boolean(ticket.dueAt) &&
    new Date(ticket.dueAt).getTime() < Date.now();

  return {
    ...metadata,
    categoryLabel: SUPPORT_CATEGORY_LABELS[ticket.category] || ticket.category,
    priorityLabel: SUPPORT_PRIORITY_LABELS[ticket.priority] || ticket.priority,
    orderNumber: order?.orderNumber || null,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    isOverdue,
    ...(details
      ? {
          messages: (Array.isArray(messages) ? messages : [])
            .slice()
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        }
      : {}),
  };
}

function presentCommunicationTemplate(template) {
  return {
    ...template,
    segmentLabel: COMMUNICATION_SEGMENT_LABELS[template.segment] || template.segment,
  };
}

function presentCampaign(store, campaign) {
  const template = store.communicationTemplates.find((item) => item.id === campaign.templateId);
  return {
    ...campaign,
    templateName: template?.name || null,
    segmentLabel: COMMUNICATION_SEGMENT_LABELS[campaign.segment] || campaign.segment,
  };
}

function segmentAudienceCount(store, segment) {
  switch (segment) {
    case 'all_buyers':
      return store.buyers.length;
    case 'active_buyers':
      return store.buyers.filter((buyer) => buyer.status === 'active').length;
    case 'all_commerces':
      return store.commerces.length;
    case 'active_commerces':
      return store.commerces.filter((commerce) => commerce.status === 'approved').length;
    case 'mixed':
      return store.buyers.length + store.commerces.length;
    case 'support_contacts': {
      const contacts = new Set(
        store.supportTickets
          .map((ticket) => String(ticket.requesterEmail || '').trim().toLowerCase())
          .filter(Boolean)
      );
      return contacts.size;
    }
    default:
      return 0;
  }
}

function applyOrderTransition(
  store,
  order,
  { status, reason, reasonCode = null, resolution = null, actor }
) {
  const previousStatus = order.status;
  const allowed = ORDER_TRANSITIONS[previousStatus] || [];

  if (!allowed.includes(status)) {
    throw new Error('Transición de pedido no permitida.');
  }

  requirePermission(
    actor,
    orderTransitionPermission(previousStatus, status),
    previousStatus === 'disputed'
      ? 'No tienes permiso para resolver disputas.'
      : status === 'cancelled'
        ? 'No tienes permiso para cancelar pedidos.'
        : 'No tienes permiso para avanzar el estado de pedidos.'
  );
  requireReason(reason);

  let dispute = null;
  if (previousStatus === 'disputed') {
    if (!ORDER_DISPUTE_RESOLUTIONS.some((option) => option.value === resolution)) {
      throw new Error('Debes indicar una resolución válida para la disputa.');
    }
    dispute = store.orderDisputes.find(
      (item) => item.orderId === order.id && item.status === 'open'
    );
    if (!dispute) {
      throw new Error('El pedido no tiene una disputa abierta que resolver.');
    }
  }

  const now = nowIso();
  order.status = status;
  order.statusReason = String(reason).trim();
  order.updatedAt = now;

  if (status === 'confirmed' && !order.confirmedAt) order.confirmedAt = now;
  if (status === 'delivered') order.deliveredAt = now;
  if (status === 'completed') order.completedAt = now;
  if (status === 'cancelled') order.cancelledAt = now;

  if (status === 'disputed') {
    store.orderDisputes = [
      {
        id: makeId(),
        orderId: order.id,
        status: 'open',
        reason: String(reason).trim(),
        resolution: null,
        resolutionReason: null,
        openedByName: actor?.name || 'Sistema',
        openedAt: now,
        resolvedByName: null,
        resolvedAt: null,
      },
      ...store.orderDisputes,
    ];
  }

  if (dispute) {
    dispute.status = 'resolved';
    dispute.resolution = resolution;
    dispute.resolutionReason = String(reason).trim();
    dispute.resolvedByName = actor?.name || 'Sistema';
    dispute.resolvedAt = now;
  }

  store.orderEvents = [
    ...store.orderEvents,
    {
      id: makeId(),
      orderId: order.id,
      eventType: previousStatus === 'disputed' ? 'dispute_resolved' : status,
      status,
      description: String(reason).trim(),
      actorName: actor?.name || 'Sistema',
      metadata: { reasonCode, resolution },
      createdAt: now,
    },
  ];

  let action = 'order.transition';
  if (previousStatus === 'disputed') action = 'order.resolve_dispute';
  else if (status === 'disputed') action = 'order.dispute';
  else if (status === 'cancelled') action = 'order.cancel';

  appendAudit(store, {
    actorId: actor?.memberId || null,
    actorName: actor?.name || 'Sistema',
    actorRole: actor?.roleKey || null,
    action,
    module: 'Pedidos',
    entityType: 'purchase_order',
    entityId: order.id,
    reason: String(reason).trim(),
    metadata: { previousStatus, newStatus: status, reasonCode, resolution },
  });

  return order;
}

function applyDeliveryTransition(
  store,
  delivery,
  { status, reason, reasonCode = null, actor, carrier, trackingCode, estimatedAt }
) {
  const previousStatus = delivery.status;
  const allowed = DELIVERY_TRANSITIONS[previousStatus] || [];

  if (!allowed.includes(status)) {
    throw new Error('Transición de entrega no permitida.');
  }

  requirePermission(
    actor,
    deliveryTransitionPermission(status),
    status === 'delivered'
      ? 'No tienes permiso para confirmar la recepción de entregas.'
      : 'No tienes permiso para actualizar el seguimiento de entregas.'
  );
  requireReason(reason);

  const now = nowIso();
  delivery.status = status;
  delivery.statusReason = String(reason).trim();
  delivery.updatedAt = now;

  if (carrier !== undefined) delivery.carrier = carrier ? String(carrier).trim() : null;
  if (trackingCode !== undefined) {
    delivery.trackingCode = trackingCode ? String(trackingCode).trim() : null;
  }
  if (estimatedAt !== undefined) delivery.estimatedAt = estimatedAt || null;
  if (status === 'shipped' && !delivery.shippedAt) delivery.shippedAt = now;
  if (status === 'delivered') delivery.deliveredAt = now;

  appendAudit(store, {
    actorId: actor?.memberId || null,
    actorName: actor?.name || 'Sistema',
    actorRole: actor?.roleKey || null,
    action: status === 'delivered' ? 'delivery.confirm' : 'delivery.update',
    module: 'Entregas',
    entityType: 'order_delivery',
    entityId: delivery.id,
    reason: String(reason).trim(),
    metadata: {
      previousStatus,
      newStatus: status,
      reasonCode,
      orderId: delivery.orderId,
    },
  });

  return delivery;
}

// -----------------------------------------------------------------------------
// Presentación de analítica y pagos (Fase 5)
// -----------------------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function analyticsWindow(days) {
  const end = new Date();
  const start = startOfDay(new Date(end.getTime() - (days - 1) * DAY_MS));
  return { start, end };
}

function withinWindow(value, window) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time >= window.start.getTime() && time <= window.end.getTime();
}

function roundAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildAnalytics(store, days) {
  const window = analyticsWindow(days);
  const payments = store.paymentTransactions.filter((payment) =>
    withinWindow(payment.paidAt || payment.createdAt, window)
  );
  const collectedPayments = payments.filter((payment) => paymentCountsAsCollected(payment.status));
  const orders = store.orders.filter((order) => withinWindow(order.placedAt || order.createdAt, window));

  const gmv = roundAmount(collectedPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0));
  const commissionRevenue = roundAmount(
    collectedPayments.reduce((total, payment) => total + Number(payment.commissionAmount || 0), 0)
  );
  const netToCommerces = roundAmount(
    collectedPayments.reduce((total, payment) => total + Number(payment.netAmount || 0), 0)
  );
  const refundedAmount = roundAmount(
    collectedPayments.reduce((total, payment) => total + Number(payment.refundedAmount || 0), 0)
  );
  const orderVolume = orders.reduce((total, order) => total + Number(order.totalAmount || 0), 0);

  const methodTotals = collectedPayments.reduce((accumulator, payment) => {
    const key = payment.method || 'none';
    accumulator[key] = (accumulator[key] || 0) + Number(payment.amount || 0);
    return accumulator;
  }, {});

  const methodMix = Object.entries(methodTotals)
    .map(([method, amount]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method] || method,
      amount: roundAmount(amount),
      share: gmv ? roundAmount((amount / gmv) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const commerceTotals = new Map();
  collectedPayments.forEach((payment) => {
    const current = commerceTotals.get(payment.commerceId) || {
      commerceId: payment.commerceId,
      gmv: 0,
      commission: 0,
      payments: 0,
    };
    current.gmv += Number(payment.amount || 0);
    current.commission += Number(payment.commissionAmount || 0);
    current.payments += 1;
    commerceTotals.set(payment.commerceId, current);
  });

  const topCommerces = Array.from(commerceTotals.values())
    .map((entry) => ({
      commerceId: entry.commerceId,
      commerceName: commerceName(store, entry.commerceId) || 'Comercio no disponible',
      gmv: roundAmount(entry.gmv),
      commission: roundAmount(entry.commission),
      payments: entry.payments,
      share: gmv ? roundAmount((entry.gmv / gmv) * 100) : 0,
    }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 5);

  const seriesMap = new Map();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(window.start.getTime() + index * DAY_MS);
    seriesMap.set(dayKey(date), { date: dayKey(date), gmv: 0, orders: 0, payments: 0 });
  }

  collectedPayments.forEach((payment) => {
    const bucket = seriesMap.get(dayKey(payment.paidAt || payment.createdAt));
    if (!bucket) return;
    bucket.gmv = roundAmount(bucket.gmv + Number(payment.amount || 0));
    bucket.payments += 1;
  });

  orders.forEach((order) => {
    const bucket = seriesMap.get(dayKey(order.placedAt || order.createdAt));
    if (bucket) bucket.orders += 1;
  });

  return {
    generatedAt: nowIso(),
    rangeDays: days,
    rangeLabel: analyticsRangeLabel(String(days)),
    periodStart: window.start.toISOString(),
    periodEnd: window.end.toISOString(),
    piiIncluded: false,
    gatewayConnected: false,
    notice: ANALYTICS_EXPORT_NOTICE,
    summary: {
      gmv,
      commissionRevenue,
      netToCommerces,
      refundedAmount,
      averageOrderValue: orders.length ? roundAmount(orderVolume / orders.length) : 0,
      orderVolume: roundAmount(orderVolume),
      orders: orders.length,
      payments: payments.length,
      collectedPayments: collectedPayments.length,
      completedOrders: orders.filter((order) => order.status === 'completed').length,
      disputedOrders: orders.filter((order) => order.status === 'disputed').length,
      cancelledOrders: orders.filter((order) => order.status === 'cancelled').length,
      unreconciledPayments: store.paymentTransactions.filter(
        (payment) => paymentIsReconcilable(payment.status) && !payment.reconciled
      ).length,
    },
    series: Array.from(seriesMap.values()),
    methodMix,
    topCommerces,
  };
}

function presentPayment(store, payment) {
  const order = store.orders.find((item) => item.id === payment.orderId);

  return {
    ...payment,
    orderNumber: order?.orderNumber || null,
    orderStatus: order?.status || null,
    buyerName: buyerName(store, payment.buyerId),
    commerceName: commerceName(store, payment.commerceId),
    statusLabel: PAYMENT_STATUS_LABELS[payment.status] || payment.status,
    methodLabel: PAYMENT_METHOD_LABELS[payment.method] || payment.method,
    providerLabel: PAYMENT_PROVIDER_LABELS[payment.provider] || payment.provider,
    countsAsCollected: paymentCountsAsCollected(payment.status),
    reconcilable: paymentIsReconcilable(payment.status),
    gatewayConnected: false,
  };
}

function presentPayout(store, payout) {
  return {
    ...payout,
    commerceName: commerceName(store, payout.commerceId),
    statusLabel: PAYOUT_STATUS_LABELS[payout.status] || payout.status,
    gatewayConnected: false,
  };
}

function summarizePayments(store) {
  const payments = store.paymentTransactions;
  const collected = payments.filter((payment) => paymentCountsAsCollected(payment.status));
  const sum = (rows, key) => roundAmount(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
  const pendingPayouts = store.paymentPayouts.filter((payout) =>
    ['pending', 'scheduled'].includes(payout.status)
  );

  return {
    totalPayments: payments.length,
    pendingPayments: payments.filter((payment) => payment.status === 'pending').length,
    authorizedPayments: payments.filter((payment) => payment.status === 'authorized').length,
    failedPayments: payments.filter((payment) => payment.status === 'failed').length,
    refundedPayments: payments.filter((payment) =>
      ['refunded', 'partially_refunded'].includes(payment.status)
    ).length,
    unreconciledPayments: payments.filter(
      (payment) => paymentIsReconcilable(payment.status) && !payment.reconciled
    ).length,
    grossCollected: sum(collected, 'amount'),
    commissionRevenue: sum(collected, 'commissionAmount'),
    netToCommerces: sum(collected, 'netAmount'),
    refundedAmount: sum(collected, 'refundedAmount'),
    pendingPayouts: pendingPayouts.length,
    pendingPayoutNet: sum(pendingPayouts, 'netAmount'),
    paidPayouts: store.paymentPayouts.filter((payout) => payout.status === 'paid').length,
    totalPayouts: store.paymentPayouts.length,
    gatewayConnected: false,
  };
}

function globalSearchResults(store, term, actor) {
  const results = [];
  const matches = (values) =>
    values.filter(Boolean).some((value) => String(value).toLowerCase().includes(term));

  if (actorHas(actor, 'users.view')) {
    const viewPii = actorHas(actor, 'users.view_pii');
    store.buyers.forEach((buyer) => {
      if (!matches([buyer.name, buyer.email, buyer.phone])) return;
      results.push({
        type: 'buyer',
        typeLabel: GLOBAL_SEARCH_TYPES.buyer,
        id: buyer.id,
        title: buyer.name,
        subtitle: [viewPii ? buyer.email : maskEmail(buyer.email), buyer.status].filter(Boolean).join(' · '),
        status: buyer.status,
        path: `/compradores?q=${encodeURIComponent(buyer.name)}`,
      });
    });
  }

  if (actorHas(actor, 'commerce.view')) {
    store.commerces.forEach((commerce) => {
      if (!matches([commerce.tradeName, commerce.legalName, commerce.categoryName])) return;
      results.push({
        type: 'commerce',
        typeLabel: GLOBAL_SEARCH_TYPES.commerce,
        id: commerce.id,
        title: commerce.tradeName,
        subtitle: commerce.legalName || commerce.status,
        status: commerce.status,
        path: `/comercios?q=${encodeURIComponent(commerce.tradeName)}`,
      });
    });
  }

  if (actorHas(actor, 'requests.view')) {
    store.requests.forEach((request) => {
      if (!matches([request.title, buyerName(store, request.buyerId)])) return;
      results.push({
        type: 'request',
        typeLabel: GLOBAL_SEARCH_TYPES.request,
        id: request.id,
        title: request.title,
        subtitle: [buyerName(store, request.buyerId), request.status].filter(Boolean).join(' · '),
        status: request.status,
        path: `/solicitudes?q=${encodeURIComponent(request.title)}`,
      });
    });
  }

  if (actorHas(actor, 'offers.view')) {
    store.offers.forEach((offer) => {
      const request = store.requests.find((item) => item.id === offer.requestId);
      if (!matches([request?.title, commerceName(store, offer.commerceId)])) return;
      results.push({
        type: 'offer',
        typeLabel: GLOBAL_SEARCH_TYPES.offer,
        id: offer.id,
        title: request?.title || 'Oferta',
        subtitle: [commerceName(store, offer.commerceId), offer.status].filter(Boolean).join(' · '),
        status: offer.status,
        path: `/ofertas?q=${encodeURIComponent(commerceName(store, offer.commerceId) || '')}`,
      });
    });
  }

  if (actorHas(actor, 'orders.view')) {
    store.orders.forEach((order) => {
      if (!matches([order.orderNumber, buyerName(store, order.buyerId), commerceName(store, order.commerceId)])) {
        return;
      }
      results.push({
        type: 'order',
        typeLabel: GLOBAL_SEARCH_TYPES.order,
        id: order.id,
        title: order.orderNumber,
        subtitle: [buyerName(store, order.buyerId), commerceName(store, order.commerceId)].filter(Boolean).join(' · '),
        status: order.status,
        path: `/pedidos?q=${encodeURIComponent(order.orderNumber)}`,
      });
    });
  }

  if (actorHas(actor, 'deliveries.view')) {
    store.deliveries.forEach((delivery) => {
      const order = store.orders.find((item) => item.id === delivery.orderId);
      if (!matches([order?.orderNumber, delivery.trackingCode, delivery.carrier])) return;
      results.push({
        type: 'delivery',
        typeLabel: GLOBAL_SEARCH_TYPES.delivery,
        id: delivery.id,
        title: order?.orderNumber || 'Entrega',
        subtitle: [delivery.carrier, delivery.trackingCode, delivery.status].filter(Boolean).join(' · '),
        status: delivery.status,
        path: `/entregas?q=${encodeURIComponent(order?.orderNumber || delivery.trackingCode || '')}`,
      });
    });
  }

  if (actorHas(actor, 'chats.view_metadata')) {
    store.chats.forEach((chat) => {
      // Solo metadatos: nunca se indexa el cuerpo de los mensajes.
      if (!matches([chat.subject, chat.orderId, buyerName(store, chat.buyerId), commerceName(store, chat.commerceId)])) {
        return;
      }
      results.push({
        type: 'chat',
        typeLabel: GLOBAL_SEARCH_TYPES.chat,
        id: chat.id,
        title: chat.subject,
        subtitle: [buyerName(store, chat.buyerId), commerceName(store, chat.commerceId), chat.status]
          .filter(Boolean)
          .join(' · '),
        status: chat.status,
        path: `/chats?q=${encodeURIComponent(chat.subject)}`,
      });
    });
  }

  if (actorHas(actor, 'support.view')) {
    store.supportTickets.forEach((ticket) => {
      if (!matches([ticket.ticketNumber, ticket.subject, ticket.requesterName])) return;
      results.push({
        type: 'ticket',
        typeLabel: GLOBAL_SEARCH_TYPES.ticket,
        id: ticket.id,
        title: `${ticket.ticketNumber} · ${ticket.subject}`,
        subtitle: [ticket.requesterName, ticket.status].filter(Boolean).join(' · '),
        status: ticket.status,
        path: `/soporte?q=${encodeURIComponent(ticket.ticketNumber)}`,
      });
    });
  }

  return results;
}

export const demoRepository = {
  mode: 'demo',

  async login({ email, password }) {
    const store = readStore();
    const member = findMemberByEmail(store, email);

    if (!member || password !== DEMO_PASSWORD) {
      throw new Error('Correo o contraseña incorrectos.');
    }

    if (member.status !== 'active') {
      throw new Error('Esta cuenta administrativa no está activa.');
    }

    member.lastLoginAt = nowIso();
    appendAudit(store, {
      actorId: member.id,
      actorName: member.name,
      actorRole: member.roleKey,
      action: 'auth.login',
      module: 'Autenticación',
      entityType: 'admin_member',
      entityId: member.id,
      metadata: { result: 'success', mode: 'demo' },
    });
    saveStore(store);

    try {
      localStorage.setItem(SESSION_KEY, member.id);
    } catch {
      // La sesión sigue en memoria durante esta pestaña.
    }

    return toSession(member);
  },

  async getSession() {
    let memberId = null;
    try {
      memberId = localStorage.getItem(SESSION_KEY);
    } catch {
      memberId = null;
    }
    if (!memberId) return null;

    const store = readStore();
    const member = store.members.find((item) => item.id === memberId);
    if (!member || member.status !== 'active') return null;
    return toSession(member);
  },

  async logout() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Sin almacenamiento no hay nada que limpiar.
    }
  },

  async listMembers() {
    const store = readStore();
    return store.members.map((member) => ({
      id: member.id,
      email: member.email,
      name: member.name,
      roleKey: member.roleKey,
      roleName: ROLE_BY_KEY[member.roleKey]?.name || member.roleKey,
      status: member.status,
      createdAt: member.createdAt,
      lastLoginAt: member.lastLoginAt,
      permissionsCount: getPermissionsForRole(member.roleKey).length,
    }));
  },

  async listInvitations() {
    const store = readStore();
    return [...store.invitations];
  },

  async inviteMember({ email, name, roleKey, actor }) {
    const store = readStore();
    const normalized = email.trim().toLowerCase();

    if (!normalized.includes('@')) {
      throw new Error('Introduce un correo válido.');
    }
    if (!ROLE_BY_KEY[roleKey]) {
      throw new Error('El rol seleccionado no existe.');
    }
    if (findMemberByEmail(store, normalized)) {
      throw new Error('Ya existe un miembro con ese correo.');
    }
    if (store.invitations.some((invitation) => invitation.email.toLowerCase() === normalized && invitation.status === 'pending')) {
      throw new Error('Ya hay una invitación pendiente para ese correo.');
    }

    const invitation = {
      id: makeId(),
      email: normalized,
      name: name.trim() || normalized,
      roleKey,
      status: 'pending',
      createdAt: nowIso(),
      invitedByName: actor?.name || 'Sistema',
    };

    store.invitations = [invitation, ...store.invitations];
    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'staff.invite',
      module: 'Personal',
      entityType: 'admin_invitation',
      entityId: invitation.id,
      reason: 'Invitación de personal administrativo',
      metadata: { email: invitation.email, roleKey },
    });
    saveStore(store);

    return invitation;
  },

  async setMemberStatus({ memberId, status, reason, actor }) {
    const store = readStore();
    const member = store.members.find((item) => item.id === memberId);

    if (!member) throw new Error('El miembro no existe.');
    if (!['active', 'suspended'].includes(status)) throw new Error('Estado no válido.');
    if (actor?.memberId === memberId) throw new Error('No puedes cambiar el estado de tu propia cuenta.');

    if (status === 'suspended' && member.roleKey === 'superadmin') {
      const activeSuperadmins = store.members.filter(
        (item) => item.roleKey === 'superadmin' && item.status === 'active'
      );
      if (activeSuperadmins.length <= 1) {
        throw new Error('No se puede suspender al último superadministrador activo.');
      }
    }

    if (!reason || !reason.trim()) {
      throw new Error('Debes indicar un motivo.');
    }

    member.status = status;
    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: status === 'suspended' ? 'staff.suspend' : 'staff.reactivate',
      module: 'Personal',
      entityType: 'admin_member',
      entityId: member.id,
      reason: reason.trim(),
      metadata: { previousStatus: status === 'suspended' ? 'active' : 'suspended', newStatus: status, email: member.email },
    });
    saveStore(store);

    return member;
  },

  async listAudit({ search = '', module = 'all', limit = 100 } = {}) {
    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.audit
      .filter((entry) => (module === 'all' ? true : entry.module === module))
      .filter((entry) => {
        if (!term) return true;
        return [entry.action, entry.actorName, entry.entityId, entry.reason, entry.module, JSON.stringify(entry.metadata || {})]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice(0, limit);
  },

  async getMetrics({ actor } = {}) {
    const store = readStore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const canViewStaff = actorHas(actor, 'staff.view');
    const canViewAudit = actorHas(actor, 'audit.view');
    const canViewBuyers = actorHas(actor, 'users.view');
    const canViewCommerce = actorHas(actor, 'commerce.view');
    const canViewDocuments = actorHas(actor, 'commerce.documents.view');
    const canViewCatalog = actorHas(actor, 'catalog.view');
    const canViewRequests = actorHas(actor, 'requests.view');
    const canViewOffers = actorHas(actor, 'offers.view');
    const canViewOrders = actorHas(actor, 'orders.view');
    const canViewDeliveries = actorHas(actor, 'deliveries.view');
    const canViewPayments = actorHas(actor, 'payments.view');

    const activeMembers = store.members.filter((member) => member.status === 'active').length;
    const suspendedMembers = store.members.filter((member) => member.status === 'suspended').length;
    const pendingInvitations = store.invitations.filter((invitation) => invitation.status === 'pending').length;
    const auditToday = store.audit.filter((entry) => new Date(entry.createdAt) >= today).length;

    const activeBuyers = store.buyers.filter((buyer) => buyer.status === 'active').length;
    const suspendedBuyers = store.buyers.filter((buyer) => buyer.status === 'suspended').length;
    const blockedBuyers = store.buyers.filter((buyer) => buyer.status === 'blocked').length;

    const pendingCommerces = store.commerces.filter((commerce) => commerce.status === 'pending').length;
    const inReviewCommerces = store.commerces.filter((commerce) => commerce.status === 'in_review').length;
    const approvedCommerces = store.commerces.filter((commerce) => commerce.status === 'approved').length;
    const suspendedCommerces = store.commerces.filter((commerce) => commerce.status === 'suspended').length;

    const documentSummary = summarizeDocuments(store.commerceDocuments);
    const activeCategories = store.categories.filter((category) => category.status === 'active').length;
    const inactiveCategories = store.categories.filter((category) => category.status === 'inactive').length;

    const openRequests = store.requests.filter((request) => request.status === 'open').length;
    const hiddenRequests = store.requests.filter((request) => request.status === 'hidden').length;
    const expiredRequests = store.requests.filter((request) => request.status === 'expired').length;
    const closedRequests = store.requests.filter((request) => request.status === 'closed').length;
    const activeOffers = store.offers.filter((offer) => offer.status === 'active').length;
    const flaggedOffers = store.offers.filter((offer) => offer.status === 'flagged').length;
    const withdrawnOffers = store.offers.filter(
      (offer) => offer.status === 'withdrawn' || offer.status === 'withdrawn_admin'
    ).length;

    const pendingOrders = store.orders.filter((order) => order.status === 'pending').length;
    const inProgressOrders = store.orders.filter((order) =>
      ['confirmed', 'preparing', 'shipped'].includes(order.status)
    ).length;
    const disputedOrders = store.orders.filter((order) => order.status === 'disputed').length;
    const completedOrders = store.orders.filter((order) => order.status === 'completed').length;
    const cancelledOrders = store.orders.filter((order) => order.status === 'cancelled').length;

    const pendingDeliveries = store.deliveries.filter((delivery) =>
      ['pending', 'preparing'].includes(delivery.status)
    ).length;
    const inTransitDeliveries = store.deliveries.filter((delivery) =>
      ['shipped', 'in_transit'].includes(delivery.status)
    ).length;
    const failedDeliveries = store.deliveries.filter((delivery) => delivery.status === 'failed').length;
    const deliveredDeliveries = store.deliveries.filter(
      (delivery) => delivery.status === 'delivered'
    ).length;
    const openIncidents = store.deliveryIncidents.filter(
      (incident) => incident.status === 'open'
    ).length;

    const canViewChats = actorHas(actor, 'chats.view_metadata');
    const canGrantChatAccess = actorHas(actor, 'chats.grant_access');
    const canViewModeration = actorHas(actor, 'moderation.view');
    const canViewReviews = actorHas(actor, 'reviews.view');
    const canViewSupport = actorHas(actor, 'support.view');
    const canViewCommunications = actorHas(actor, 'communications.view');

    const flaggedChats = store.chats.filter((chat) => chat.status === 'flagged').length;
    const pendingChatAccessRequests = store.chatAccessRequests.filter(
      (request) => chatAccessEffectiveStatus(request) === 'pending'
    ).length;

    const openModerationReports = store.moderationReports.filter(
      (report) => report.status === 'open'
    ).length;
    const inReviewModerationReports = store.moderationReports.filter(
      (report) => report.status === 'in_review'
    ).length;

    const publishedReviews = store.reviews.filter((review) => review.status === 'published').length;
    const hiddenReviews = store.reviews.filter((review) => review.status === 'hidden').length;
    const flaggedReviews = store.reviews.filter((review) => review.status === 'flagged').length;

    const openSupportTickets = store.supportTickets.filter(
      (ticket) => ticket.status === 'open'
    ).length;
    const inProgressSupportTickets = store.supportTickets.filter(
      (ticket) => ticket.status === 'in_progress'
    ).length;
    const overdueSupportTickets = store.supportTickets.filter(
      (ticket) =>
        ['open', 'in_progress', 'waiting_user'].includes(ticket.status) &&
        Boolean(ticket.dueAt) &&
        new Date(ticket.dueAt).getTime() < Date.now()
    ).length;

    const activeTemplates = store.communicationTemplates.filter(
      (template) => template.status === 'active'
    ).length;
    const queuedCampaigns = store.communicationCampaigns.filter(
      (campaign) => campaign.status === 'queued'
    ).length;

    const paymentSummary = summarizePayments(store);

    const attention = [
      ...(canViewStaff && pendingInvitations > 0
        ? [{
            id: 'invitations',
            label: `${pendingInvitations} invitación(es) pendiente(s) de aceptación`,
            tone: 'warning',
            path: '/personal',
          }]
        : []),
      ...(canViewStaff && suspendedMembers > 0
        ? [{
            id: 'suspended',
            label: `${suspendedMembers} cuenta(s) administrativa(s) suspendida(s)`,
            tone: 'neutral',
            path: '/personal',
          }]
        : []),
      ...(canViewCommerce && pendingCommerces > 0
        ? [{
            id: 'pendingCommerces',
            label: `${pendingCommerces} comercio(s) pendiente(s) de verificación`,
            tone: 'warning',
            path: '/comercios',
          }]
        : []),
      ...(canViewCommerce && inReviewCommerces > 0
        ? [{
            id: 'inReviewCommerces',
            label: `${inReviewCommerces} comercio(s) en revisión`,
            tone: 'info',
            path: '/comercios',
          }]
        : []),
      ...(canViewDocuments && documentSummary.rejected > 0
        ? [{
            id: 'rejectedDocuments',
            label: `${documentSummary.rejected} documento(s) rechazado(s) por corregir`,
            tone: 'warning',
            path: '/comercios',
          }]
        : []),
      ...(canViewBuyers && blockedBuyers > 0
        ? [{
            id: 'blockedBuyers',
            label: `${blockedBuyers} comprador(es) bloqueado(s)`,
            tone: 'neutral',
            path: '/compradores',
          }]
        : []),
      ...(canViewRequests && hiddenRequests > 0
        ? [{
            id: 'hiddenRequests',
            label: `${hiddenRequests} solicitud(es) oculta(s) por moderación`,
            tone: 'warning',
            path: '/solicitudes',
          }]
        : []),
      ...(canViewOffers && flaggedOffers > 0
        ? [{
            id: 'flaggedOffers',
            label: `${flaggedOffers} oferta(s) marcada(s) como irregular(es)`,
            tone: 'warning',
            path: '/ofertas',
          }]
        : []),
      ...(canViewOrders && disputedOrders > 0
        ? [{
            id: 'disputedOrders',
            label: `${disputedOrders} pedido(s) en disputa`,
            tone: 'danger',
            path: '/pedidos',
          }]
        : []),
      ...(canViewDeliveries && failedDeliveries > 0
        ? [{
            id: 'failedDeliveries',
            label: `${failedDeliveries} entrega(s) con fallo de reparto`,
            tone: 'danger',
            path: '/entregas',
          }]
        : []),
      ...(canViewDeliveries && openIncidents > 0
        ? [{
            id: 'openIncidents',
            label: `${openIncidents} incidencia(s) de entrega sin resolver`,
            tone: 'warning',
            path: '/entregas',
          }]
        : []),
      ...(canGrantChatAccess && pendingChatAccessRequests > 0
        ? [{
            id: 'pendingChatAccess',
            label: `${pendingChatAccessRequests} solicitud(es) de acceso a chats pendiente(s)`,
            tone: 'warning',
            path: '/chats',
          }]
        : []),
      ...(canViewChats && flaggedChats > 0
        ? [{
            id: 'flaggedChats',
            label: `${flaggedChats} conversación(es) marcada(s) por moderación`,
            tone: 'warning',
            path: '/chats',
          }]
        : []),
      ...(canViewModeration && openModerationReports > 0
        ? [{
            id: 'openModerationReports',
            label: `${openModerationReports} reporte(s) de moderación sin asignar`,
            tone: 'danger',
            path: '/moderacion',
          }]
        : []),
      ...(canViewModeration && inReviewModerationReports > 0
        ? [{
            id: 'inReviewModerationReports',
            label: `${inReviewModerationReports} reporte(s) de moderación en revisión`,
            tone: 'info',
            path: '/moderacion',
          }]
        : []),
      ...(canViewReviews && flaggedReviews > 0
        ? [{
            id: 'flaggedReviews',
            label: `${flaggedReviews} reseña(s) marcada(s) para revisión`,
            tone: 'warning',
            path: '/resenas',
          }]
        : []),
      ...(canViewSupport && overdueSupportTickets > 0
        ? [{
            id: 'overdueSupportTickets',
            label: `${overdueSupportTickets} ticket(s) de soporte fuera de plazo`,
            tone: 'danger',
            path: '/soporte',
          }]
        : []),
      ...(canViewSupport && openSupportTickets > 0
        ? [{
            id: 'openSupportTickets',
            label: `${openSupportTickets} ticket(s) de soporte sin asignar`,
            tone: 'warning',
            path: '/soporte',
          }]
        : []),
      ...(canViewCommunications && queuedCampaigns > 0
        ? [{
            id: 'queuedCampaigns',
            label: `${queuedCampaigns} campaña(s) en cola simulada sin proveedor de envío`,
            tone: 'neutral',
            path: '/comunicaciones',
          }]
        : []),
      ...(canViewPayments && paymentSummary.unreconciledPayments > 0
        ? [{
            id: 'unreconciledPayments',
            label: `${paymentSummary.unreconciledPayments} pago(s) sin conciliar`,
            tone: 'warning',
            path: '/pagos',
          }]
        : []),
      ...(canViewPayments && paymentSummary.pendingPayouts > 0
        ? [{
            id: 'pendingPayouts',
            label: `${paymentSummary.pendingPayouts} liquidación(es) simulada(s) pendiente(s)`,
            tone: 'neutral',
            path: '/pagos',
          }]
        : []),
    ];

    return {
      activeMembers: canViewStaff ? activeMembers : 0,
      suspendedMembers: canViewStaff ? suspendedMembers : 0,
      pendingInvitations: canViewStaff ? pendingInvitations : 0,
      auditToday: canViewAudit ? auditToday : 0,
      totalMembers: canViewStaff ? store.members.length : 0,
      activeBuyers: canViewBuyers ? activeBuyers : 0,
      suspendedBuyers: canViewBuyers ? suspendedBuyers : 0,
      blockedBuyers: canViewBuyers ? blockedBuyers : 0,
      totalBuyers: canViewBuyers ? store.buyers.length : 0,
      pendingCommerces: canViewCommerce ? pendingCommerces : 0,
      inReviewCommerces: canViewCommerce ? inReviewCommerces : 0,
      approvedCommerces: canViewCommerce ? approvedCommerces : 0,
      suspendedCommerces: canViewCommerce ? suspendedCommerces : 0,
      totalCommerces: canViewCommerce ? store.commerces.length : 0,
      activeCategories: canViewCatalog ? activeCategories : 0,
      inactiveCategories: canViewCatalog ? inactiveCategories : 0,
      totalCategories: canViewCatalog ? store.categories.length : 0,
      pendingDocuments: canViewDocuments ? documentSummary.pending : 0,
      verifiedDocuments: canViewDocuments ? documentSummary.verified : 0,
      rejectedDocuments: canViewDocuments ? documentSummary.rejected : 0,
      totalDocuments: canViewDocuments ? documentSummary.total : 0,
      openRequests: canViewRequests ? openRequests : 0,
      hiddenRequests: canViewRequests ? hiddenRequests : 0,
      expiredRequests: canViewRequests ? expiredRequests : 0,
      closedRequests: canViewRequests ? closedRequests : 0,
      totalRequests: canViewRequests ? store.requests.length : 0,
      activeOffers: canViewOffers ? activeOffers : 0,
      flaggedOffers: canViewOffers ? flaggedOffers : 0,
      withdrawnOffers: canViewOffers ? withdrawnOffers : 0,
      totalOffers: canViewOffers ? store.offers.length : 0,
      pendingOrders: canViewOrders ? pendingOrders : 0,
      inProgressOrders: canViewOrders ? inProgressOrders : 0,
      disputedOrders: canViewOrders ? disputedOrders : 0,
      completedOrders: canViewOrders ? completedOrders : 0,
      cancelledOrders: canViewOrders ? cancelledOrders : 0,
      totalOrders: canViewOrders ? store.orders.length : 0,
      pendingDeliveries: canViewDeliveries ? pendingDeliveries : 0,
      inTransitDeliveries: canViewDeliveries ? inTransitDeliveries : 0,
      failedDeliveries: canViewDeliveries ? failedDeliveries : 0,
      deliveredDeliveries: canViewDeliveries ? deliveredDeliveries : 0,
      openIncidents: canViewDeliveries ? openIncidents : 0,
      totalDeliveries: canViewDeliveries ? store.deliveries.length : 0,
      flaggedChats: canViewChats ? flaggedChats : 0,
      pendingChatAccessRequests: canGrantChatAccess ? pendingChatAccessRequests : 0,
      totalChats: canViewChats ? store.chats.length : 0,
      openModerationReports: canViewModeration ? openModerationReports : 0,
      inReviewModerationReports: canViewModeration ? inReviewModerationReports : 0,
      totalModerationReports: canViewModeration ? store.moderationReports.length : 0,
      publishedReviews: canViewReviews ? publishedReviews : 0,
      hiddenReviews: canViewReviews ? hiddenReviews : 0,
      flaggedReviews: canViewReviews ? flaggedReviews : 0,
      totalReviews: canViewReviews ? store.reviews.length : 0,
      openSupportTickets: canViewSupport ? openSupportTickets : 0,
      inProgressSupportTickets: canViewSupport ? inProgressSupportTickets : 0,
      overdueSupportTickets: canViewSupport ? overdueSupportTickets : 0,
      totalSupportTickets: canViewSupport ? store.supportTickets.length : 0,
      activeTemplates: canViewCommunications ? activeTemplates : 0,
      queuedCampaigns: canViewCommunications ? queuedCampaigns : 0,
      totalTemplates: canViewCommunications ? store.communicationTemplates.length : 0,
      totalCampaigns: canViewCommunications ? store.communicationCampaigns.length : 0,
      totalPayments: canViewPayments ? paymentSummary.totalPayments : 0,
      pendingPayments: canViewPayments ? paymentSummary.pendingPayments : 0,
      unreconciledPayments: canViewPayments ? paymentSummary.unreconciledPayments : 0,
      grossCollected: canViewPayments ? paymentSummary.grossCollected : 0,
      commissionRevenue: canViewPayments ? paymentSummary.commissionRevenue : 0,
      refundedAmount: canViewPayments ? paymentSummary.refundedAmount : 0,
      pendingPayouts: canViewPayments ? paymentSummary.pendingPayouts : 0,
      totalPayouts: canViewPayments ? paymentSummary.totalPayouts : 0,
      paymentGatewayConnected: false,
      recentAudit: canViewAudit ? store.audit.slice(0, 6) : [],
      attention,
    };
  },

  // ---------------------------------------------------------------------------
  // Compradores
  // ---------------------------------------------------------------------------
  async listBuyers({ search = '', status = 'all', actor } = {}) {
    requirePermission(actor, 'users.view', 'No tienes permiso para ver compradores.');

    const store = readStore();
    const term = search.trim().toLowerCase();
    const viewPii = actorHas(actor, 'users.view_pii');

    return store.buyers
      .filter((buyer) => (status === 'all' ? true : buyer.status === status))
      .filter((buyer) => {
        if (!term) return true;
        return [buyer.name, buyer.email, buyer.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((buyer) => presentBuyer(buyer, viewPii));
  },

  async setBuyerStatus({ buyerId, status, reason, reasonCode = null, actor }) {
    const store = readStore();
    const buyer = store.buyers.find((item) => item.id === buyerId);
    if (!buyer) throw new Error('El comprador no existe.');

    const transitions = {
      active: ['suspended', 'blocked'],
      limited: ['active', 'suspended', 'blocked'],
      suspended: ['active', 'blocked'],
      blocked: ['active'],
    };

    if (!transitions[buyer.status]?.includes(status)) {
      throw new Error('Transición de estado no permitida para este comprador.');
    }

    const usesBlockPermission =
      status === 'blocked' || (buyer.status === 'blocked' && status === 'active');
    requirePermission(
      actor,
      usesBlockPermission ? 'users.block' : 'users.suspend',
      usesBlockPermission
        ? 'No tienes permiso para bloquear compradores.'
        : 'No tienes permiso para suspender o reactivar compradores.'
    );
    requireReason(reason);

    const previousStatus = buyer.status;
    buyer.status = status;
    buyer.statusReason = reason.trim();
    buyer.statusChangedAt = nowIso();

    let action = 'buyer.reactivate';
    if (status === 'suspended') action = 'buyer.suspend';
    if (status === 'blocked') action = 'buyer.block';
    if (buyer.status === 'active' && previousStatus === 'blocked') action = 'buyer.unblock';

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action,
      module: 'Compradores',
      entityType: 'buyer_profile',
      entityId: buyer.id,
      reason: reason.trim(),
      metadata: { previousStatus, newStatus: status, reasonCode },
    });
    saveStore(store);

    return presentBuyer(buyer, actorHas(actor, 'users.view_pii'));
  },

  // ---------------------------------------------------------------------------
  // Comercios y documentos
  // ---------------------------------------------------------------------------
  async listCommerces({ search = '', status = 'all', actor } = {}) {
    requirePermission(actor, 'commerce.view', 'No tienes permiso para ver comercios.');

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.commerces
      .filter((commerce) => (status === 'all' ? true : commerce.status === status))
      .filter((commerce) => {
        if (!term) return true;
        const category = store.categories.find((item) => item.id === commerce.categoryId);
        return [
          commerce.tradeName,
          commerce.legalName,
          commerce.taxId,
          commerce.contactName,
          commerce.email,
          commerce.city,
          category?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
      .map((commerce) => {
        const category = store.categories.find((item) => item.id === commerce.categoryId);
        const documents = store.commerceDocuments.filter(
          (document) => document.commerceId === commerce.id
        );
        return {
          ...commerce,
          categoryName: category?.name || null,
          documentSummary: summarizeDocuments(documents),
        };
      });
  },

  async getCommerce({ commerceId, actor }) {
    requirePermission(actor, 'commerce.view', 'No tienes permiso para ver comercios.');

    const store = readStore();
    const commerce = store.commerces.find((item) => item.id === commerceId);
    if (!commerce) throw new Error('El comercio no existe.');

    const category = store.categories.find((item) => item.id === commerce.categoryId);
    const documents = store.commerceDocuments.filter(
      (document) => document.commerceId === commerce.id
    );
    const canViewDocuments = actorHas(actor, 'commerce.documents.view');

    return {
      ...commerce,
      categoryName: category?.name || null,
      documentSummary: summarizeDocuments(documents),
      documentsRestricted: !canViewDocuments,
      documents: canViewDocuments
        ? documents.map((document) => {
            const { storagePath, ...metadata } = document;
            return {
              ...metadata,
              typeLabel: documentTypeLabel(document.type),
              hasFile: Boolean(storagePath),
            };
          })
        : [],
    };
  },

  async reviewCommerceDocument({ documentId, status, reason, reasonCode = null, actor }) {
    requirePermission(
      actor,
      'commerce.approve',
      'No tienes permiso para revisar documentos de comercios.'
    );

    if (!['verified', 'rejected'].includes(status)) {
      throw new Error('Estado de documento no válido.');
    }
    requireReason(reason);

    const store = readStore();
    const document = store.commerceDocuments.find((item) => item.id === documentId);
    if (!document) throw new Error('El documento no existe.');

    const previousStatus = document.status;
    document.status = status;
    document.reviewReason = reason.trim();
    document.reviewedAt = nowIso();
    document.reviewedByName = actor?.name || 'Sistema';

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: status === 'verified' ? 'commerce.document.verify' : 'commerce.document.reject',
      module: 'Comercios',
      entityType: 'commerce_document',
      entityId: document.id,
      reason: reason.trim(),
      metadata: {
        previousStatus,
        newStatus: status,
        reasonCode,
        documentType: document.type,
        commerceId: document.commerceId,
      },
    });
    saveStore(store);

    const { storagePath, ...metadata } = document;
    return {
      ...metadata,
      typeLabel: documentTypeLabel(document.type),
      hasFile: Boolean(storagePath),
    };
  },

  async setCommerceStatus({ commerceId, status, reason, reasonCode = null, actor }) {
    const store = readStore();
    const commerce = store.commerces.find((item) => item.id === commerceId);
    if (!commerce) throw new Error('El comercio no existe.');

    const allowed = COMMERCE_TRANSITIONS[commerce.status] || [];
    if (!allowed.includes(status)) {
      throw new Error('Transición de estado no permitida para este comercio.');
    }

    const permissionKey =
      status === 'rejected'
        ? 'commerce.reject'
        : status === 'suspended'
          ? 'commerce.suspend'
          : 'commerce.approve';

    requirePermission(
      actor,
      permissionKey,
      status === 'rejected'
        ? 'No tienes permiso para rechazar comercios.'
        : status === 'suspended'
          ? 'No tienes permiso para suspender comercios.'
          : 'No tienes permiso para aprobar o revisar comercios.'
    );
    requireReason(reason);

    const previousStatus = commerce.status;
    commerce.status = status;
    commerce.statusReason = reason.trim();

    if (['approved', 'rejected'].includes(status)) {
      commerce.reviewedAt = nowIso();
      commerce.reviewedByName = actor?.name || 'Sistema';
    }
    if (status === 'in_review' && !commerce.submittedAt) {
      commerce.submittedAt = nowIso();
    }

    let action = 'commerce.suspend';
    if (status === 'in_review') action = 'commerce.review';
    if (status === 'approved') {
      action = previousStatus === 'suspended' ? 'commerce.reactivate' : 'commerce.approve';
    }
    if (status === 'rejected') action = 'commerce.reject';

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action,
      module: 'Comercios',
      entityType: 'commerce_profile',
      entityId: commerce.id,
      reason: reason.trim(),
      metadata: { previousStatus, newStatus: status, reasonCode },
    });
    saveStore(store);

    const category = store.categories.find((item) => item.id === commerce.categoryId);
    const documents = store.commerceDocuments.filter(
      (document) => document.commerceId === commerce.id
    );

    return {
      ...commerce,
      categoryName: category?.name || null,
      documentSummary: summarizeDocuments(documents),
    };
  },

  async getDocumentSignedUrl() {
    throw new Error(
      'Los documentos de demostración no tienen archivo real. Conecta InsForge y configura el bucket privado para previsualizarlos.'
    );
  },

  // ---------------------------------------------------------------------------
  // Categorías
  // ---------------------------------------------------------------------------
  async listCategories({ search = '', status = 'all', actor } = {}) {
    requirePermission(actor, 'catalog.view', 'No tienes permiso para ver categorías.');

    const store = readStore();
    const term = search.trim().toLowerCase();
    const decorated = store.categories.map((category) => decorateCategory(store, category));

    const matches = decorated.filter((category) => {
      if (status !== 'all' && category.status !== status) return false;
      if (!term) return true;
      return [category.name, category.slug, category.description, category.parentName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });

    // Incluye la categoría padre como contexto cuando coincide una subcategoría.
    const visibleIds = new Set(matches.map((category) => category.id));
    matches.forEach((category) => {
      if (category.parentId) visibleIds.add(category.parentId);
    });

    const visible = decorated.filter((category) => visibleIds.has(category.id));
    const parents = visible
      .filter((category) => !category.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    const ordered = [];
    parents.forEach((parent) => {
      ordered.push(parent);
      visible
        .filter((category) => category.parentId === parent.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .forEach((child) => ordered.push(child));
    });

    // Categorías huérfanas (padre no incluido por el filtro).
    visible
      .filter((category) => category.parentId && !visibleIds.has(category.parentId))
      .forEach((category) => ordered.push(category));

    return ordered;
  },

  async createCategory({ name, parentId = null, description = '', sortOrder = 0, actor }) {
    requirePermission(actor, 'catalog.create', 'No tienes permiso para crear categorías.');

    const store = readStore();
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('El nombre de la categoría es obligatorio.');

    const slug = slugify(cleanName);
    if (!slug) throw new Error('El nombre de la categoría no es válido.');
    if (store.categories.some((category) => category.slug === slug)) {
      throw new Error('Ya existe una categoría con ese nombre.');
    }

    let parent = null;
    if (parentId) {
      parent = store.categories.find((category) => category.id === parentId);
      if (!parent) throw new Error('La categoría padre no existe.');
      if (parent.parentId) {
        throw new Error('Solo se permiten dos niveles: una subcategoría no puede tener hijas.');
      }
    }

    const category = {
      id: makeId(),
      name: cleanName,
      slug,
      parentId: parent?.id || null,
      description: String(description || '').trim(),
      sortOrder: Number(sortOrder) || 0,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    store.categories = [category, ...store.categories];
    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'catalog.create',
      module: 'Categorías',
      entityType: 'commerce_category',
      entityId: category.id,
      reason: 'Alta de categoría',
      metadata: { name: category.name, slug, parentId: category.parentId },
    });
    saveStore(store);

    return decorateCategory(store, category);
  },

  async updateCategory({
    categoryId,
    name,
    parentId = null,
    description = '',
    sortOrder = 0,
    actor,
  }) {
    requirePermission(actor, 'catalog.update', 'No tienes permiso para editar categorías.');

    const store = readStore();
    const category = store.categories.find((item) => item.id === categoryId);
    if (!category) throw new Error('La categoría no existe.');

    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('El nombre de la categoría es obligatorio.');

    const slug = slugify(cleanName);
    if (!slug) throw new Error('El nombre de la categoría no es válido.');
    if (store.categories.some((item) => item.id !== categoryId && item.slug === slug)) {
      throw new Error('Ya existe otra categoría con ese nombre.');
    }

    if (parentId === categoryId) {
      throw new Error('Una categoría no puede ser su propia categoría padre.');
    }

    let parent = null;
    if (parentId) {
      parent = store.categories.find((item) => item.id === parentId);
      if (!parent) throw new Error('La categoría padre no existe.');
      if (parent.parentId) {
        throw new Error('Solo se permiten dos niveles: una subcategoría no puede tener hijas.');
      }
    }

    const hasChildren = store.categories.some((item) => item.parentId === category.id);
    if (hasChildren && (parent?.id || null) !== (category.parentId || null)) {
      throw new Error('No puedes mover una categoría que tiene subcategorías.');
    }

    const previous = { name: category.name, parentId: category.parentId };
    category.name = cleanName;
    category.slug = slug;
    category.parentId = parent?.id || null;
    category.description = String(description || '').trim();
    category.sortOrder = Number(sortOrder) || 0;
    category.updatedAt = nowIso();

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'catalog.update',
      module: 'Categorías',
      entityType: 'commerce_category',
      entityId: category.id,
      reason: 'Edición de categoría',
      metadata: { previous, next: { name: cleanName, parentId: category.parentId } },
    });
    saveStore(store);

    return decorateCategory(store, category);
  },

  async setCategoryStatus({ categoryId, status, reason, reasonCode = null, actor }) {
    requirePermission(
      actor,
      'catalog.deactivate',
      'No tienes permiso para activar o desactivar categorías.'
    );

    if (!['active', 'inactive'].includes(status)) {
      throw new Error('Estado de categoría no válido.');
    }
    requireReason(reason);

    const store = readStore();
    const category = store.categories.find((item) => item.id === categoryId);
    if (!category) throw new Error('La categoría no existe.');

    if (status === 'inactive') {
      const activeChildren = store.categories.filter(
        (item) => item.parentId === category.id && item.status === 'active'
      );
      if (activeChildren.length) {
        throw new Error('Desactiva primero las subcategorías activas.');
      }
    }

    const previousStatus = category.status;
    category.status = status;
    category.updatedAt = nowIso();

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: status === 'inactive' ? 'catalog.deactivate' : 'catalog.activate',
      module: 'Categorías',
      entityType: 'commerce_category',
      entityId: category.id,
      reason: reason.trim(),
      metadata: { previousStatus, newStatus: status, reasonCode },
    });
    saveStore(store);

    return decorateCategory(store, category);
  },

  // ---------------------------------------------------------------------------
  // Solicitudes de compra
  // ---------------------------------------------------------------------------
  async listRequests({ search = '', status = 'all', actor } = {}) {
    requirePermission(actor, 'requests.view', 'No tienes permiso para ver solicitudes.');

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.requests
      .filter((request) => (status === 'all' ? true : request.status === status))
      .filter((request) => {
        if (!term) return true;
        const decorated = decorateRequest(store, request);
        return [decorated.title, decorated.description, decorated.buyerName, decorated.categoryName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((request) => decorateRequest(store, request));
  },

  async getRequest({ requestId, actor }) {
    requirePermission(actor, 'requests.view', 'No tienes permiso para ver solicitudes.');

    const store = readStore();
    const request = store.requests.find((item) => item.id === requestId);
    if (!request) throw new Error('La solicitud no existe.');

    const canViewOffers = actorHas(actor, 'offers.view');

    return {
      ...decorateRequest(store, request),
      offersRestricted: !canViewOffers,
      offers: canViewOffers
        ? store.offers
            .filter((offer) => offer.requestId === request.id)
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((offer) => decorateOffer(store, offer))
        : [],
    };
  },

  async setRequestStatus({ requestId, status, reason, reasonCode = null, actor }) {
    const store = readStore();
    const request = store.requests.find((item) => item.id === requestId);
    if (!request) throw new Error('La solicitud no existe.');

    const allowed = REQUEST_TRANSITIONS[request.status] || [];
    if (!allowed.includes(status)) {
      throw new Error('Transición de estado no permitida para esta solicitud.');
    }

    const actionKey = requestActionKey(request.status, status);
    const messages = {
      hide: 'No tienes permiso para ocultar solicitudes.',
      restore: 'No tienes permiso para restaurar solicitudes.',
      close: 'No tienes permiso para cerrar solicitudes.',
      cancel: 'No tienes permiso para cancelar solicitudes.',
    };

    requirePermission(actor, requestActionPermission(status), messages[actionKey]);
    requireReason(reason);

    const previousStatus = request.status;
    request.status = status;
    request.statusReason = String(reason).trim();
    request.updatedAt = nowIso();
    if (status === 'closed' || status === 'cancelled') {
      request.closedAt = request.updatedAt;
    }

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: `request.${actionKey}`,
      module: 'Solicitudes',
      entityType: 'purchase_request',
      entityId: request.id,
      reason: String(reason).trim(),
      metadata: { previousStatus, newStatus: status, reasonCode },
    });
    saveStore(store);

    return decorateRequest(store, request);
  },

  // ---------------------------------------------------------------------------
  // Ofertas
  // ---------------------------------------------------------------------------
  async listOffers({ search = '', status = 'all', requestId = null, actor } = {}) {
    requirePermission(actor, 'offers.view', 'No tienes permiso para ver ofertas.');

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.offers
      .filter((offer) => (status === 'all' ? true : offer.status === status))
      .filter((offer) => (requestId ? offer.requestId === requestId : true))
      .filter((offer) => {
        if (!term) return true;
        const decorated = decorateOffer(store, offer);
        return [
          decorated.requestTitle,
          decorated.buyerName,
          decorated.commerceName,
          decorated.conditions,
          decorated.statusReason,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((offer) => decorateOffer(store, offer));
  },

  async getOffer({ offerId, actor }) {
    requirePermission(actor, 'offers.view', 'No tienes permiso para ver ofertas.');

    const store = readStore();
    const offer = store.offers.find((item) => item.id === offerId);
    if (!offer) throw new Error('La oferta no existe.');

    const request = store.requests.find((item) => item.id === offer.requestId);

    return {
      ...decorateOffer(store, offer),
      requestStatus: request?.status || null,
      requestDescription: request?.description || null,
    };
  },

  async setOfferStatus({ offerId, status, reason, reasonCode = null, actor }) {
    const store = readStore();
    const offer = store.offers.find((item) => item.id === offerId);
    if (!offer) throw new Error('La oferta no existe.');

    const allowed = OFFER_TRANSITIONS[offer.status] || [];
    if (!allowed.includes(status)) {
      throw new Error('Transición de estado no permitida para esta oferta.');
    }

    const actionKey = offerActionKey(offer.status, status);
    const messages = {
      flag: 'No tienes permiso para marcar ofertas.',
      unflag: 'No tienes permiso para retirar marcas de ofertas.',
      withdraw_admin: 'No tienes permiso para retirar ofertas.',
    };

    requirePermission(actor, offerActionPermission(status), messages[actionKey]);
    requireReason(reason);

    const previousStatus = offer.status;
    const now = nowIso();
    offer.status = status;
    offer.statusReason = String(reason).trim();
    offer.updatedAt = now;

    if (status === 'flagged') {
      offer.flaggedReason = String(reason).trim();
      offer.flaggedAt = now;
      offer.flaggedByName = actor?.name || 'Sistema';
    }
    if (status === 'active') {
      offer.flaggedReason = null;
      offer.flaggedAt = null;
      offer.flaggedByName = null;
    }
    if (status === 'withdrawn_admin') {
      offer.withdrawnAt = now;
    }

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: `offer.${actionKey}`,
      module: 'Ofertas',
      entityType: 'purchase_offer',
      entityId: offer.id,
      reason: String(reason).trim(),
      metadata: { previousStatus, newStatus: status, reasonCode, requestId: offer.requestId },
    });
    saveStore(store);

    return decorateOffer(store, offer);
  },

  // ---------------------------------------------------------------------------
  // Pedidos
  // ---------------------------------------------------------------------------
  async listOrders({ search = '', status = 'all', actor } = {}) {
    requirePermission(actor, 'orders.view', 'No tienes permiso para ver pedidos.');

    const store = readStore();
    const term = search.trim().toLowerCase();
    const canViewDeliveries = actorHas(actor, 'deliveries.view');

    return store.orders
      .filter((order) => (status === 'all' ? true : order.status === status))
      .filter((order) => {
        if (!term) return true;
        return [
          order.orderNumber,
          order.snapshot?.requestTitle,
          order.snapshot?.commerceTradeName,
          buyerName(store, order.buyerId),
          commerceName(store, order.commerceId),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((order) => decorateOrder(store, order, { canViewDeliveries }));
  },

  async getOrder({ orderId, actor }) {
    requirePermission(actor, 'orders.view', 'No tienes permiso para ver pedidos.');

    const store = readStore();
    const order = store.orders.find((item) => item.id === orderId);
    if (!order) throw new Error('El pedido no existe.');

    return decorateOrder(store, order, {
      details: true,
      canViewDeliveries: actorHas(actor, 'deliveries.view'),
    });
  },

  async transitionOrder({
    orderId,
    status,
    reason,
    reasonCode = null,
    resolution = null,
    actor,
  }) {
    const store = readStore();
    const order = store.orders.find((item) => item.id === orderId);
    if (!order) throw new Error('El pedido no existe.');

    applyOrderTransition(store, order, { status, reason, reasonCode, resolution, actor });
    saveStore(store);

    return decorateOrder(store, order, {
      details: true,
      canViewDeliveries: actorHas(actor, 'deliveries.view'),
    });
  },

  // ---------------------------------------------------------------------------
  // Entregas
  // ---------------------------------------------------------------------------
  async listDeliveries({ search = '', status = 'all', actor } = {}) {
    requirePermission(actor, 'deliveries.view', 'No tienes permiso para ver entregas.');

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.deliveries
      .filter((delivery) => (status === 'all' ? true : delivery.status === status))
      .filter((delivery) => {
        if (!term) return true;
        const decorated = decorateDelivery(store, delivery);
        return [
          decorated.orderNumber,
          decorated.buyerName,
          decorated.commerceName,
          decorated.carrier,
          decorated.trackingCode,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((delivery) => decorateDelivery(store, delivery));
  },

  async getDelivery({ deliveryId, actor }) {
    requirePermission(actor, 'deliveries.view', 'No tienes permiso para ver entregas.');

    const store = readStore();
    const delivery = store.deliveries.find((item) => item.id === deliveryId);
    if (!delivery) throw new Error('La entrega no existe.');

    return decorateDelivery(store, delivery, { details: true });
  },

  async updateDelivery({
    deliveryId,
    status,
    reason,
    reasonCode = null,
    carrier,
    trackingCode,
    estimatedAt,
    actor,
  }) {
    const store = readStore();
    const delivery = store.deliveries.find((item) => item.id === deliveryId);
    if (!delivery) throw new Error('La entrega no existe.');

    applyDeliveryTransition(store, delivery, {
      status,
      reason,
      reasonCode,
      actor,
      carrier,
      trackingCode,
      estimatedAt,
    });
    saveStore(store);

    return decorateDelivery(store, delivery, { details: true });
  },

  async confirmDelivery({ deliveryId, reason, reasonCode = 'received', actor }) {
    const store = readStore();
    const delivery = store.deliveries.find((item) => item.id === deliveryId);
    if (!delivery) throw new Error('La entrega no existe.');

    applyDeliveryTransition(store, delivery, {
      status: 'delivered',
      reason,
      reasonCode,
      actor,
    });
    saveStore(store);

    return decorateDelivery(store, delivery, { details: true });
  },

  async reportDeliveryIncident({ deliveryId, incidentType, description, actor }) {
    requirePermission(
      actor,
      'deliveries.update',
      'No tienes permiso para registrar incidencias de entrega.'
    );

    if (!DELIVERY_INCIDENT_TYPES.some((type) => type.value === incidentType)) {
      throw new Error('Tipo de incidencia no válido.');
    }
    requireReason(description);

    const store = readStore();
    const delivery = store.deliveries.find((item) => item.id === deliveryId);
    if (!delivery) throw new Error('La entrega no existe.');

    const incident = {
      id: makeId(),
      deliveryId: delivery.id,
      incidentType,
      description: String(description).trim(),
      status: 'open',
      reportedByName: actor?.name || 'Sistema',
      reportedAt: nowIso(),
      resolvedAt: null,
      resolvedByName: null,
      resolutionReason: null,
    };

    store.deliveryIncidents = [incident, ...store.deliveryIncidents];

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'delivery.incident',
      module: 'Entregas',
      entityType: 'order_delivery',
      entityId: delivery.id,
      reason: incident.description,
      metadata: { incidentType, incidentId: incident.id, orderId: delivery.orderId },
    });
    saveStore(store);

    return decorateDelivery(store, delivery, { details: true });
  },

  async resolveDeliveryIncident({ incidentId, resolutionReason, actor }) {
    requirePermission(
      actor,
      'deliveries.update',
      'No tienes permiso para resolver incidencias de entrega.'
    );
    requireReason(resolutionReason);

    const store = readStore();
    const incident = store.deliveryIncidents.find((item) => item.id === incidentId);
    if (!incident) throw new Error('La incidencia no existe.');
    if (incident.status === 'resolved') throw new Error('La incidencia ya está resuelta.');

    incident.status = 'resolved';
    incident.resolutionReason = String(resolutionReason).trim();
    incident.resolvedAt = nowIso();
    incident.resolvedByName = actor?.name || 'Sistema';

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'delivery.incident.resolve',
      module: 'Entregas',
      entityType: 'delivery_incident',
      entityId: incident.id,
      reason: String(resolutionReason).trim(),
      metadata: { deliveryId: incident.deliveryId, incidentType: incident.incidentType },
    });
    saveStore(store);

    return presentIncident(incident);
  },

  // ---------------------------------------------------------------------------
  // Chats
  // ---------------------------------------------------------------------------
  async listChats({ search = '', status = 'all', actor } = {}) {
    requirePermission(actor, 'chats.view_metadata', 'No tienes permiso para ver chats.');

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.chats
      .filter((chat) => (status === 'all' ? true : chat.status === status))
      .filter((chat) => {
        if (!term) return true;
        const decorated = decorateChat(store, chat, actor);
        return [decorated.subject, decorated.buyerName, decorated.commerceName, decorated.orderNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      .map((chat) => decorateChat(store, chat, actor));
  },

  async getChat({ chatId, actor }) {
    requirePermission(actor, 'chats.view_metadata', 'No tienes permiso para ver chats.');

    const store = readStore();
    const chat = store.chats.find((item) => item.id === chatId);
    if (!chat) throw new Error('La conversación no existe.');

    const canGrant = actorHas(actor, 'chats.grant_access');
    const accessRequests = store.chatAccessRequests
      .filter((request) => request.chatId === chatId)
      .filter((request) => canGrant || request.requestedById === actor?.memberId)
      .slice()
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
      .map(presentChatAccess);

    return {
      ...decorateChat(store, chat, actor),
      accessRequests,
      accessRequestsRestricted: !canGrant,
      canGrantAccess: canGrant,
    };
  },

  async requestChatAccess({ chatId, reason, reasonCode = 'other', actor }) {
    requirePermission(
      actor,
      'chats.request_access',
      'No tienes permiso para solicitar acceso al contenido de chats.'
    );
    requireReason(reason);

    const store = readStore();
    const chat = store.chats.find((item) => item.id === chatId);
    if (!chat) throw new Error('La conversación no existe.');

    const existing = store.chatAccessRequests.find(
      (request) =>
        request.chatId === chatId &&
        request.requestedById === actor?.memberId &&
        ['pending', 'approved'].includes(chatAccessEffectiveStatus(request))
    );
    if (existing) {
      throw new Error('Ya tienes una solicitud pendiente o aprobada para esta conversación.');
    }

    const request = {
      id: makeId(),
      chatId,
      requestedById: actor?.memberId || null,
      requestedByName: actor?.name || 'Sistema',
      requestedByRole: actor?.roleKey || null,
      reason: String(reason).trim(),
      reasonCode,
      status: 'pending',
      requestedAt: nowIso(),
      reviewedById: null,
      reviewedByName: null,
      reviewedAt: null,
      reviewReason: null,
      reviewReasonCode: null,
      expiresAt: null,
      revokedAt: null,
    };

    store.chatAccessRequests = [request, ...store.chatAccessRequests];

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'chat.access.request',
      module: 'Chats',
      entityType: 'chat_access_request',
      entityId: request.id,
      reason: request.reason,
      metadata: { chatId, reasonCode },
    });
    saveStore(store);

    return presentChatAccess(request);
  },

  async decideChatAccess({
    accessRequestId,
    decision,
    reason,
    reasonCode = null,
    expiresInHours = CHAT_ACCESS_DEFAULT_HOURS,
    actor,
  }) {
    requirePermission(
      actor,
      'chats.grant_access',
      'No tienes permiso para aprobar, denegar o revocar accesos a chats.'
    );

    if (!['approved', 'denied', 'revoked'].includes(decision)) {
      throw new Error('Decisión de acceso no válida.');
    }
    requireReason(reason);

    const store = readStore();
    const request = store.chatAccessRequests.find((item) => item.id === accessRequestId);
    if (!request) throw new Error('La solicitud de acceso no existe.');

    const allowed = CHAT_ACCESS_TRANSITIONS[request.status] || [];
    if (!allowed.includes(decision)) {
      throw new Error('Transición de acceso no permitida para esta solicitud.');
    }

    const now = nowIso();
    request.status = decision;
    request.reviewedById = actor?.memberId || null;
    request.reviewedByName = actor?.name || 'Sistema';
    request.reviewedAt = now;
    request.reviewReason = String(reason).trim();
    request.reviewReasonCode = reasonCode;

    if (decision === 'approved') {
      const hours = Math.min(Math.max(Number(expiresInHours) || CHAT_ACCESS_DEFAULT_HOURS, 1), 168);
      request.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }
    if (decision === 'revoked') {
      request.revokedAt = now;
    }

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: `chat.access.${decision}`,
      module: 'Chats',
      entityType: 'chat_access_request',
      entityId: request.id,
      reason: request.reviewReason,
      metadata: {
        decision,
        chatId: request.chatId,
        requestedById: request.requestedById,
        reasonCode,
        expiresAt: request.expiresAt,
      },
    });
    saveStore(store);

    return presentChatAccess(request);
  },

  async readChatContent({ chatId, actor }) {
    requirePermission(
      actor,
      'chats.access_content',
      'No tienes permiso para leer el contenido de chats.'
    );

    const store = readStore();
    const chat = store.chats.find((item) => item.id === chatId);
    if (!chat) throw new Error('La conversación no existe.');

    const access = activeChatAccess(store, chatId, actor);
    if (!access) {
      throw new Error(
        'No tienes una autorización de acceso aprobada y vigente para esta conversación. Solicítala y espera la aprobación.'
      );
    }

    const messages = (Array.isArray(chat.messages) ? chat.messages : [])
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Toda lectura de contenido queda auditada, incluso si no hay mensajes.
    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'chat.content.read',
      module: 'Chats',
      entityType: 'chat_thread',
      entityId: chat.id,
      reason: access.reason,
      metadata: {
        accessRequestId: access.id,
        messageCount: messages.length,
        expiresAt: access.expiresAt,
        result: 'granted',
      },
    });
    saveStore(store);

    return {
      id: chat.id,
      subject: chat.subject,
      accessRequestId: access.id,
      accessExpiresAt: access.expiresAt,
      messages,
      simulated: true,
    };
  },

  // ---------------------------------------------------------------------------
  // Moderación
  // ---------------------------------------------------------------------------
  async listModerationReports({ search = '', status = 'all', reportType = 'all', actor } = {}) {
    requirePermission(actor, 'moderation.view', 'No tienes permiso para ver reportes de moderación.');

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.moderationReports
      .filter((report) => (status === 'all' ? true : report.status === status))
      .filter((report) => (reportType === 'all' ? true : report.reportType === reportType))
      .filter((report) => {
        if (!term) return true;
        return [report.subject, report.entityLabel, report.reporterName, report.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((report) => presentModerationReport(report, actor));
  },

  async getModerationReport({ reportId, actor }) {
    requirePermission(actor, 'moderation.view', 'No tienes permiso para ver reportes de moderación.');

    const store = readStore();
    const report = store.moderationReports.find((item) => item.id === reportId);
    if (!report) throw new Error('El reporte de moderación no existe.');

    return presentModerationReport(report, actor);
  },

  async updateModerationReport({
    reportId,
    status,
    reason,
    reasonCode = null,
    actor,
  }) {
    requirePermission(actor, 'moderation.view', 'No tienes permiso para ver reportes de moderación.');

    const store = readStore();
    const report = store.moderationReports.find((item) => item.id === reportId);
    if (!report) throw new Error('El reporte de moderación no existe.');

    const allowed = MODERATION_TRANSITIONS[report.status] || [];
    if (!allowed.includes(status)) {
      throw new Error('Transición de moderación no permitida para este reporte.');
    }

    const actionKey = moderationActionKey(report.status, status);
    const messages = {
      assign: 'No tienes permiso para asignarte reportes de moderación.',
      resolve: 'No tienes permiso para resolver reportes de moderación.',
      dismiss: 'No tienes permiso para descartar reportes de moderación.',
    };
    requirePermission(actor, moderationActionPermission(status), messages[actionKey]);
    requireReason(reason);

    const previousStatus = report.status;
    const now = nowIso();
    report.status = status;
    report.updatedAt = now;

    if (status === 'in_review') {
      report.assignedToId = actor?.memberId || null;
      report.assignedToName = actor?.name || 'Sistema';
      report.assignedAt = now;
    }

    if (status === 'resolved' || status === 'dismissed') {
      report.resolvedById = actor?.memberId || null;
      report.resolvedByName = actor?.name || 'Sistema';
      report.resolvedAt = now;
      report.resolutionReason = String(reason).trim();
      report.resolutionCode = reasonCode;
    }

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: `moderation.${actionKey}`,
      module: 'Moderación',
      entityType: 'moderation_report',
      entityId: report.id,
      reason: String(reason).trim(),
      metadata: {
        previousStatus,
        newStatus: status,
        reasonCode,
        reportType: report.reportType,
        assignedToId: report.assignedToId,
      },
    });
    saveStore(store);

    return presentModerationReport(report, actor);
  },

  // ---------------------------------------------------------------------------
  // Reseñas
  // ---------------------------------------------------------------------------
  async listReviews({ search = '', status = 'all', rating = 'all', actor } = {}) {
    requirePermission(actor, 'reviews.view', 'No tienes permiso para ver reseñas.');

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.reviews
      .filter((review) => (status === 'all' ? true : review.status === status))
      .filter((review) => (rating === 'all' ? true : Number(review.rating) === Number(rating)))
      .filter((review) => {
        if (!term) return true;
        const decorated = presentReview(store, review);
        return [decorated.comment, decorated.buyerName, decorated.commerceName, decorated.orderNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((review) => presentReview(store, review));
  },

  async getReview({ reviewId, actor }) {
    requirePermission(actor, 'reviews.view', 'No tienes permiso para ver reseñas.');

    const store = readStore();
    const review = store.reviews.find((item) => item.id === reviewId);
    if (!review) throw new Error('La reseña no existe.');

    return presentReview(store, review);
  },

  async setReviewStatus({ reviewId, status, reason, reasonCode = null, actor }) {
    requirePermission(actor, reviewActionPermission(), 'No tienes permiso para moderar reseñas.');

    const store = readStore();
    const review = store.reviews.find((item) => item.id === reviewId);
    if (!review) throw new Error('La reseña no existe.');

    const allowed = REVIEW_TRANSITIONS[review.status] || [];
    if (!allowed.includes(status)) {
      throw new Error('Transición de reseña no permitida.');
    }
    requireReason(reason);

    const actionKey = reviewActionKey(review.status, status);
    const previousStatus = review.status;
    const now = nowIso();

    review.status = status;
    review.statusReason = String(reason).trim();
    review.moderatedById = actor?.memberId || null;
    review.moderatedByName = actor?.name || 'Sistema';
    review.moderatedAt = now;

    if (status === 'published' && !review.publishedAt) {
      review.publishedAt = now;
    }

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: `review.${actionKey}`,
      module: 'Reseñas',
      entityType: 'commerce_review',
      entityId: review.id,
      reason: review.statusReason,
      metadata: {
        previousStatus,
        newStatus: status,
        reasonCode,
        rating: review.rating,
        commerceId: review.commerceId,
      },
    });
    saveStore(store);

    return presentReview(store, review);
  },

  // ---------------------------------------------------------------------------
  // Soporte
  // ---------------------------------------------------------------------------
  async listSupportTickets({ search = '', status = 'all', priority = 'all', actor } = {}) {
    requirePermission(actor, 'support.view', 'No tienes permiso para ver tickets de soporte.');

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.supportTickets
      .filter((ticket) => (status === 'all' ? true : ticket.status === status))
      .filter((ticket) => (priority === 'all' ? true : ticket.priority === priority))
      .filter((ticket) => {
        if (!term) return true;
        return [ticket.ticketNumber, ticket.subject, ticket.requesterName, ticket.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((ticket) => presentSupportTicket(store, ticket));
  },

  async getSupportTicket({ ticketId, actor }) {
    requirePermission(actor, 'support.view', 'No tienes permiso para ver tickets de soporte.');

    const store = readStore();
    const ticket = store.supportTickets.find((item) => item.id === ticketId);
    if (!ticket) throw new Error('El ticket de soporte no existe.');

    return presentSupportTicket(store, ticket, { details: true });
  },

  async assignSupportTicket({ ticketId, reason = 'Asignación manual', actor }) {
    requirePermission(actor, 'support.assign', 'No tienes permiso para asignar tickets de soporte.');
    requireReason(reason);

    const store = readStore();
    const ticket = store.supportTickets.find((item) => item.id === ticketId);
    if (!ticket) throw new Error('El ticket de soporte no existe.');
    if (ticket.status === 'closed') {
      throw new Error('No se puede asignar un ticket cerrado. Reábrelo primero.');
    }

    const previousAssigneeId = ticket.assignedToId;
    ticket.assignedToId = actor?.memberId || null;
    ticket.assignedToName = actor?.name || 'Sistema';
    ticket.assignedAt = nowIso();
    ticket.updatedAt = ticket.assignedAt;

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'support.assign',
      module: 'Soporte',
      entityType: 'support_ticket',
      entityId: ticket.id,
      reason: String(reason).trim(),
      metadata: {
        previousAssigneeId,
        assignedToId: ticket.assignedToId,
        status: ticket.status,
      },
    });
    saveStore(store);

    return presentSupportTicket(store, ticket, { details: true });
  },

  async updateSupportStatus({ ticketId, status, reason, reasonCode = null, actor }) {
    const store = readStore();
    const ticket = store.supportTickets.find((item) => item.id === ticketId);
    if (!ticket) throw new Error('El ticket de soporte no existe.');

    const allowed = SUPPORT_TRANSITIONS[ticket.status] || [];
    if (!allowed.includes(status)) {
      throw new Error('Transición de soporte no permitida para este ticket.');
    }

    const actionKey = supportActionKey(ticket.status, status);
    const messages = {
      'support.resolve': 'No tienes permiso para resolver tickets de soporte.',
      'support.close': 'No tienes permiso para cerrar tickets de soporte.',
      'support.reopen': 'No tienes permiso para reabrir tickets de soporte.',
      'support.status': 'No tienes permiso para actualizar el estado de tickets de soporte.',
    };
    requirePermission(actor, supportStatusPermission(status), messages[actionKey]);
    requireReason(reason);

    const previousStatus = ticket.status;
    const now = nowIso();
    ticket.status = status;
    ticket.statusReason = String(reason).trim();
    ticket.updatedAt = now;

    if (status === 'open') {
      ticket.resolvedAt = null;
      ticket.closedAt = null;
      ticket.dueAt = new Date(
        Date.now() + (SUPPORT_SLA_HOURS[ticket.priority] || 24) * 60 * 60 * 1000
      ).toISOString();
    }
    if (status === 'resolved') {
      ticket.resolvedAt = now;
    }
    if (status === 'closed') {
      ticket.closedAt = now;
    }

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: actionKey,
      module: 'Soporte',
      entityType: 'support_ticket',
      entityId: ticket.id,
      reason: ticket.statusReason,
      metadata: {
        previousStatus,
        newStatus: status,
        reasonCode,
        assignedToId: ticket.assignedToId,
      },
    });
    saveStore(store);

    return presentSupportTicket(store, ticket, { details: true });
  },

  async replySupportTicket({ ticketId, body, internal = false, actor }) {
    requirePermission(actor, 'support.reply', 'No tienes permiso para responder tickets de soporte.');
    requireReason(body);

    const store = readStore();
    const ticket = store.supportTickets.find((item) => item.id === ticketId);
    if (!ticket) throw new Error('El ticket de soporte no existe.');
    if (ticket.status === 'closed') {
      throw new Error('El ticket está cerrado. Reábrelo antes de responder.');
    }

    const previousStatus = ticket.status;
    const now = nowIso();
    const message = {
      id: makeId(),
      ticketId: ticket.id,
      authorType: 'support',
      authorName: actor?.name || 'Sistema',
      body: String(body).trim(),
      internal: Boolean(internal),
      createdAt: now,
    };

    ticket.messages = [...(Array.isArray(ticket.messages) ? ticket.messages : []), message];
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    ticket.updatedAt = now;

    if (!ticket.assignedToId) {
      ticket.assignedToId = actor?.memberId || null;
      ticket.assignedToName = actor?.name || 'Sistema';
      ticket.assignedAt = now;
    }

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'support.reply',
      module: 'Soporte',
      entityType: 'support_ticket',
      entityId: ticket.id,
      reason: internal ? 'Nota interna añadida' : 'Respuesta pública enviada',
      metadata: {
        internal: Boolean(internal),
        messageId: message.id,
        previousStatus,
        newStatus: ticket.status,
      },
    });
    saveStore(store);

    return presentSupportTicket(store, ticket, { details: true });
  },

  // ---------------------------------------------------------------------------
  // Comunicaciones
  // ---------------------------------------------------------------------------
  async listCommunicationTemplates({ search = '', status = 'all', actor } = {}) {
    requirePermission(
      actor,
      'communications.view',
      'No tienes permiso para ver plantillas de comunicación.'
    );

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.communicationTemplates
      .filter((template) => (status === 'all' ? true : template.status === status))
      .filter((template) => {
        if (!term) return true;
        return [template.name, template.subject, template.body, template.segmentLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(presentCommunicationTemplate);
  },

  async setCommunicationTemplateStatus({
    templateId,
    status,
    reason,
    reasonCode = null,
    actor,
  }) {
    requirePermission(
      actor,
      'communications.template',
      'No tienes permiso para cambiar el estado de plantillas.'
    );

    const store = readStore();
    const template = store.communicationTemplates.find((item) => item.id === templateId);
    if (!template) throw new Error('La plantilla no existe.');

    const allowed = COMMUNICATION_TEMPLATE_TRANSITIONS[template.status] || [];
    if (!allowed.includes(status)) {
      throw new Error('Transición de plantilla no permitida.');
    }
    requireReason(reason);

    const previousStatus = template.status;
    template.status = status;
    template.updatedAt = nowIso();

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: `communications.template.${status}`,
      module: 'Comunicaciones',
      entityType: 'communication_template',
      entityId: template.id,
      reason: String(reason).trim(),
      metadata: { previousStatus, newStatus: status, reasonCode, segment: template.segment },
    });
    saveStore(store);

    return presentCommunicationTemplate(template);
  },

  async listCommunicationCampaigns({ search = '', status = 'all', actor } = {}) {
    requirePermission(
      actor,
      'communications.view',
      'No tienes permiso para ver campañas de comunicación.'
    );

    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.communicationCampaigns
      .filter((campaign) => (status === 'all' ? true : campaign.status === status))
      .filter((campaign) => {
        if (!term) return true;
        const decorated = presentCampaign(store, campaign);
        return [decorated.name, decorated.templateName, decorated.segmentLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((campaign) => presentCampaign(store, campaign));
  },

  async createCommunicationCampaign({ name, templateId, segment, scheduledAt = null, actor }) {
    const permission = campaignPermission(segment);
    requirePermission(actor, permission, 'No tienes permiso para crear esta campaña.');
    requireReason(name);

    const store = readStore();
    const template = store.communicationTemplates.find((item) => item.id === templateId);
    if (!template) throw new Error('La plantilla seleccionada no existe.');
    if (template.status !== 'active') {
      throw new Error('Solo se pueden usar plantillas activas en una campaña.');
    }

    const campaign = {
      id: makeId(),
      name: String(name).trim(),
      templateId,
      segment,
      status: 'draft',
      audienceCount: segmentAudienceCount(store, segment),
      createdByName: actor?.name || 'Sistema',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      scheduledAt: scheduledAt || null,
      queuedAt: null,
      sentAt: null,
      cancelledAt: null,
      simulated: true,
      providerStatus: 'draft',
      statusReason: null,
    };

    store.communicationCampaigns = [campaign, ...store.communicationCampaigns];

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'communications.campaign.create',
      module: 'Comunicaciones',
      entityType: 'communication_campaign',
      entityId: campaign.id,
      reason: 'Campaña creada en modo demostración',
      metadata: {
        templateId,
        segment,
        audienceCount: campaign.audienceCount,
        simulated: true,
      },
    });
    saveStore(store);

    return presentCampaign(store, campaign);
  },

  async setCampaignStatus({ campaignId, status, reason, reasonCode = null, actor }) {
    const store = readStore();
    const campaign = store.communicationCampaigns.find((item) => item.id === campaignId);
    if (!campaign) throw new Error('La campaña no existe.');

    const allowed = CAMPAIGN_TRANSITIONS[campaign.status] || [];
    if (!allowed.includes(status)) {
      throw new Error('Transición de campaña no permitida.');
    }

    const permission = campaignPermission(campaign.segment);
    requirePermission(
      actor,
      permission,
      permission === 'communications.broadcast'
        ? 'No tienes permiso para enviar comunicaciones a audiencias amplias.'
        : 'No tienes permiso para enviar esta comunicación.'
    );
    requireReason(reason);

    const previousStatus = campaign.status;
    const actionKey = campaignActionKey(campaign.status, status);
    const now = nowIso();

    campaign.status = status;
    campaign.statusReason = String(reason).trim();
    campaign.updatedAt = now;

    // En modo demostración nunca hay entrega real: solo se registra el estado.
    if (status === 'queued') {
      campaign.queuedAt = now;
      campaign.simulated = true;
      campaign.providerStatus = 'demo_pending';
      campaign.statusReason =
        'En cola simulada: no existe proveedor de correo conectado en esta demostración';
    }
    if (status === 'sent') {
      campaign.sentAt = now;
      campaign.simulated = true;
      campaign.providerStatus = 'demo_simulated';
      campaign.statusReason =
        'Marcada como enviada en la simulación; no se entregó ningún mensaje real';
    }
    if (status === 'cancelled') {
      campaign.cancelledAt = now;
    }
    if (status === 'failed') {
      campaign.providerStatus = 'failed';
    }

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: `communications.campaign.${actionKey}`,
      module: 'Comunicaciones',
      entityType: 'communication_campaign',
      entityId: campaign.id,
      reason: campaign.statusReason,
      metadata: {
        previousStatus,
        newStatus: status,
        reasonCode,
        simulated: true,
        providerStatus: campaign.providerStatus,
        audienceCount: campaign.audienceCount,
        segment: campaign.segment,
      },
    });
    saveStore(store);

    return presentCampaign(store, campaign);
  },

  async getDeliveryEvidenceSignedUrl() {
    throw new Error(
      'Las evidencias de demostración son solo metadatos: no existe archivo ni bucket. Conecta InsForge y configura el almacenamiento privado para previsualizarlas.'
    );
  },

  // ---------------------------------------------------------------------------
  // Analítica (Fase 5)
  // ---------------------------------------------------------------------------
  async getAnalytics({ range = DEFAULT_ANALYTICS_RANGE, actor } = {}) {
    requirePermission(actor, 'analytics.view', 'No tienes permiso para ver la analítica.');
    const store = readStore();
    return buildAnalytics(store, analyticsRangeDays(range));
  },

  async exportAnalytics({ range = DEFAULT_ANALYTICS_RANGE, actor } = {}) {
    requirePermission(actor, 'analytics.export', 'No tienes permiso para exportar analítica.');

    const store = readStore();
    const days = analyticsRangeDays(range);
    const analytics = buildAnalytics(store, days);
    const period = `${analytics.periodStart.slice(0, 10)} a ${analytics.periodEnd.slice(0, 10)}`;
    const rows = [];

    const summaryRows = [
      ['GMV cobrado', analytics.summary.gmv],
      ['Comisión estimada', analytics.summary.commissionRevenue],
      ['Neto a comercios', analytics.summary.netToCommerces],
      ['Reembolsos registrados', analytics.summary.refundedAmount],
      ['Volumen de pedidos', analytics.summary.orderVolume],
      ['Ticket promedio', analytics.summary.averageOrderValue],
      ['Pedidos', analytics.summary.orders],
      ['Pagos registrados', analytics.summary.payments],
      ['Pagos cobrados', analytics.summary.collectedPayments],
      ['Pedidos completados', analytics.summary.completedOrders],
      ['Pedidos en disputa', analytics.summary.disputedOrders],
      ['Pedidos cancelados', analytics.summary.cancelledOrders],
      ['Pagos sin conciliar', analytics.summary.unreconciledPayments],
    ];

    summaryRows.forEach(([metric, value]) => {
      rows.push({ seccion: 'Resumen', periodo: period, comercio: '', metrica: metric, valor: value });
    });

    analytics.series.forEach((day) => {
      rows.push({ seccion: 'Serie diaria', periodo: day.date, comercio: '', metrica: 'GMV cobrado', valor: day.gmv });
      rows.push({ seccion: 'Serie diaria', periodo: day.date, comercio: '', metrica: 'Pedidos', valor: day.orders });
      rows.push({ seccion: 'Serie diaria', periodo: day.date, comercio: '', metrica: 'Pagos cobrados', valor: day.payments });
    });

    analytics.topCommerces.forEach((commerce) => {
      rows.push({ seccion: 'Top comercios', periodo: period, comercio: commerce.commerceName, metrica: 'GMV cobrado', valor: commerce.gmv });
      rows.push({ seccion: 'Top comercios', periodo: period, comercio: commerce.commerceName, metrica: 'Comisión estimada', valor: commerce.commission });
      rows.push({ seccion: 'Top comercios', periodo: period, comercio: commerce.commerceName, metrica: 'Pagos cobrados', valor: commerce.payments });
    });

    const csv = buildCsv(
      [
        { key: 'seccion', label: 'seccion' },
        { key: 'periodo', label: 'periodo' },
        { key: 'comercio', label: 'comercio' },
        { key: 'metrica', label: 'metrica' },
        { key: 'valor', label: 'valor' },
      ],
      rows
    );

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'analytics.export',
      module: 'Analítica',
      entityType: 'analytics_report',
      entityId: makeId(),
      reason: 'Exportación de analítica agregada',
      metadata: {
        rangeDays: days,
        piiIncluded: false,
        rows: rows.length,
        simulated: true,
      },
    });
    saveStore(store);

    return {
      filename: `analitica-${days}d-${csvDateStamp()}.csv`,
      csv,
      generatedAt: analytics.generatedAt,
      rangeDays: days,
      rangeLabel: analytics.rangeLabel,
      notice: ANALYTICS_EXPORT_NOTICE,
    };
  },

  // ---------------------------------------------------------------------------
  // Pagos (libro interno, sin pasarela)
  // ---------------------------------------------------------------------------
  async listPayments({ search = '', status = 'all', reconciliation = 'all', actor } = {}) {
    requirePermission(actor, 'payments.view', 'No tienes permiso para ver pagos.');
    const store = readStore();
    const term = search.trim().toLowerCase();

    return store.paymentTransactions
      .map((payment) => presentPayment(store, payment))
      .filter((payment) => (status === 'all' ? true : payment.status === status))
      .filter((payment) => {
        if (reconciliation === 'all') return true;
        if (reconciliation === 'unreconciled') return payment.reconcilable && !payment.reconciled;
        return payment.reconciled;
      })
      .filter((payment) => {
        if (!term) return true;
        return [
          payment.orderNumber,
          payment.buyerName,
          payment.commerceName,
          payment.providerReference,
          payment.statusLabel,
          payment.methodLabel,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getPayment({ paymentId, actor } = {}) {
    requirePermission(actor, 'payments.view', 'No tienes permiso para ver pagos.');
    const store = readStore();
    const payment = store.paymentTransactions.find((item) => item.id === paymentId);
    if (!payment) throw new Error('El movimiento de pago no existe.');

    const order = store.orders.find((item) => item.id === payment.orderId);
    const payouts = store.paymentPayouts
      .filter((payout) => payout.commerceId === payment.commerceId)
      .map((payout) => presentPayout(store, payout))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      ...presentPayment(store, payment),
      order: order
        ? {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: order.totalAmount,
            currency: order.currency,
            placedAt: order.placedAt,
          }
        : null,
      payouts,
    };
  },

  async getPaymentMetrics({ actor } = {}) {
    requirePermission(actor, 'payments.view', 'No tienes permiso para ver pagos.');
    return summarizePayments(readStore());
  },

  async listPaymentPayouts({ status = 'all', actor } = {}) {
    requirePermission(actor, 'payments.view', 'No tienes permiso para ver pagos.');
    const store = readStore();

    return store.paymentPayouts
      .filter((payout) => (status === 'all' ? true : payout.status === status))
      .map((payout) => presentPayout(store, payout))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async reconcilePayment({
    paymentId,
    reconciled = true,
    reason,
    reasonCode = 'other',
    actor,
  } = {}) {
    requirePermission(actor, 'payments.reconcile', 'No tienes permiso para conciliar pagos.');
    const store = readStore();
    const payment = store.paymentTransactions.find((item) => item.id === paymentId);
    if (!payment) throw new Error('El movimiento de pago no existe.');

    if (!paymentIsReconcilable(payment.status)) {
      throw new Error('Solo se pueden conciliar movimientos cobrados, reembolsados o con reembolso parcial.');
    }

    requireReason(reason);

    const previousReconciled = Boolean(payment.reconciled);
    const now = nowIso();
    payment.reconciled = Boolean(reconciled);
    payment.reconciledAt = payment.reconciled ? now : null;
    payment.reconciledByName = payment.reconciled ? actor?.name || 'Sistema' : null;
    payment.updatedAt = now;

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'payment.reconcile',
      module: 'Pagos',
      entityType: 'payment_transaction',
      entityId: payment.id,
      reason: String(reason).trim(),
      metadata: {
        reconciled: payment.reconciled,
        previousReconciled,
        reasonCode,
        simulated: true,
      },
    });
    saveStore(store);

    return presentPayment(store, payment);
  },

  // ---------------------------------------------------------------------------
  // Exportación de auditoría y búsqueda global (Fase 5)
  // ---------------------------------------------------------------------------
  async exportAudit({ search = '', module = 'all', actor } = {}) {
    requirePermission(actor, 'audit.view', 'No tienes permiso para ver la auditoría.');
    requirePermission(actor, 'audit.export', 'No tienes permiso para exportar auditoría.');

    const store = readStore();
    const term = search.trim().toLowerCase();
    const entries = store.audit
      .filter((entry) => (module === 'all' ? true : entry.module === module))
      .filter((entry) => {
        if (!term) return true;
        return [
          entry.action,
          entry.actorName,
          entry.entityId,
          entry.reason,
          entry.module,
          JSON.stringify(entry.metadata || {}),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });

    const csv = buildCsv(
      [
        { key: 'fecha', label: 'fecha' },
        { key: 'actor', label: 'actor' },
        { key: 'rol', label: 'rol' },
        { key: 'accion', label: 'accion' },
        { key: 'modulo', label: 'modulo' },
        { key: 'entidad', label: 'entidad' },
        { key: 'entidadId', label: 'entidad_id' },
        { key: 'motivo', label: 'motivo' },
        { key: 'metadata', label: 'metadata' },
      ],
      entries.map((entry) => ({
        fecha: entry.createdAt,
        actor: entry.actorName || 'Sistema',
        rol: entry.actorRole || '',
        accion: entry.action,
        modulo: entry.module || '',
        entidad: entry.entityType || '',
        entidadId: entry.entityId || '',
        motivo: entry.reason || '',
        metadata: JSON.stringify(entry.metadata || {}),
      }))
    );

    appendAudit(store, {
      actorId: actor?.memberId || null,
      actorName: actor?.name || 'Sistema',
      actorRole: actor?.roleKey || null,
      action: 'audit.export',
      module: 'Auditoría',
      entityType: 'admin_audit_log',
      entityId: makeId(),
      reason: 'Exportación de auditoría',
      metadata: {
        count: entries.length,
        moduleFilter: module,
        search,
        simulated: true,
      },
    });
    saveStore(store);

    return {
      filename: `auditoria-${csvDateStamp()}.csv`,
      csv,
      count: entries.length,
      generatedAt: nowIso(),
    };
  },

  async globalSearch({ query = '', actor } = {}) {
    const text = String(query || '').trim();
    const term = text.toLowerCase();

    if (term.length < GLOBAL_SEARCH_MIN_LENGTH) {
      return {
        query: text,
        results: [],
        total: 0,
        truncated: false,
        minLength: GLOBAL_SEARCH_MIN_LENGTH,
      };
    }

    const results = globalSearchResults(readStore(), term, actor);
    return {
      query: text,
      results: results.slice(0, GLOBAL_SEARCH_LIMIT),
      total: results.length,
      truncated: results.length > GLOBAL_SEARCH_LIMIT,
      minLength: GLOBAL_SEARCH_MIN_LENGTH,
    };
  },

  roles() {
    return ROLES;
  },
};
