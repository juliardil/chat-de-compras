// =============================================================================
// Catálogo único de segmentación (tipos de vehículo + líneas de inventario).
//
// Lo consumen /request (referencia exacta y «✨ Recomiéndame»),
// /register-commerce y /niche-config. Las mismas cadenas son las que validan
// las RPCs de matching en InsForge; por eso no se duplican listas por pantalla.
// =============================================================================

import { normalizeVehicleFamily } from '../utils/matching';

export const COMMERCE_VEHICLE_TYPES = [
  { value: 'carros', label: 'Carros' },
  { value: 'motos', label: 'Motos' },
];

export const COMMERCE_INVENTORY_LINES_BY_VEHICLE = {
  carros: [
    'Motor',
    'Frenos',
    'Suspensión',
    'Eléctrico',
    'Llantas y Neumáticos',
    'Interior / Exterior',
    'Lubricantes y Fluidos',
    'Taller Mecánico',
    'Accesorios Vehiculares',
    'Audio y Sonido',
    'Seguridad Vehicular',
  ],
  motos: [
    'Motor',
    'Frenos',
    'Suspensión',
    'Eléctrico',
    'Llantas y Neumáticos',
    'Kit de Arrastre / Transmisión',
    'Lubricantes y Fluidos',
    'Taller Mecánico',
    'Accesorios y Lujos',
    'Cascos e Indumentaria / Seguridad',
  ],
};

// Unión canónica, en el orden del catálogo. Se usa como respaldo mientras no
// hay un tipo de vehículo elegido y para validar entradas del backend.
export const COMMERCE_INVENTORY_LINES = [
  ...new Set([
    ...COMMERCE_INVENTORY_LINES_BY_VEHICLE.carros,
    ...COMMERCE_INVENTORY_LINES_BY_VEHICLE.motos,
  ]),
];

const VEHICLE_VALUES = COMMERCE_VEHICLE_TYPES.map((item) => item.value);

// Acepta tanto los valores de la BD ('carros') como los del formulario
// ('Auto', 'Camioneta', 'Moto') y devuelve solo las familias canónicas.
export const normalizeCommerceVehicleTypes = (values) =>
  VEHICLE_VALUES.filter((family) =>
    (Array.isArray(values) ? values : []).some(
      (value) => normalizeVehicleFamily(value) === family
    )
  );

export const getInventoryLinesForVehicle = (vehicleType) => {
  const family = normalizeVehicleFamily(vehicleType);
  return [
    ...(COMMERCE_INVENTORY_LINES_BY_VEHICLE[family] || COMMERCE_INVENTORY_LINES),
  ];
};

// Líneas permitidas para la combinación de vehículos elegida. Sin vehículos,
// se muestran todas para no ocultar opciones antes de la primera selección.
export const getInventoryLinesForVehicles = (vehicleTypes) => {
  const families = normalizeCommerceVehicleTypes(vehicleTypes);
  if (families.length === 0) return [...COMMERCE_INVENTORY_LINES];

  return [
    ...new Set(
      families.flatMap((family) => COMMERCE_INVENTORY_LINES_BY_VEHICLE[family])
    ),
  ];
};
