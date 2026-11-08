// Catálogo de estados y motivos de la Fase 3 (operación).
//
// IMPORTANTE: las máquinas de estados de solicitudes, ofertas, pedidos y
// entregas son una POLÍTICA DE IMPLEMENTACIÓN de esta fase. No se presentan
// como reglas de negocio definitivas: deben confirmarse con el negocio antes
// de usarlas como contrato. El servidor y la demo aplican exactamente las
// mismas transiciones.

// -----------------------------------------------------------------------------
// Solicitudes de compra
// -----------------------------------------------------------------------------
export const REQUEST_STATUSES = ['open', 'hidden', 'closed', 'cancelled', 'expired'];

export const REQUEST_STATUS_OPTIONS = [
  { value: 'open', label: 'Abierta' },
  { value: 'hidden', label: 'Oculta por moderación' },
  { value: 'closed', label: 'Cerrada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Vencida' },
];

export const REQUEST_TRANSITIONS = {
  open: ['hidden', 'closed', 'cancelled'],
  hidden: ['open', 'closed', 'cancelled'],
  expired: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};

export const REQUEST_ACTION_REASONS = {
  hide: [
    { value: 'policy', label: 'Incumplimiento de normas de publicación' },
    { value: 'duplicate', label: 'Solicitud duplicada' },
    { value: 'incomplete', label: 'Información insuficiente o engañosa' },
    { value: 'security', label: 'Motivo de seguridad' },
    { value: 'other', label: 'Otro motivo' },
  ],
  restore: [
    { value: 'reviewed', label: 'Revisión completada' },
    { value: 'error', label: 'Ocultación por error' },
    { value: 'other', label: 'Otro motivo' },
  ],
  close: [
    { value: 'offer_selected', label: 'Oferta seleccionada' },
    { value: 'fulfilled', label: 'Solicitud satisfecha' },
    { value: 'owner_request', label: 'Solicitud del comprador' },
    { value: 'other', label: 'Otro motivo' },
  ],
  cancel: [
    { value: 'duplicate', label: 'Solicitud duplicada' },
    { value: 'policy', label: 'Incumplimiento de normas' },
    { value: 'fraud', label: 'Sospecha de fraude' },
    { value: 'owner_request', label: 'Solicitud del comprador' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export function requestActionKey(from, to) {
  if (to === 'hidden') return 'hide';
  if (from === 'hidden' && to === 'open') return 'restore';
  if (to === 'closed') return 'close';
  return 'cancel';
}

export function requestActionPermission(to) {
  return to === 'hidden' || to === 'open' ? 'requests.moderate' : 'requests.close';
}

export function requestActionLabel(from, to) {
  return {
    hide: 'Ocultar solicitud',
    restore: 'Restaurar solicitud',
    close: 'Cerrar solicitud',
    cancel: 'Cancelar solicitud',
  }[requestActionKey(from, to)];
}

// -----------------------------------------------------------------------------
// Ofertas
// -----------------------------------------------------------------------------
export const OFFER_STATUSES = [
  'active',
  'flagged',
  'accepted',
  'withdrawn',
  'withdrawn_admin',
  'expired',
];

export const OFFER_STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'flagged', label: 'Marcada como irregular' },
  { value: 'accepted', label: 'Aceptada' },
  { value: 'withdrawn', label: 'Retirada por el comercio' },
  { value: 'withdrawn_admin', label: 'Retirada por administración' },
  { value: 'expired', label: 'Vencida' },
];

export const OFFER_TRANSITIONS = {
  active: ['flagged', 'withdrawn_admin'],
  flagged: ['active', 'withdrawn_admin'],
  accepted: [],
  withdrawn: [],
  withdrawn_admin: [],
  expired: [],
};

export const OFFER_ACTION_REASONS = {
  flag: [
    { value: 'irregular_price', label: 'Precio o condiciones irregulares' },
    { value: 'misleading', label: 'Información engañosa' },
    { value: 'duplicate', label: 'Oferta duplicada' },
    { value: 'policy', label: 'Incumplimiento de políticas' },
    { value: 'other', label: 'Otro motivo' },
  ],
  unflag: [
    { value: 'reviewed', label: 'Revisión completada' },
    { value: 'error', label: 'Marcado por error' },
    { value: 'other', label: 'Otro motivo' },
  ],
  withdraw_admin: [
    { value: 'policy', label: 'Incumplimiento de políticas' },
    { value: 'fraud', label: 'Sospecha de fraude' },
    { value: 'request', label: 'Solicitud del comprador' },
    { value: 'error', label: 'Publicación por error' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export function offerActionKey(from, to) {
  if (to === 'withdrawn_admin') return 'withdraw_admin';
  if (to === 'flagged') return 'flag';
  return 'unflag';
}

export function offerActionPermission(to) {
  return to === 'withdrawn_admin' ? 'offers.withdraw_admin' : 'offers.flag';
}

export function offerActionLabel(from, to) {
  return {
    flag: 'Marcar irregularidad',
    unflag: 'Retirar marca',
    withdraw_admin: 'Retirar oferta',
  }[offerActionKey(from, to)];
}

// -----------------------------------------------------------------------------
// Pedidos
// -----------------------------------------------------------------------------
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'completed',
  'disputed',
  'cancelled',
];

export const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente de confirmación' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'preparing', label: 'En preparación' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'completed', label: 'Completado' },
  { value: 'disputed', label: 'En disputa' },
  { value: 'cancelled', label: 'Cancelado' },
];

export const ORDER_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled', 'disputed'],
  preparing: ['shipped', 'cancelled', 'disputed'],
  shipped: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  completed: ['disputed'],
  disputed: ['completed', 'cancelled'],
  cancelled: [],
};

export const ORDER_TRANSITION_REASONS = {
  confirmed: [
    { value: 'commerce_confirmed', label: 'Confirmado por el comercio' },
    { value: 'manual', label: 'Confirmación manual autorizada' },
    { value: 'other', label: 'Otro motivo' },
  ],
  preparing: [
    { value: 'started', label: 'Preparación iniciada' },
    { value: 'manual', label: 'Actualización manual' },
    { value: 'other', label: 'Otro motivo' },
  ],
  shipped: [
    { value: 'handed_to_carrier', label: 'Entregado al transportista' },
    { value: 'manual', label: 'Actualización manual' },
    { value: 'other', label: 'Otro motivo' },
  ],
  delivered: [
    { value: 'received', label: 'Recepción confirmada' },
    { value: 'carrier_confirmation', label: 'Confirmación del transportista' },
    { value: 'other', label: 'Otro motivo' },
  ],
  completed: [
    { value: 'fulfilled', label: 'Pedido completado correctamente' },
    { value: 'manual', label: 'Cierre manual autorizado' },
    { value: 'other', label: 'Otro motivo' },
  ],
  cancelled: [
    { value: 'out_of_stock', label: 'Sin existencias' },
    { value: 'buyer_request', label: 'Solicitud del comprador' },
    { value: 'fraud', label: 'Sospecha de fraude' },
    { value: 'policy', label: 'Incumplimiento de políticas' },
    { value: 'other', label: 'Otro motivo' },
  ],
  disputed: [
    { value: 'not_received', label: 'Pedido no recibido' },
    { value: 'damaged', label: 'Producto dañado o distinto' },
    { value: 'charge', label: 'Problema con el importe' },
    { value: 'other', label: 'Otro motivo' },
  ],
  resolve_completed: [
    { value: 'favor_commerce', label: 'Resuelta a favor del comercio' },
    { value: 'partial', label: 'Acuerdo parcial' },
    { value: 'no_fault', label: 'Sin responsabilidad de las partes' },
    { value: 'other', label: 'Otro motivo' },
  ],
  resolve_cancelled: [
    { value: 'favor_buyer', label: 'Resuelta a favor del comprador' },
    { value: 'partial', label: 'Acuerdo parcial' },
    { value: 'fraud', label: 'Fraude confirmado' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export const ORDER_DISPUTE_RESOLUTIONS = [
  { value: 'favor_buyer', label: 'A favor del comprador' },
  { value: 'favor_commerce', label: 'A favor del comercio' },
  { value: 'partial', label: 'Acuerdo parcial' },
  { value: 'no_fault', label: 'Sin responsabilidad' },
  { value: 'other', label: 'Otra resolución' },
];

export function orderTransitionPermission(from, to) {
  if (from === 'disputed') return 'orders.resolve_dispute';
  if (to === 'cancelled') return 'orders.cancel';
  return 'orders.transition';
}

export function orderTransitionReasonKey(from, to) {
  if (from === 'disputed') return to === 'cancelled' ? 'resolve_cancelled' : 'resolve_completed';
  return to;
}

export function orderTransitionLabel(from, to) {
  if (from === 'disputed') {
    return to === 'cancelled' ? 'Resolver y cancelar' : 'Resolver y completar';
  }
  return {
    confirmed: 'Confirmar pedido',
    preparing: 'Marcar en preparación',
    shipped: 'Marcar enviado',
    delivered: 'Marcar entregado',
    completed: 'Completar pedido',
    disputed: 'Abrir disputa',
    cancelled: 'Cancelar pedido',
  }[to] || to;
}

// -----------------------------------------------------------------------------
// Entregas
// -----------------------------------------------------------------------------
export const DELIVERY_STATUSES = [
  'pending',
  'preparing',
  'shipped',
  'in_transit',
  'delivered',
  'failed',
  'returned',
  'cancelled',
];

export const DELIVERY_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'preparing', label: 'En preparación' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'in_transit', label: 'En tránsito' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'failed', label: 'Entrega fallida' },
  { value: 'returned', label: 'Devuelto' },
  { value: 'cancelled', label: 'Cancelado' },
];

export const DELIVERY_TRANSITIONS = {
  pending: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['in_transit', 'delivered', 'failed'],
  in_transit: ['delivered', 'failed'],
  failed: ['in_transit', 'delivered', 'returned'],
  delivered: [],
  returned: [],
  cancelled: [],
};

export const DELIVERY_TRANSITION_REASONS = {
  preparing: [
    { value: 'started', label: 'Preparación del envío iniciada' },
    { value: 'manual', label: 'Actualización manual' },
    { value: 'other', label: 'Otro motivo' },
  ],
  shipped: [
    { value: 'handed_to_carrier', label: 'Entregado al transportista' },
    { value: 'manual', label: 'Actualización manual' },
    { value: 'other', label: 'Otro motivo' },
  ],
  in_transit: [
    { value: 'carrier_update', label: 'Actualización del transportista' },
    { value: 'retry', label: 'Nuevo intento de entrega' },
    { value: 'other', label: 'Otro motivo' },
  ],
  delivered: [
    { value: 'received', label: 'Recepción confirmada' },
    { value: 'carrier_confirmation', label: 'Confirmación del transportista' },
    { value: 'other', label: 'Otro motivo' },
  ],
  failed: [
    { value: 'not_received', label: 'Destinatario ausente' },
    { value: 'wrong_address', label: 'Dirección incorrecta' },
    { value: 'damaged', label: 'Paquete dañado' },
    { value: 'carrier_issue', label: 'Incidencia del transportista' },
    { value: 'other', label: 'Otro motivo' },
  ],
  returned: [
    { value: 'returned_to_commerce', label: 'Devuelto al comercio' },
    { value: 'lost', label: 'Pedido perdido' },
    { value: 'other', label: 'Otro motivo' },
  ],
  cancelled: [
    { value: 'order_cancelled', label: 'Pedido cancelado' },
    { value: 'duplicate', label: 'Envío duplicado' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export const DELIVERY_INCIDENT_TYPES = [
  { value: 'not_received', label: 'No recibido' },
  { value: 'damaged', label: 'Dañado o incompleto' },
  { value: 'delayed', label: 'Retraso' },
  { value: 'wrong_address', label: 'Dirección incorrecta' },
  { value: 'carrier_issue', label: 'Incidencia del transportista' },
  { value: 'other', label: 'Otra incidencia' },
];

export const DELIVERY_EVIDENCE_TYPES = [
  { value: 'delivery_photo', label: 'Foto de entrega' },
  { value: 'signature', label: 'Firma de recepción' },
  { value: 'delivery_note', label: 'Nota de entrega' },
  { value: 'other', label: 'Otra evidencia' },
];

export function deliveryTransitionPermission(to) {
  return to === 'delivered' ? 'deliveries.confirm' : 'deliveries.update';
}

export function deliveryActionLabel(to) {
  return {
    preparing: 'Preparar envío',
    shipped: 'Marcar enviado',
    in_transit: 'Marcar en tránsito',
    delivered: 'Confirmar recepción',
    failed: 'Registrar fallo',
    returned: 'Marcar devolución',
    cancelled: 'Cancelar entrega',
  }[to] || to;
}

export const DELIVERY_INCIDENT_LABELS = DELIVERY_INCIDENT_TYPES.reduce((accumulator, type) => {
  accumulator[type.value] = type.label;
  return accumulator;
}, {});

export const DELIVERY_EVIDENCE_LABELS = DELIVERY_EVIDENCE_TYPES.reduce((accumulator, type) => {
  accumulator[type.value] = type.label;
  return accumulator;
}, {});
