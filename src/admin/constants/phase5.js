// -----------------------------------------------------------------------------
// Fase 5 · Analítica y pagos
//
// Catálogos y máquinas de estado de la última fase. Igual que en las fases
// anteriores, estas reglas son una política de implementación pendiente de
// confirmación por el negocio. El servidor y la demo aplican las mismas reglas.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Analítica
// -----------------------------------------------------------------------------
export const ANALYTICS_RANGES = [
  { value: '7', label: 'Últimos 7 días', days: 7 },
  { value: '30', label: 'Últimos 30 días', days: 30 },
  { value: '90', label: 'Últimos 90 días', days: 90 },
];

export const DEFAULT_ANALYTICS_RANGE = '30';

export function analyticsRangeDays(value) {
  return ANALYTICS_RANGES.find((range) => range.value === value)?.days || 30;
}

export function analyticsRangeLabel(value) {
  return ANALYTICS_RANGES.find((range) => range.value === value)?.label || 'Últimos 30 días';
}

export const ANALYTICS_EXPORT_NOTICE =
  'La exportación de analítica contiene solo datos agregados y no incluye información personal. Cada exportación queda registrada en la auditoría.';

// -----------------------------------------------------------------------------
// Pagos
//
// No hay pasarela conectada. El módulo es de solo lectura sobre un libro de
// movimientos; la única acción permitida es la conciliación manual interna.
// -----------------------------------------------------------------------------
export const PAYMENT_STATUSES = [
  'pending',
  'authorized',
  'paid',
  'partially_refunded',
  'refunded',
  'failed',
  'cancelled',
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'authorized', label: 'Autorizado' },
  { value: 'paid', label: 'Cobrado' },
  { value: 'partially_refunded', label: 'Reembolso parcial' },
  { value: 'refunded', label: 'Reembolsado' },
  { value: 'failed', label: 'Fallido' },
  { value: 'cancelled', label: 'Cancelado' },
];

export const PAYMENT_STATUS_LABELS = PAYMENT_STATUS_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

export const PAYMENT_METHOD_LABELS = {
  card: 'Tarjeta',
  transfer: 'Transferencia',
  cash: 'Efectivo',
  wallet: 'Billetera',
  none: 'Sin definir',
};

export const PAYMENT_PROVIDER_LABELS = {
  demo: 'Simulado (demo)',
  none: 'Sin pasarela',
  stripe: 'Stripe',
  mercado_pago: 'Mercado Pago',
};

export const PAYOUT_STATUSES = ['pending', 'scheduled', 'paid', 'failed'];

export const PAYOUT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'scheduled', label: 'Programada' },
  { value: 'paid', label: 'Liquidada' },
  { value: 'failed', label: 'Fallida' },
];

export const PAYOUT_STATUS_LABELS = PAYOUT_STATUS_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

export const PAYMENT_RECONCILIATION_REASONS = [
  { value: 'statement_match', label: 'Coincide con el extracto bancario' },
  { value: 'manual_review', label: 'Revisión manual completada' },
  { value: 'correction', label: 'Corrección de registro interno' },
  { value: 'other', label: 'Otro motivo' },
];

// Comisión de referencia usada por la demo y por la estimación de liquidaciones.
// Es una política pendiente de confirmación: no es una tarifa contractual.
export const COMMISSION_RATE = 0.1;

export const PAYMENT_GATEWAY_NOTICE =
  'No hay ninguna pasarela de pagos conectada. Este módulo no mueve dinero, no emite reembolsos y no liquida fondos: solo muestra el libro interno de movimientos y permite conciliarlo manualmente.';

export const PAYMENT_SIMULATION_NOTICE =
  'Los movimientos de esta demostración son ficticios y están marcados como simulados. No representan cobros, reembolsos ni liquidaciones reales.';

export const PAYMENT_REFUND_NOTICE =
  'Emitir reembolsos requiere una pasarela conectada. Esta fase no ejecuta reembolsos; el estado del movimiento solo refleja el registro interno.';

export function paymentIsReconcilable(status) {
  return ['paid', 'partially_refunded', 'refunded'].includes(status);
}

export function paymentCountsAsCollected(status) {
  return ['paid', 'partially_refunded', 'refunded'].includes(status);
}

export const GLOBAL_SEARCH_TYPES = {
  buyer: 'Comprador',
  commerce: 'Comercio',
  request: 'Solicitud',
  offer: 'Oferta',
  order: 'Pedido',
  delivery: 'Entrega',
  chat: 'Chat',
  ticket: 'Ticket de soporte',
};

export const GLOBAL_SEARCH_MIN_LENGTH = 2;
export const GLOBAL_SEARCH_LIMIT = 20;
