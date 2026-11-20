// Sugerencia de especialidad para solicitudes de servicio.
//
// Reutiliza el catálogo del perfil de taller (WORKSHOP_SPECIALTIES): no define
// un catálogo nuevo. La sugerencia es solo una pista: el comprador siempre ve
// el selector y puede cambiarla. Si hay más de una coincidencia clara, no se
// preselecciona nada para no adivinar por él.

import { WORKSHOP_SPECIALTIES } from './workshop';

const SPECIALTY_KEYWORDS = {
  'Mecánica general': [
    'motor', 'aceite', 'correa', 'distribucion', 'transmision', 'caja',
    'embrague', 'clutch', 'escape', 'mantenimiento', 'reparacion general',
    'bomba de agua', 'radiador', 'turbo', 'cilindros', 'bielas',
  ],
  Motos: ['moto', 'motocicleta', 'scooter', 'moped'],
  Electricidad: [
    'electricidad', 'electrico', 'bateria', 'alternador', 'luces', 'faros',
    'cable', 'cables', 'fusible', 'fusibles', 'arnes', 'bujias',
    'limpiaparabrisas', 'ventanillas', 'tomacorriente',
  ],
  Latonería: [
    'latoneria', 'abolladura', 'golpe', 'choque', 'carroceria',
    'enderezado', 'dano', 'danos', 'parachoques',
  ],
  Pintura: ['pintura', 'pintar', 'pintado', 'repintar', 'barniz'],
  'Aire acondicionado': [
    'aire acondicionado', 'a/c', 'clima', 'refrigeracion', 'compresor',
    'freon', 'gas refrigerante',
  ],
  Frenos: [
    'freno', 'frenos', 'frenar', 'pastillas', 'pastilla', 'discos', 'disco',
    'caliper', 'liquido de frenos', 'abs', 'tambor', 'zapatas',
  ],
  Suspensión: [
    'suspension', 'amortiguadores', 'amortiguador', 'resortes', 'muelles',
    'alineacion', 'balanceo', 'ruedas', 'llantas', 'horquilla', 'tijeras',
  ],
  'Diagnóstico electrónico': [
    'diagnostico', 'escaneo', 'escaner', 'sensor', 'computadora', 'ecu',
    'codigo de error', 'check engine', 'falla electronica', 'sensores',
  ],
};

const normalizeText = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();

// Especialidades del catálogo con al menos una palabra clave presente.
export const findSpecialtyMatches = (description) => {
  const normalized = normalizeText(description);
  if (!normalized) return [];

  const haystack = ` ${normalized} `;
  return WORKSHOP_SPECIALTIES.filter((specialty) =>
    (SPECIALTY_KEYWORDS[specialty] || []).some((keyword) =>
      haystack.includes(` ${keyword} `)
    )
  );
};

// Solo preselecciona cuando una única especialidad coincide claramente.
export const suggestServiceSpecialty = (description) => {
  const matches = findSpecialtyMatches(description);
  return matches.length === 1 ? matches[0] : null;
};
