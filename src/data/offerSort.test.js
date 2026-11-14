import { describe, expect, it } from 'vitest';
import { OFFER_SORT_OPTIONS, sortOffers } from './offerSort';

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
      'relevance',
      'price_asc',
      'price_desc',
      'delivery',
      'reliability',
    ]);
  });

  it('conserva el orden original en relevancia', () => {
    const list = [offer('a', { amount: 900 }), offer('b', { amount: 100 })];
    expect(ids(sortOffers(list, 'relevance'))).toEqual(['a', 'b']);
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
});
