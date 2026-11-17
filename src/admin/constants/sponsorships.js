// Etiquetas y helpers del panel de patrocinios de clubes.
// Los estados de vigencia se calculan en servidor a partir de las fechas;
// aquí solo se traducen para la interfaz.

export const BILLING_CYCLE_LABELS = {
  monthly: 'Mensual',
  one_time: 'Pago único',
};

export const MODERATION_STATUS_LABELS = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export const LIFECYCLE_STATUS_LABELS = {
  pending: 'Pendiente',
  rejected: 'Rechazada',
  scheduled: 'Programada',
  active: 'Activa',
  expiring: 'Por vencer',
  expired: 'Expirada',
};

export const LIFECYCLE_STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  scheduled: 'bg-sky-50 text-sky-700 ring-sky-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  expiring: 'bg-orange-50 text-orange-700 ring-orange-200',
  expired: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const SPONSORSHIP_FILTERS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'active', label: 'Activas' },
  { value: 'expiring', label: 'Por vencer' },
  { value: 'expired', label: 'Expiradas' },
  { value: 'rejected', label: 'Rechazadas' },
];

export const lifecycleLabel = (status) => LIFECYCLE_STATUS_LABELS[status] || status || '—';

export const lifecycleStyle = (status) =>
  LIFECYCLE_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 ring-slate-200';

export const formatSponsorAmount = (value, currency = 'MXN') => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `$${numeric.toFixed(2)} ${currency || 'MXN'}`;
  }
};
