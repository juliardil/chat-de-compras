// Catálogo de estados, motivos y permisos de la Fase 4 (confianza y atención).
//
// IMPORTANTE: las máquinas de estados de chats, moderación, reseñas, soporte y
// comunicaciones son una POLÍTICA DE IMPLEMENTACIÓN de esta fase. No se
// presentan como reglas de negocio definitivas: deben confirmarse con el
// negocio antes de usarlas como contrato. El servidor y la demo aplican
// exactamente las mismas transiciones.
//
// Reglas transversales:
//   * El contenido de un chat solo se puede leer con una autorización aprobada,
//     vigente y solicitada por el propio actor. Toda lectura queda auditada.
//   * No existe proveedor de correo. Ningún envío de comunicaciones es real en
//     esta fase: poner en cola marca un estado simulado explícito.

const toLabelMap = (options) =>
  options.reduce((accumulator, option) => {
    accumulator[option.value] = option.label;
    return accumulator;
  }, {});

// -----------------------------------------------------------------------------
// Chats
// -----------------------------------------------------------------------------
export const CHAT_STATUSES = ['active', 'flagged', 'archived'];

export const CHAT_STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'flagged', label: 'Marcada por moderación' },
  { value: 'archived', label: 'Archivada' },
];

export const CHAT_TRANSITIONS = {
  active: ['flagged', 'archived'],
  flagged: ['active', 'archived'],
  archived: ['active'],
};

export const CHAT_ACCESS_STATUSES = ['pending', 'approved', 'denied', 'expired', 'revoked'];

export const CHAT_ACCESS_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'denied', label: 'Denegada' },
  { value: 'expired', label: 'Vencida' },
  { value: 'revoked', label: 'Revocada' },
];

export const CHAT_ACCESS_TRANSITIONS = {
  pending: ['approved', 'denied'],
  approved: ['revoked', 'expired'],
  denied: [],
  expired: [],
  revoked: [],
};

export const CHAT_ACCESS_DEFAULT_HOURS = 24;

