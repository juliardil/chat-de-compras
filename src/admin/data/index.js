import { insforge, isInsforgeConfigured } from '../../lib/insforge';
import { demoRepository } from './demoRepository';
import { createInsforgeRepository } from './insforgeRepository';

// `demo` significa que no hay backend configurado. La interfaz lo muestra de
// forma explícita para que nadie confunda datos de ejemplo con datos reales.
export const adminMode = isInsforgeConfigured ? 'insforge' : 'demo';

export const adminRepository = isInsforgeConfigured
  ? createInsforgeRepository(insforge)
  : demoRepository;
