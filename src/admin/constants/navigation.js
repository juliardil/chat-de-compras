export const PHASES = {
  1: 'Fase 1 · Fundación',
  2: 'Fase 2 · Personas y catálogo',
  3: 'Fase 3 · Operación',
  4: 'Fase 4 · Confianza y atención',
  5: 'Fase 5 · Analítica y pagos',
};

// Menú lateral definitivo. `permission` controla visibilidad; `phase` indica
// en qué fase se implementa el módulo completo.
export const NAVIGATION_GROUPS = [
  {
    key: 'main',
    label: null,
    items: [
      { key: 'dashboard', label: 'Panel', path: '/', icon: 'LayoutDashboard', permission: 'dashboard.view', phase: 1 },
    ],
  },
  {
    key: 'people',
    label: 'Personas',
    items: [
      { key: 'users', label: 'Compradores', path: '/compradores', icon: 'Users', permission: 'users.view', phase: 2 },
      {
        key: 'commerce',
        label: 'Comercios',
        path: '/comercios',
        icon: 'Store',
        permission: 'commerce.view',
        phase: 2,
        attention: 'pending',
      },
    ],
  },
  {
    key: 'market',
    label: 'Mercado',
    items: [
      {
        key: 'requests',
        label: 'Solicitudes',
        path: '/solicitudes',
        icon: 'ClipboardList',
        permission: 'requests.view',
        phase: 3,
      },
      {
        key: 'offers',
        label: 'Ofertas',
        path: '/ofertas',
        icon: 'BadgeDollarSign',
        permission: 'offers.view',
        phase: 3,
        attention: 'flagged',
      },
      { key: 'catalog', label: 'Categorías y datos', path: '/categorias', icon: 'Tags', permission: 'catalog.view', phase: 2 },
    ],
  },
  {
    key: 'operations',
    label: 'Operaciones',
    items: [
      { key: 'orders', label: 'Pedidos', path: '/pedidos', icon: 'Package', permission: 'orders.view', phase: 3 },
      { key: 'deliveries', label: 'Entregas', path: '/entregas', icon: 'Truck', permission: 'deliveries.view', phase: 3 },
      {
        key: 'payments',
        label: 'Pagos',
        path: '/pagos',
        icon: 'CreditCard',
        permission: 'payments.view',
        phase: 5,
        attention: 'not-configured',
      },
    ],
  },
  {
    key: 'trust',
    label: 'Confianza',
    items: [
      {
        key: 'chats',
        label: 'Chats',
        path: '/chats',
        icon: 'MessagesSquare',
        permission: 'chats.view_metadata',
        phase: 4,
        attention: 'reports',
      },
      {
        key: 'moderation',
        label: 'Moderación',
        path: '/moderacion',
        icon: 'ShieldAlert',
        permission: 'moderation.view',
        phase: 4,
        attention: 'reports',
      },
      { key: 'reviews', label: 'Reseñas', path: '/resenas', icon: 'Star', permission: 'reviews.view', phase: 4 },
    ],
  },
  {
    key: 'care',
    label: 'Atención',
    items: [
      {
        key: 'support',
        label: 'Soporte',
        path: '/soporte',
        icon: 'LifeBuoy',
        permission: 'support.view',
        phase: 4,
        attention: 'sla',
      },
    ],
  },
  {
    key: 'growth',
    label: 'Crecimiento',
    items: [
      {
        key: 'communications',
        label: 'Comunicaciones',
        path: '/comunicaciones',
        icon: 'Megaphone',
        permission: 'communications.view',
        phase: 4,
      },
      { key: 'analytics', label: 'Analítica', path: '/analitica', icon: 'BarChart3', permission: 'analytics.view', phase: 5 },
    ],
  },
  {
    key: 'system',
    label: 'Sistema',
    items: [
      { key: 'staff', label: 'Personal y permisos', path: '/personal', icon: 'UserCog', permission: 'staff.view', phase: 1 },
      { key: 'audit', label: 'Auditoría', path: '/auditoria', icon: 'ScrollText', permission: 'audit.view', phase: 1 },
      { key: 'settings', label: 'Configuración', path: '/configuracion', icon: 'Settings', permission: 'settings.view', phase: 1 },
    ],
  },
];

export const NAVIGATION_ITEMS = NAVIGATION_GROUPS.flatMap((group) => group.items);

// Módulos que todavía no se implementan. Se muestran con su fase para no
// aparentar funcionalidad que no existe. La Fase 5 implementó Pagos y Analítica,
// por lo que ya no queda ningún módulo pendiente en el menú.
export const PENDING_MODULES = {};
