// Catálogo de permisos del administrador.
// Los permisos se validan siempre en servidor (RLS + funciones). Aquí solo se
// declaran para construir la navegación y para el modo demostración local.

export const PERMISSION_CATALOG = [
  { key: 'dashboard.view', module: 'Panel', label: 'Ver el panel', sensitive: false },

  { key: 'users.view', module: 'Compradores', label: 'Ver compradores', sensitive: false },
  { key: 'users.view_pii', module: 'Compradores', label: 'Ver datos personales completos', sensitive: true },
  { key: 'users.suspend', module: 'Compradores', label: 'Suspender compradores', sensitive: true },
  { key: 'users.block', module: 'Compradores', label: 'Bloquear compradores', sensitive: true },
  { key: 'users.delete', module: 'Compradores', label: 'Anonimizar o eliminar compradores', sensitive: true },

  { key: 'commerce.view', module: 'Comercios', label: 'Ver comercios', sensitive: false },
  { key: 'commerce.approve', module: 'Comercios', label: 'Aprobar comercios', sensitive: true },
  { key: 'commerce.reject', module: 'Comercios', label: 'Rechazar comercios', sensitive: true },
  { key: 'commerce.suspend', module: 'Comercios', label: 'Suspender comercios', sensitive: true },
  { key: 'commerce.documents.view', module: 'Comercios', label: 'Ver documentos del comercio', sensitive: true },

  { key: 'requests.view', module: 'Solicitudes', label: 'Ver solicitudes', sensitive: false },
  { key: 'requests.moderate', module: 'Solicitudes', label: 'Moderar solicitudes', sensitive: true },
  { key: 'requests.close', module: 'Solicitudes', label: 'Cerrar o cancelar solicitudes', sensitive: true },

  { key: 'offers.view', module: 'Ofertas', label: 'Ver ofertas', sensitive: false },
  { key: 'offers.flag', module: 'Ofertas', label: 'Marcar ofertas irregulares', sensitive: true },
  { key: 'offers.withdraw_admin', module: 'Ofertas', label: 'Retirar ofertas por decisión administrativa', sensitive: true },

  { key: 'catalog.view', module: 'Categorías', label: 'Ver categorías', sensitive: false },
  { key: 'catalog.create', module: 'Categorías', label: 'Crear categorías', sensitive: false },
  { key: 'catalog.update', module: 'Categorías', label: 'Editar categorías', sensitive: false },
  { key: 'catalog.deactivate', module: 'Categorías', label: 'Activar o desactivar categorías', sensitive: true },

  { key: 'orders.view', module: 'Pedidos', label: 'Ver pedidos', sensitive: false },
  { key: 'orders.cancel', module: 'Pedidos', label: 'Cancelar pedidos', sensitive: true },
  { key: 'orders.transition', module: 'Pedidos', label: 'Avanzar estados de pedido', sensitive: true },
  { key: 'orders.resolve_dispute', module: 'Pedidos', label: 'Resolver disputas', sensitive: true },

  { key: 'deliveries.view', module: 'Entregas', label: 'Ver entregas', sensitive: false },
  { key: 'deliveries.update', module: 'Entregas', label: 'Actualizar seguimiento', sensitive: false },
  { key: 'deliveries.confirm', module: 'Entregas', label: 'Confirmar recepción', sensitive: true },

  { key: 'payments.view', module: 'Pagos', label: 'Ver transacciones', sensitive: true },
  { key: 'payments.refund', module: 'Pagos', label: 'Emitir reembolsos', sensitive: true },
  { key: 'payments.reconcile', module: 'Pagos', label: 'Conciliar pagos', sensitive: true },
  { key: 'payments.configure', module: 'Pagos', label: 'Configurar pagos', sensitive: true },

  { key: 'chats.view_metadata', module: 'Chats', label: 'Ver metadatos de conversaciones', sensitive: false },
  { key: 'chats.request_access', module: 'Chats', label: 'Solicitar acceso a un chat', sensitive: true },
  { key: 'chats.grant_access', module: 'Chats', label: 'Autorizar acceso a un chat', sensitive: true },
  { key: 'chats.access_content', module: 'Chats', label: 'Leer contenido de un chat autorizado', sensitive: true },

  { key: 'moderation.view', module: 'Moderación', label: 'Ver reportes', sensitive: false },
  { key: 'moderation.assign', module: 'Moderación', label: 'Asignar reportes', sensitive: false },
  { key: 'moderation.resolve', module: 'Moderación', label: 'Resolver reportes', sensitive: true },

  { key: 'reviews.view', module: 'Reseñas', label: 'Ver reseñas', sensitive: false },
  { key: 'reviews.moderate', module: 'Reseñas', label: 'Moderar reseñas', sensitive: true },

  { key: 'support.view', module: 'Soporte', label: 'Ver tickets', sensitive: false },
  { key: 'support.assign', module: 'Soporte', label: 'Asignar tickets', sensitive: false },
  { key: 'support.reply', module: 'Soporte', label: 'Responder tickets', sensitive: false },
  { key: 'support.close', module: 'Soporte', label: 'Cerrar tickets', sensitive: true },

  { key: 'communications.view', module: 'Comunicaciones', label: 'Ver comunicaciones', sensitive: false },
  { key: 'communications.template', module: 'Comunicaciones', label: 'Gestionar plantillas', sensitive: false },
  { key: 'communications.send', module: 'Comunicaciones', label: 'Enviar comunicaciones', sensitive: true },
  { key: 'communications.broadcast', module: 'Comunicaciones', label: 'Enviar comunicados masivos', sensitive: true },

  { key: 'analytics.view', module: 'Analítica', label: 'Ver métricas', sensitive: false },
  { key: 'analytics.export', module: 'Analítica', label: 'Exportar informes', sensitive: true },
  { key: 'analytics.pii', module: 'Analítica', label: 'Incluir datos personales en informes', sensitive: true },

  { key: 'staff.view', module: 'Personal', label: 'Ver personal administrativo', sensitive: true },
  { key: 'staff.invite', module: 'Personal', label: 'Invitar personal', sensitive: true },
  { key: 'staff.update', module: 'Personal', label: 'Suspender o reactivar personal', sensitive: true },
  { key: 'staff.roles.manage', module: 'Personal', label: 'Administrar roles y permisos', sensitive: true },

  { key: 'audit.view', module: 'Auditoría', label: 'Consultar auditoría', sensitive: true },
  { key: 'audit.export', module: 'Auditoría', label: 'Exportar auditoría', sensitive: true },

  { key: 'settings.view', module: 'Configuración', label: 'Ver configuración', sensitive: false },
  { key: 'settings.update', module: 'Configuración', label: 'Editar configuración', sensitive: true },
  { key: 'settings.sensitive', module: 'Configuración', label: 'Cambiar configuración sensible', sensitive: true },
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((permission) => permission.key);

export const PERMISSION_BY_KEY = PERMISSION_CATALOG.reduce((accumulator, permission) => {
  accumulator[permission.key] = permission;
  return accumulator;
}, {});

export const ROLES = [
  {
    key: 'superadmin',
    name: 'Superadministrador',
    description: 'Control total, personal, permisos y configuración sensible.',
  },
  {
    key: 'admin',
    name: 'Administrador general',
    description: 'Operación diaria y decisiones de negocio.',
  },
  {
    key: 'commerce_manager',
    name: 'Gestor de comercios',
    description: 'Altas, verificación, categorías y seguimiento de comercios.',
  },
  {
    key: 'moderator',
    name: 'Moderador',
    description: 'Reportes, contenido, reseñas y medidas de confianza.',
  },
  {
    key: 'support',
    name: 'Atención al cliente',
    description: 'Tickets, pedidos y consultas de usuarios.',
  },
  {
    key: 'analyst',
    name: 'Analista',
    description: 'Lectura de métricas, reportes y auditoría.',
  },
  {
    key: 'finance',
    name: 'Finanzas',
    description: 'Pagos, reembolsos y conciliación (se activa con la pasarela).',
  },
];

export const ROLE_BY_KEY = ROLES.reduce((accumulator, role) => {
  accumulator[role.key] = role;
  return accumulator;
}, {});

const withoutKeys = (keys) => ALL_PERMISSION_KEYS.filter((key) => !keys.includes(key));

export const ROLE_PERMISSIONS = {
  superadmin: [...ALL_PERMISSION_KEYS],

  admin: withoutKeys([
    'staff.view',
    'staff.invite',
    'staff.update',
    'staff.roles.manage',
    'settings.update',
    'settings.sensitive',
    'audit.export',
    'payments.refund',
    'payments.reconcile',
    'payments.configure',
  ]),

  commerce_manager: [
    'dashboard.view',
    'users.view',
    'commerce.view',
    'commerce.approve',
    'commerce.reject',
    'commerce.suspend',
    'commerce.documents.view',
    'catalog.view',
    'catalog.create',
    'catalog.update',
    'catalog.deactivate',
    'requests.view',
    'offers.view',
    'orders.view',
    'deliveries.view',
    'reviews.view',
    'analytics.view',
  ],

  moderator: [
    'dashboard.view',
    'users.view',
    'users.suspend',
    'commerce.view',
    'requests.view',
    'requests.moderate',
    'requests.close',
    'offers.view',
    'offers.flag',
    'chats.view_metadata',
    'chats.request_access',
    'chats.access_content',
    'moderation.view',
    'moderation.assign',
    'moderation.resolve',
    'reviews.view',
    'reviews.moderate',
    'orders.view',
    'support.view',
  ],

  support: [
    'dashboard.view',
    'users.view',
    'commerce.view',
    'requests.view',
    'offers.view',
    'orders.view',
    'deliveries.view',
    'reviews.view',
    'support.view',
    'support.assign',
    'support.reply',
    'support.close',
  ],

  analyst: [
    'dashboard.view',
    'users.view',
    'commerce.view',
    'requests.view',
    'offers.view',
    'orders.view',
    'deliveries.view',
    'payments.view',
    'reviews.view',
    'analytics.view',
    'analytics.export',
    'audit.view',
  ],

  finance: [
    'dashboard.view',
    'orders.view',
    'payments.view',
    'payments.refund',
    'payments.reconcile',
    'analytics.view',
    'audit.view',
  ],
};

export function getPermissionsForRole(roleKey) {
  return [...(ROLE_PERMISSIONS[roleKey] || [])];
}

export function hasPermission(permissions, permissionKey) {
  if (!permissionKey) return true;
  return Array.isArray(permissions) && permissions.includes(permissionKey);
}

export function groupPermissionsByModule(permissionKeys) {
  const groups = new Map();

  permissionKeys.forEach((key) => {
    const permission = PERMISSION_BY_KEY[key];
    if (!permission) return;
    if (!groups.has(permission.module)) groups.set(permission.module, []);
    groups.get(permission.module).push(permission);
  });

  return Array.from(groups.entries()).map(([module, permissions]) => ({
    module,
    permissions,
  }));
}
