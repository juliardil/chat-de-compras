import { describe, expect, it } from 'vitest';
import {
  COMMERCE_INVENTORY_LINES,
  COMMERCE_INVENTORY_LINES_BY_VEHICLE,
  COMMERCE_VEHICLE_TYPES,
  getInventoryLinesForVehicle,
  getInventoryLinesForVehicles,
  normalizeCommerceVehicleTypes,
} from './vehicleLines';

const CAR_LINES = [
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
];

const MOTO_LINES = [
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
];

describe('catálogo compartido de líneas por vehículo', () => {
  it('define los tipos de vehículo y las líneas exactas de cada uno', () => {
    expect(COMMERCE_VEHICLE_TYPES).toEqual([
      { value: 'carros', label: 'Carros' },
      { value: 'motos', label: 'Motos' },
    ]);
    expect(COMMERCE_INVENTORY_LINES_BY_VEHICLE.carros).toEqual(CAR_LINES);
    expect(COMMERCE_INVENTORY_LINES_BY_VEHICLE.motos).toEqual(MOTO_LINES);
    expect(COMMERCE_INVENTORY_LINES).toEqual([
      ...CAR_LINES,
      'Kit de Arrastre / Transmisión',
      'Accesorios y Lujos',
      'Cascos e Indumentaria / Seguridad',
    ]);
  });

  it('normaliza vehículos del formulario y de la BD a las familias canónicas', () => {
    expect(normalizeCommerceVehicleTypes(['Auto', 'Camioneta', 'Moto', 'Otro'])).toEqual([
      'carros',
      'motos',
    ]);
    expect(normalizeCommerceVehicleTypes(['carros'])).toEqual(['carros']);
    expect(normalizeCommerceVehicleTypes([])).toEqual([]);
  });

  it('devuelve solo las líneas del vehículo elegido', () => {
    expect(getInventoryLinesForVehicle('Camioneta')).toEqual(CAR_LINES);
    expect(getInventoryLinesForVehicle('Moto')).toEqual(MOTO_LINES);
    expect(getInventoryLinesForVehicle('motocicleta')).toEqual(MOTO_LINES);
    expect(getInventoryLinesForVehicle('Otro')).toEqual(COMMERCE_INVENTORY_LINES);
  });

  it('combina las líneas de todos los vehículos seleccionados', () => {
    expect(getInventoryLinesForVehicles(['motos'])).toEqual(MOTO_LINES);
    expect(getInventoryLinesForVehicles(['carros', 'motos'])).toEqual(
      COMMERCE_INVENTORY_LINES
    );
    expect(getInventoryLinesForVehicles([])).toEqual(COMMERCE_INVENTORY_LINES);
    expect(getInventoryLinesForVehicles(['motos'])).not.toContain('Audio y Sonido');
  });
});
