import { describe, expect, it } from 'vitest';
import { OFFER_SORT_OPTIONS, sortOffers, sortOfferGroups } from './offerSort';

const offer = (id, overrides = {}) => ({
  id,
  amount: null,
  deliveryDays: null,
  rating: null,
  ratingCount: 0,
  ...overrides,
});

const ids = (list) => list.map((item) => item.id);

describe('ordenamiento de ofertas', () => {
  it('ofrece las opciones de orden solicitadas', () => {
    expect(OFFER_SORT_OPTIONS.map((option) => option.key)).toEqual([
      'distance',
      'price_asc',
      'price_desc',
      'delivery',
      'reliability',
    ]);
  });

  it('ordena por distancia y deja al final las ofertas sin ubicación', () => {
    const list = [
      offer('lejos', { distanceKm: 8.4 }),
      offer('sin-ubicacion'),
      offer('cerca', { distanceKm: 1.2 }),
      offer('medio', { distanceKm: 3.5 }),
    ];

    expect(ids(sortOffers(list, 'distance'))).toEqual([
      'cerca',
      'medio',
      'lejos',
      'sin-ubicacion',
    ]);
  });

  it('ordena por precio de menor a mayor y deja al final las ofertas sin importe', () => {
    const list = [
      offer('a', { amount: 900 }),
      offer('sin-precio'),
      offer('b', { amount: 250 }),
      offer('c', { amount: 400 }),
    ];

    expect(ids(sortOffers(list, 'price_asc'))).toEqual(['b', 'c', 'a', 'sin-precio']);
    expect(ids(sortOffers(list, 'price_desc'))).toEqual(['a', 'c', 'b', 'sin-precio']);
  });

  it('ordena por tiempo de entrega y deja al final las ofertas sin plazo', () => {
    const list = [
      offer('a', { deliveryDays: 5 }),
      offer('sin-plazo'),
      offer('b', { deliveryDays: 1 }),
      offer('c', { deliveryDays: 3 }),
    ];

    expect(ids(sortOffers(list, 'delivery'))).toEqual(['b', 'c', 'a', 'sin-plazo']);
  });

  it('ordena por confiabilidad: mejor promedio y, a igual promedio, más reseñas', () => {
    const list = [
      offer('sin-resenas'),
      offer('a', { rating: 4.2, ratingCount: 8 }),
      offer('b', { rating: 4.8, ratingCount: 3 }),
      offer('c', { rating: 4.2, ratingCount: 20 }),
    ];

    expect(ids(sortOffers(list, 'reliability'))).toEqual(['b', 'c', 'a', 'sin-resenas']);
  });

  it('no modifica la lista original', () => {
    const list = [offer('a', { amount: 900 }), offer('b', { amount: 100 })];
    const sorted = sortOffers(list, 'price_asc');

    expect(sorted).not.toBe(list);
    expect(ids(list)).toEqual(['a', 'b']);
  });

  it('ordena los grupos de producto por su mejor oferta', () => {
    const groups = [
      { key: 'aceite', offers: [offer('aceite', { amount: 300 })] },
      { key: 'sin-precio', offers: [offer('sin-precio')] },
      { key: 'pastillas', offers: [offer('pastillas', { amount: 250 })] },
    ];

    expect(sortOfferGroups(groups, 'price_asc').map((group) => group.key)).toEqual([
      'pastillas',
      'aceite',
      'sin-precio',
    ]);
    expect(sortOfferGroups(groups, 'price_desc').map((group) => group.key)).toEqual([
      'aceite',
      'pastillas',
      'sin-precio',
    ]);
  });

  it('ordena los grupos por la oferta más cercana', () => {
    const groups = [
      { key: 'lejos', offers: [offer('lejos', { distanceKm: 9.2 })] },
      { key: 'sin-ubicacion', offers: [offer('sin-ubicacion')] },
      { key: 'cerca', offers: [offer('cerca', { distanceKm: 2.4 })] },
    ];

    expect(sortOfferGroups(groups, 'distance').map((group) => group.key)).toEqual([
      'cerca',
      'lejos',
      'sin-ubicacion',
    ]);
  });

  it('ordena también las ofertas dentro de cada grupo', () => {
    const groups = [
      {
        key: 'pastillas',
        offers: [
          offer('caro', { amount: 900 }),
          offer('barato', { amount: 250 }),
        ],
      },
    ];

    const [group] = sortOfferGroups(groups, 'price_asc');
    expect(ids(group.offers)).toEqual(['barato', 'caro']);
    // El grupo original no se modifica.
    expect(ids(groups[0].offers)).toEqual(['caro', 'barato']);
  });
});
