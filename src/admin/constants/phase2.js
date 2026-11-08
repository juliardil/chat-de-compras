// Catálogo de estados y tipos de la Fase 2 (personas y catálogo).
// Son valores de dominio compartidos por la demo, InsForge y la interfaz.

export const BUYER_STATUSES = ['active', 'limited', 'suspended', 'blocked'];

export const BUYER_STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'limited', label: 'Limitado' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'blocked', label: 'Bloqueado' },
];

export const COMMERCE_STATUSES = ['pending', 'in_review', 'approved', 'rejected', 'suspended'];

export const COMMERCE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'suspended', label: 'Suspendido' },
];

// Transiciones permitidas. Se validan en el repositorio demo y en el servidor.
export const COMMERCE_TRANSITIONS = {
  pending: ['in_review', 'rejected'],
  in_review: ['approved', 'rejected'],
  approved: ['suspended'],
  suspended: ['approved'],
  rejected: ['in_review'],
};

export const DOCUMENT_TYPES = [
  { key: 'tax_certificate', label: 'Identificación fiscal' },
  { key: 'business_license', label: 'Licencia o permiso de actividad' },
  { key: 'owner_id', label: 'Identificación del titular' },
  { key: 'bank_certificate', label: 'Certificado bancario' },
];

export const DOCUMENT_TYPE_BY_KEY = DOCUMENT_TYPES.reduce((accumulator, type) => {
  accumulator[type.key] = type;
  return accumulator;
}, {});

export function documentTypeLabel(key) {
  return DOCUMENT_TYPE_BY_KEY[key]?.label || key;
}

export const CATEGORY_STATUSES = ['active', 'inactive'];

export function categoryStatusLabel(status) {
  return status === 'inactive' ? 'Inactiva' : 'Activa';
}

// Los motivos se ofrecen en la interfaz y se guardan en la auditoría.
export const BUYER_ACTION_REASONS = {
  suspend: [
    { value: 'security', label: 'Motivo de seguridad' },
    { value: 'policy', label: 'Incumplimiento de normas de la plataforma' },
    { value: 'report', label: 'Reportes reiterados de otros usuarios' },
    { value: 'request', label: 'Solicitud del propio comprador' },
    { value: 'other', label: 'Otro motivo' },
  ],
  reactivate: [
    { value: 'reviewed', label: 'Revisión completada' },
    { value: 'error', label: 'Suspensión por error' },
    { value: 'request', label: 'Solicitud del propio comprador' },
    { value: 'other', label: 'Otro motivo' },
  ],
  block: [
    { value: 'fraud', label: 'Sospecha de fraude' },
    { value: 'abuse', label: 'Abuso grave o reiterado' },
    { value: 'legal', label: 'Requerimiento legal' },
    { value: 'security', label: 'Motivo de seguridad' },
    { value: 'other', label: 'Otro motivo' },
  ],
  unblock: [
    { value: 'reviewed', label: 'Revisión completada' },
    { value: 'error', label: 'Bloqueo por error' },
    { value: 'legal', label: 'Requerimiento legal resuelto' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export const COMMERCE_ACTION_REASONS = {
  review: [
    { value: 'documents_received', label: 'Documentación recibida' },
    { value: 'manual_review', label: 'Revisión manual solicitada' },
    { value: 'other', label: 'Otro motivo' },
  ],
  approve: [
    { value: 'documents_verified', label: 'Documentación verificada' },
    { value: 'manual_approval', label: 'Aprobación manual autorizada' },
    { value: 'other', label: 'Otro motivo' },
  ],
  reject: [
    { value: 'incomplete', label: 'Documentación incompleta' },
    { value: 'illegible', label: 'Documentación ilegible o vencida' },
    { value: 'mismatch', label: 'Datos que no coinciden' },
    { value: 'policy', label: 'Incumplimiento de requisitos' },
    { value: 'other', label: 'Otro motivo' },
  ],
  suspend: [
    { value: 'documents_expired', label: 'Documentación vencida' },
    { value: 'policy', label: 'Incumplimiento de políticas' },
    { value: 'reports', label: 'Reportes reiterados' },
    { value: 'security', label: 'Motivo de seguridad' },
    { value: 'other', label: 'Otro motivo' },
  ],
  reactivate: [
    { value: 'reviewed', label: 'Revisión completada' },
    { value: 'documents_updated', label: 'Documentación actualizada' },
    { value: 'error', label: 'Suspensión por error' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export const DOCUMENT_ACTION_REASONS = {
  verified: [
    { value: 'valid', label: 'Documento válido y vigente' },
    { value: 'matches', label: 'Coincide con los datos del comercio' },
    { value: 'other', label: 'Otro motivo' },
  ],
  rejected: [
    { value: 'illegible', label: 'Documento ilegible' },
    { value: 'expired', label: 'Documento vencido' },
    { value: 'mismatch', label: 'Datos que no coinciden' },
    { value: 'incomplete', label: 'Documento incompleto' },
    { value: 'other', label: 'Otro motivo' },
  ],
};

export const CATEGORY_ACTION_REASONS = {
  deactivate: [
    { value: 'duplicate', label: 'Categoría duplicada' },
    { value: 'replaced', label: 'Categoría reemplazada' },
    { value: 'not_used', label: 'Categoría fuera de uso' },
    { value: 'other', label: 'Otro motivo' },
  ],
  activate: [
    { value: 'new_catalog', label: 'Nueva temporada o catálogo' },
    { value: 'reviewed', label: 'Revisión completada' },
    { value: 'error', label: 'Desactivación por error' },
    { value: 'other', label: 'Otro motivo' },
  ],
};