export const CHAT_ACCESS_REASONS = {
  request: [
    { value: 'user_report', label: 'Reporte de un usuario' },
    { value: 'moderation_review', label: 'Revisión de moderación' },
    { value: 'security', label: 'Investigación de seguridad' },
    { value: 'fraud', label: 'Sospecha de fraude' },
    { value: 'other', label: 'Otro motivo' },
  ],
  approve: [
    { value: 'justified', label: 'Motivo justificado y verificado' },
    { value: 'incident', label: 'Investigación de incidente' },
    { value: 'audit', label: 'Revisión solicitada por auditoría' },
    { value: 'other', label: 'Otro motivo' },
  ],
  deny: [
    { value: 'not_justified', label: 'Sin motivo suficiente' },
    { value: 'insufficient', label: 'Información insuficiente' },
    { value: 'already_available', label: 'Ya existe otra vía de revisión' },
    { value: 'other', label: 'Otro motivo' },
  ],
  revoke: [
    { value: 'completed', label: 'Revisión completada' },
    { value: 'security', label: 'Medida de seguridad' },
    { value: 'no_longer_needed', label: 'Acceso ya no necesario' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export function chatAccessEffectiveStatus(request) {
  if (
    request?.status === 'approved' &&
    request.expiresAt &&
    new Date(request.expiresAt).getTime() <= Date.now()
  ) {
    return 'expired';
  }
  return request?.status || 'pending';
}

export function chatAccessActionLabel(decision) {
  return {
    approved: 'Aprobar acceso',
    denied: 'Denegar acceso',
    revoked: 'Revocar acceso',
  }[decision] || decision;
}

// -----------------------------------------------------------------------------
// Moderación
// -----------------------------------------------------------------------------
export const MODERATION_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'];

export const MODERATION_STATUS_OPTIONS = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'dismissed', label: 'Descartado' },
];

export const MODERATION_TRANSITIONS = {
  open: ['in_review', 'resolved', 'dismissed'],
  in_review: ['resolved', 'dismissed', 'open'],
  resolved: [],
  dismissed: [],
};

export const MODERATION_REPORT_TYPES = [
  { value: 'chat', label: 'Conversación' },
  { value: 'review', label: 'Reseña' },
  { value: 'offer', label: 'Oferta' },
  { value: 'request', label: 'Solicitud' },
  { value: 'commerce', label: 'Comercio' },
  { value: 'buyer', label: 'Comprador' },
];

export const MODERATION_REPORT_TYPE_LABELS = toLabelMap(MODERATION_REPORT_TYPES);

export const MODERATION_PRIORITIES = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export const MODERATION_PRIORITY_LABELS = toLabelMap(MODERATION_PRIORITIES);

export const MODERATION_RESOLUTION_REASONS = {
  resolved: [
    { value: 'violation', label: 'Se confirmó una infracción' },
    { value: 'action_taken', label: 'Se aplicó una medida de confianza' },
    { value: 'content_removed', label: 'Contenido retirado o corregido' },
    { value: 'other', label: 'Otro motivo' },
  ],
  dismissed: [
    { value: 'no_violation', label: 'No se encontró infracción' },
    { value: 'duplicate', label: 'Reporte duplicado' },
    { value: 'insufficient', label: 'Información insuficiente' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export const MODERATION_ACTION_REASONS = {
  assign: [
    { value: 'manual', label: 'Asignación manual para revisión' },
    { value: 'workload', label: 'Reparto de carga del equipo' },
    { value: 'specialty', label: 'Revisión especializada' },
    { value: 'other', label: 'Otro motivo' },
  ],
  resolve: MODERATION_RESOLUTION_REASONS.resolved,
  dismiss: MODERATION_RESOLUTION_REASONS.dismissed,
};

export function moderationActionKey(from, to) {
  if (to === 'in_review') return 'assign';
  if (to === 'dismissed') return 'dismiss';
  return 'resolve';
}

export function moderationActionPermission(to) {
  return to === 'in_review' ? 'moderation.assign' : 'moderation.resolve';
}

export function moderationActionLabel(from, to) {
  if (to === 'in_review') return 'Asignarme el reporte';
  if (to === 'dismissed') return 'Descartar reporte';
  return 'Resolver reporte';
}

// -----------------------------------------------------------------------------
// Reseñas
// -----------------------------------------------------------------------------
export const REVIEW_STATUSES = ['published', 'hidden', 'flagged', 'pending'];

export const REVIEW_STATUS_OPTIONS = [
  { value: 'published', label: 'Publicada' },
  { value: 'hidden', label: 'Oculta por moderación' },
  { value: 'flagged', label: 'Marcada para revisión' },
  { value: 'pending', label: 'Pendiente de publicación' },
];

export const REVIEW_TRANSITIONS = {
  published: ['hidden', 'flagged'],
  flagged: ['published', 'hidden'],
  hidden: ['published'],
  pending: ['published', 'hidden'],
};

export const REVIEW_ACTION_REASONS = {
  hide: [
    { value: 'offensive', label: 'Lenguaje ofensivo o acoso' },
    { value: 'pii', label: 'Expone datos personales' },
    { value: 'spam', label: 'Spam o contenido promocional' },
    { value: 'false', label: 'Reseña falsa o no verificable' },
    { value: 'other', label: 'Otro motivo' },
  ],
  restore: [
    { value: 'reviewed', label: 'Revisión completada' },
    { value: 'error', label: 'Ocultación por error' },
    { value: 'other', label: 'Otro motivo' },
  ],
  flag: [
    { value: 'suspicious', label: 'Contenido sospechoso' },
    { value: 'duplicate', label: 'Posible reseña duplicada' },
    { value: 'policy', label: 'Posible incumplimiento de políticas' },
    { value: 'other', label: 'Otro motivo' },
  ],
  publish: [
    { value: 'verified', label: 'Contenido verificado' },
    { value: 'manual', label: 'Publicación manual autorizada' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export function reviewActionKey(from, to) {
  if (to === 'hidden') return 'hide';
  if (to === 'flagged') return 'flag';
  if (from === 'pending') return 'publish';
  return 'restore';
}

export function reviewActionPermission() {
  return 'reviews.moderate';
}

export function reviewActionLabel(from, to) {
  return {
    hide: 'Ocultar reseña',
    restore: 'Restaurar reseña',
    flag: 'Marcar para revisión',
    publish: 'Publicar reseña',
  }[reviewActionKey(from, to)];
}

// -----------------------------------------------------------------------------
// Soporte
// -----------------------------------------------------------------------------
export const SUPPORT_STATUSES = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];

export const SUPPORT_STATUS_OPTIONS = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'waiting_user', label: 'Esperando al usuario' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
];

export const SUPPORT_TRANSITIONS = {
  open: ['in_progress', 'waiting_user', 'resolved', 'closed'],
  in_progress: ['waiting_user', 'resolved', 'closed'],
  waiting_user: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

export const SUPPORT_PRIORITIES = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export const SUPPORT_PRIORITY_LABELS = toLabelMap(SUPPORT_PRIORITIES);

export const SUPPORT_CATEGORIES = [
  { value: 'order', label: 'Pedido' },
  { value: 'delivery', label: 'Entrega' },
  { value: 'account', label: 'Cuenta' },
  { value: 'payment', label: 'Pago' },
  { value: 'other', label: 'Otra consulta' },
];

export const SUPPORT_CATEGORY_LABELS = toLabelMap(SUPPORT_CATEGORIES);

export const SUPPORT_SLA_HOURS = {
  urgent: 4,
  high: 12,
  normal: 24,
  low: 72,
};

export const SUPPORT_STATUS_REASONS = {
  open: [
    { value: 'reopen_request', label: 'Reapertura solicitada por el usuario' },
    { value: 'error', label: 'Cierre por error' },
    { value: 'other', label: 'Otro motivo' },
  ],
  in_progress: [
    { value: 'assigned', label: 'Asignado para seguimiento' },
    { value: 'investigating', label: 'Investigación en curso' },
    { value: 'other', label: 'Otro motivo' },
  ],
  waiting_user: [
    { value: 'awaiting_info', label: 'Se espera información del usuario' },
    { value: 'awaiting_evidence', label: 'Se esperan evidencias' },
    { value: 'other', label: 'Otro motivo' },
  ],
  resolved: [
    { value: 'solved', label: 'Consulta resuelta' },
    { value: 'workaround', label: 'Solución temporal acordada' },
    { value: 'other', label: 'Otro motivo' },
  ],
  closed: [
    { value: 'confirmed', label: 'Cierre confirmado por el usuario' },
    { value: 'inactive', label: 'Sin respuesta tras el plazo' },
    { value: 'duplicate', label: 'Ticket duplicado' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export function supportStatusPermission(to) {
  return to === 'resolved' || to === 'closed' ? 'support.close' : 'support.reply';
}

export function supportStatusLabel(to) {
  return {
    open: 'Reabrir ticket',
    in_progress: 'Marcar en curso',
    waiting_user: 'Esperar al usuario',
    resolved: 'Resolver ticket',
    closed: 'Cerrar ticket',
  }[to] || to;
}

export function supportActionKey(from, to) {
  if (to === 'resolved') return 'support.resolve';
  if (to === 'closed') return 'support.close';
  if ((from === 'resolved' || from === 'closed') && to === 'open') return 'support.reopen';
  return 'support.status';
}

// -----------------------------------------------------------------------------
// Comunicaciones
// -----------------------------------------------------------------------------
export const COMMUNICATION_TEMPLATE_STATUSES = ['draft', 'active', 'archived'];

export const COMMUNICATION_TEMPLATE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activa' },
  { value: 'archived', label: 'Archivada' },
];

export const COMMUNICATION_TEMPLATE_TRANSITIONS = {
  draft: ['active', 'archived'],
  active: ['archived'],
  archived: ['draft'],
};

export const COMMUNICATION_TEMPLATE_REASONS = {
  active: [
    { value: 'content_ready', label: 'Contenido revisado y listo' },
    { value: 'reuse', label: 'Reutilización de plantilla' },
    { value: 'other', label: 'Otro motivo' },
  ],
  archived: [
    { value: 'outdated', label: 'Contenido desactualizado' },
    { value: 'replaced', label: 'Sustituida por otra plantilla' },
    { value: 'other', label: 'Otro motivo' },
  ],
  draft: [
    { value: 'rework', label: 'Requiere cambios antes de usar' },
    { value: 'duplicate', label: 'Duplicado de otra plantilla' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export const COMMUNICATION_SEGMENTS = [
  { value: 'all_buyers', label: 'Todos los compradores', broadcast: true },
  { value: 'all_commerces', label: 'Todos los comercios', broadcast: true },
  { value: 'mixed', label: 'Compradores y comercios', broadcast: true },
  { value: 'active_buyers', label: 'Compradores activos', broadcast: false },
  { value: 'active_commerces', label: 'Comercios activos', broadcast: false },
  { value: 'support_contacts', label: 'Contactos con ticket reciente', broadcast: false },
];

export const COMMUNICATION_SEGMENT_LABELS = toLabelMap(COMMUNICATION_SEGMENTS);

export function campaignPermission(segment) {
  const definition = COMMUNICATION_SEGMENTS.find((item) => item.value === segment);
  return definition?.broadcast ? 'communications.broadcast' : 'communications.send';
}

export const CAMPAIGN_STATUSES = ['draft', 'queued', 'sent', 'cancelled', 'failed'];

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'queued', label: 'En cola (simulada)' },
  { value: 'sent', label: 'Marcada como enviada (simulada)' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'failed', label: 'Fallida' },
];

export const CAMPAIGN_TRANSITIONS = {
  draft: ['queued', 'cancelled'],
  queued: ['sent', 'cancelled', 'failed'],
  sent: [],
  cancelled: [],
  failed: ['draft', 'cancelled'],
};

export const CAMPAIGN_ACTION_REASONS = {
  queue: [
    { value: 'approved', label: 'Contenido y segmento aprobados' },
    { value: 'scheduled', label: 'Envío programado' },
    { value: 'other', label: 'Otro motivo' },
  ],
  cancel: [
    { value: 'content_error', label: 'Error en el contenido' },
    { value: 'wrong_segment', label: 'Segmento incorrecto' },
    { value: 'not_authorized', label: 'Envío no autorizado' },
    { value: 'other', label: 'Otro motivo' },
  ],
  send: [
    { value: 'simulated_send', label: 'Marcar como enviada en la simulación' },
    { value: 'other', label: 'Otro motivo' },
  ],
  fail: [
    { value: 'provider_error', label: 'Error del proveedor simulado' },
    { value: 'content_error', label: 'Error en el contenido' },
    { value: 'other', label: 'Otro motivo' },
  ],
  draft: [
    { value: 'rework', label: 'Devolver a borrador para cambios' },
    { value: 'other', label: 'Otro motivo' },
  ],
  change: [
    { value: 'simulated_send', label: 'Marcar como enviada en la simulación' },
    { value: 'provider_error', label: 'Error del proveedor simulado' },
    { value: 'rework', label: 'Devolver a borrador para cambios' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export function campaignActionKey(from, to) {
  if (to === 'queued') return 'queue';
  if (to === 'sent') return 'send';
  if (to === 'cancelled') return 'cancel';
  if (to === 'failed') return 'fail';
  if (to === 'draft') return 'draft';
  return 'change';
}

export function campaignActionLabel(from, to) {
  return {
    queue: 'Poner en cola (simulada)',
    send: 'Marcar como enviada (simulada)',
    cancel: 'Cancelar campaña',
    fail: 'Marcar como fallida',
    draft: 'Volver a borrador',
    change: 'Cambiar estado',
  }[campaignActionKey(from, to)];
}

export const COMMUNICATIONS_SIMULATION_NOTICE =
  'No hay proveedor de correo conectado. Poner una campaña en cola solo registra un estado simulado; no se entrega ningún mensaje real.';
