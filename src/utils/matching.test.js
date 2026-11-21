import { RECOMMENDATION_CATEGORIES } from '../data/recommendations';
import { describe, expect, it } from 'vitest';
import {
  filterCompatibleRequests,
  hasCommerceSegmentation,
  isRequestCompatibleWithCommerce,
  normalizeCategoryKey,
  normalizeVehicleFamily,
} from './matching';

const commerce = (overrides = {}) => ({
  vehicle_types: ['carros'],
  inventory_systems: ['Frenos', 'Motor'],
  ...overrides,
});

describe('normalización de segmentación', () => {
  it('agrupa los tipos de vehículo del comprador con los de la empresa', () => {
    expect(normalizeVehicleFamily('Auto')).toBe('carros');
    expect(normalizeVehicleFamily('Camioneta')).toBe('carros');
    expect(normalizeVehicleFamily('Camión')).toBe('carros');
    expect(normalizeVehicleFamily('Tractor')).toBe('carros');
    expect(normalizeVehicleFamily('carros')).toBe('carros');
    expect(normalizeVehicleFamily('Moto')).toBe('motos');
    expect(normalizeVehicleFamily('motocicleta')).toBe('motos');
    expect(normalizeVehicleFamily('motos')).toBe('motos');
    expect(normalizeVehicleFamily('Otro')).toBeNull();
    expect(normalizeVehicleFamily('')).toBeNull();
  });

  it('normaliza categorías sin acentos, mayúsculas ni puntuación', () => {
    expect(normalizeCategoryKey('Llantas y Neumáticos')).toBe('llantas');
    expect(normalizeCategoryKey('llantas y neumaticos')).toBe('llantas');
    expect(normalizeCategoryKey('Interior / Exterior')).toBe('interior exterior');
    expect(normalizeCategoryKey('Taller Mecánico')).toBe('taller');
    expect(normalizeCategoryKey('Audio y Sonido')).toBe('audio');
    expect(normalizeCategoryKey('Suspensión')).toBe('suspension');
    expect(normalizeCategoryKey('')).toBe('');
  });
});

describe('compatibilidad solicitud ↔ comercio', () => {
  it('acepta una solicitud de auto con categoría del inventario', () => {
    expect(
      isRequestCompatibleWithCommerce(
        { vehicle_type: 'Auto', category: 'Frenos', items: [] },
        commerce()
      )
    ).toBe(true);
  });

  it('rechaza un vehículo fuera del segmento', () => {
    expect(
      isRequestCompatibleWithCommerce(
        { vehicle_type: 'Moto', category: 'Frenos', items: [] },
        commerce()
      )
    ).toBe(false);
  });

  it('rechaza una categoría fuera del inventario', () => {
    expect(
      isRequestCompatibleWithCommerce(
        { vehicle_type: 'Auto', category: 'Audio y Sonido', items: [] },
        commerce()
      )
    ).toBe(false);
  });

  it('permite solicitudes antiguas con segmentación solo en items', () => {
    expect(
      isRequestCompatibleWithCommerce(
        {
          category: null,
          vehicle_type: null,
          items: [{ category: 'Motor', vehicleType: 'Camioneta' }],
        },
        commerce()
      )
    ).toBe(true);
  });

  it('da flexibilidad cuando la categoría de la solicitud está vacía', () => {
    expect(
      isRequestCompatibleWithCommerce(
        { vehicle_type: 'Auto', category: null, items: [] },
        commerce()
      )
    ).toBe(true);
  });

  it('acepta cuando algún producto de la solicitud coincide', () => {
    expect(
      isRequestCompatibleWithCommerce(
        {
          vehicle_type: 'Auto',
          category: 'Audio y Sonido',
          items: [
            { category: 'Audio y Sonido', vehicleType: 'Auto' },
            { category: 'Frenos', vehicleType: 'Auto' },
          ],
        },
        commerce()
      )
    ).toBe(true);
  });

  it('no devuelve nada si el comercio no configuró su segmentación', () => {
    expect(
      hasCommerceSegmentation({ vehicle_types: [], inventory_systems: [] })
    ).toBe(false);
    expect(
      isRequestCompatibleWithCommerce(
        { vehicle_type: 'Auto', category: 'Frenos', items: [] },
        { vehicle_types: [], inventory_systems: [] }
      )
    ).toBe(false);
  });

  it('filtra una lista conservando solo las solicitudes afines', () => {
    const result = filterCompatibleRequests(
      [
        { id: 1, vehicle_type: 'Auto', category: 'Frenos', items: [] },
        { id: 2, vehicle_type: 'Moto', category: 'Frenos', items: [] },
        { id: 3, vehicle_type: 'Camioneta', category: 'Audio y Sonido', items: [] },
        { id: 4, vehicle_type: null, items: [{ category: 'Motor', vehicleType: 'Auto' }] },
      ],
      commerce()
    );

    expect(result.map((request) => request.id)).toEqual([1, 4]);
  });
});

describe('enrutamiento del flujo «Recomiéndame»', () => {
  const recommendationRequest = (vehicleType, category) => ({
    vehicle_type: vehicleType,
    category,
    items: [{ vehicleType, category, item: 'Producto recomendado' }],
  });

  it.each(RECOMMENDATION_CATEGORIES)(
    'dirige %s de carro solo a comercios de carros de esa línea',
    (category) => {
      const request = recommendationRequest('Auto', category);

      expect(
        isRequestCompatibleWithCommerce(request, commerce({
          vehicle_types: ['carros'],
          inventory_systems: [category],
        }))
      ).toBe(true);
      expect(
        isRequestCompatibleWithCommerce(request, commerce({
          vehicle_types: ['motos'],
          inventory_systems: [category],
        }))
      ).toBe(false);
      expect(
        isRequestCompatibleWithCommerce(request, commerce({
          vehicle_types: ['carros'],
          inventory_systems: ['Motor'],
        }))
      ).toBe(false);
    }
  );

  it.each(RECOMMENDATION_CATEGORIES)(
    'dirige %s de moto solo a comercios de motos de esa línea',
    (category) => {
      const request = recommendationRequest('Moto', category);

      expect(
        isRequestCompatibleWithCommerce(request, commerce({
          vehicle_types: ['motos'],
          inventory_systems: [category],
        }))
      ).toBe(true);
      expect(
        isRequestCompatibleWithCommerce(request, commerce({
          vehicle_types: ['carros'],
          inventory_systems: [category],
        }))
      ).toBe(false);
    }
  );

  it('enruta baterías dentro de la línea Eléctrica sin inventar categorías', () => {
    const request = {
      vehicle_type: 'Moto',
      category: 'Eléctrico',
      items: [{ item: 'Batería YTX9-BS', category: 'Eléctrico', vehicleType: 'Moto' }],
    };

    expect(
      filterCompatibleRequests(
        [request],
        commerce({ vehicle_types: ['motos'], inventory_systems: ['Eléctrico'] })
      )
    ).toHaveLength(1);
    expect(normalizeCategoryKey('Eléctrico')).toBe('electrico');
  });
});
