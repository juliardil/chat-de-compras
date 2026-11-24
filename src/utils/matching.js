// =============================================================================
// Normalización y compatibilidad entre solicitudes y comercios.
//
// El formulario del comprador guarda tipos de vehículo como "Auto", "Moto" o
// "Camioneta", mientras que el registro del comercio guarda "carros"/"motos".
// Las categorías de repuesto usan los mismos nombres en ambos formularios, pero
// pueden variar en mayúsculas, acentos, puntuación o sinónimos.
//
// Este módulo es puro (sin React ni InsForge) para poder usarlo en la capa de
// datos y probarlo de forma aislada. La migración
// 20261115010000_matching-rls.sql replica la misma normalización en PL/pgSQL.
// =============================================================================

export const normalizeMatchingText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const unique = (values) => [...new Set(values)];

const VEHICLE_FAMILIES = [
  {
    key: 'carros',
    aliases: [
      'carros',
      'carro',
      'auto',
      'autos',
      'automovil',
      'automoviles',
      'camioneta',
      'camionetas',
      'camion',
      'camiones',
      'tractor',
      'tractores',
      'suv',
      'suvs',
      'pickup',
      'pickups',
      'pick up',
      'vehiculo',
      'vehiculos',
    ],
  },
  {
    key: 'motos',
    aliases: ['motos', 'moto', 'motocicleta', 'motocicletas', 'scooter', 'scooters'],
  },
];

const VEHICLE_FAMILY_BY_ALIAS = new Map(
  VEHICLE_FAMILIES.flatMap(({ key, aliases }) => aliases.map((alias) => [alias, key]))
);

// Claves canónicas de categorías. Los alias permiten que datos antiguos o
// capturados a mano sigan coincidiendo con el inventario del comercio.
const CATEGORY_KEYS = [
  { key: 'motor', aliases: ['motor', 'motores', 'motor y transmision', 'transmision'] },
  { key: 'frenos', aliases: ['frenos', 'freno', 'sistema de frenos'] },
  {
    key: 'suspension',
    aliases: ['suspension', 'suspensiones', 'amortiguadores'],
  },
  {
    key: 'electrico',
    aliases: ['electrico', 'electrica', 'electricos', 'electricidad', 'sistema electrico'],
  },
  {
    key: 'llantas',
    aliases: ['llantas', 'llanta', 'neumaticos', 'neumatico', 'llantas y neumaticos'],
  },
  {
    key: 'interior exterior',
    aliases: ['interior exterior', 'interior y exterior', 'interior', 'exterior', 'carroceria'],
  },
  {
    key: 'lubricantes',
    aliases: ['lubricantes', 'lubricante', 'lubricantes y fluidos', 'fluidos', 'aceites'],
  },
  {
    key: 'taller',
    aliases: ['taller', 'taller mecanico', 'servicios', 'servicio mecanico'],
  },
  {
    key: 'accesorios',
    aliases: ['accesorios', 'accesorios vehiculares', 'accesorios para vehiculos'],
  },
  { key: 'audio', aliases: ['audio', 'audio y sonido', 'sonido', 'estereo'] },
  { key: 'seguridad', aliases: ['seguridad', 'seguridad vehicular'] },
  // Líneas específicas de moto del catálogo compartido (vehicleLines.js).
  // Claves propias para que una combinación Moto + Cascos no se confunda con
  // Carro + Seguridad Vehicular.
  {
    key: 'kit arrastre',
    aliases: [
      'kit arrastre',
      'kit de arrastre',
      'kit arrastre transmision',
      'kit de arrastre transmision',
    ],
  },
  { key: 'accesorios lujos', aliases: ['accesorios lujos', 'accesorios y lujos'] },
  {
    key: 'cascos indumentaria seguridad',
    aliases: [
      'cascos',
      'cascos indumentaria seguridad',
      'cascos e indumentaria seguridad',
    ],
  },
];

const CATEGORY_KEY_BY_ALIAS = new Map(
  CATEGORY_KEYS.flatMap(({ key, aliases }) => aliases.map((alias) => [alias, key]))
);

export const normalizeVehicleFamily = (value) => {
  const key = normalizeMatchingText(value);
  return key ? VEHICLE_FAMILY_BY_ALIAS.get(key) || null : null;
};

export const normalizeCategoryKey = (value) => {
  const key = normalizeMatchingText(value);
  if (!key) return '';
  return CATEGORY_KEY_BY_ALIAS.get(key) || key;
};

export const normalizeVehicleFamilies = (values) =>
  unique(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeVehicleFamily(value))
      .filter(Boolean)
  );

export const normalizeInventorySystems = (values) =>
  unique(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeCategoryKey(value))
      .filter(Boolean)
  );

const itemObjects = (request) =>
  (Array.isArray(request?.items) ? request.items : []).filter(
    (item) => item && typeof item === 'object' && !Array.isArray(item)
  );

const getRequestVehicleFamilies = (request) => {
  const items = itemObjects(request);
  return normalizeVehicleFamilies([
    request?.vehicle_type,
    request?.vehicleType,
    ...items.flatMap((item) => [item.vehicle_type, item.vehicleType]),
  ]);
};

const getRequestCategories = (request) => {
  const items = itemObjects(request);
  return normalizeInventorySystems([
    request?.category,
    ...items.map((item) => item.category),
  ]);
};

const commerceVehicleValues = (commerce) =>
  commerce?.vehicle_types ?? commerce?.vehicleTypes;

const commerceInventoryValues = (commerce) =>
  commerce?.inventory_systems ?? commerce?.inventorySystems;

// Un comercio está configurado cuando declaró al menos un vehículo y al menos
// un sistema de inventario. Sin ambos datos no se puede garantizar afinidad.
export const hasCommerceSegmentation = (commerce) =>
  normalizeVehicleFamilies(commerceVehicleValues(commerce)).length > 0 &&
  normalizeInventorySystems(commerceInventoryValues(commerce)).length > 0;

// Compatibilidad de una solicitud con un comercio:
//   * vehículo: si la solicitud no declara un tipo reconocible (p. ej. "Otro" o
//     datos antiguos sin columna), no se bloquea solo por el vehículo;
//   * categoría: si la solicitud no declara categoría, se permite; si declara
//     varias (varios productos), basta con que una esté en el inventario.
export const isRequestCompatibleWithCommerce = (request, commerce) => {
  if (!hasCommerceSegmentation(commerce)) return false;

  const commerceVehicles = normalizeVehicleFamilies(
    commerceVehicleValues(commerce)
  );
  const requestVehicles = getRequestVehicleFamilies(request);
  if (
    requestVehicles.length > 0 &&
    !requestVehicles.some((family) => commerceVehicles.includes(family))
  ) {
    return false;
  }

  const commerceCategories = normalizeInventorySystems(
    commerceInventoryValues(commerce)
  );
  const requestCategories = getRequestCategories(request);
  if (
    requestCategories.length > 0 &&
    !requestCategories.some((category) => commerceCategories.includes(category))
  ) {
    return false;
  }

  return true;
};

export const filterCompatibleRequests = (requests, commerce) =>
  (Array.isArray(requests) ? requests : []).filter((request) =>
    isRequestCompatibleWithCommerce(request, commerce)
  );
