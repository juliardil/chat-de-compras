import { describe, expect, it } from 'vitest';
import {
  autocompleteOfferItem,
  buildInventoryNotes,
  classifyRequest,
  findInventoryMatches,
  getFreshness,
  getOpportunityReadiness,
  matchScore,
} from './inventoryMatching';

const NOW = new Date(2026, 5, 15, 12, 0, 0);

const daysFromNow = (days) => {
  const date = new Date(2026, 5, 15, 12, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
};

const inventoryItem = (overrides = {}) => ({
  id: 'inv-1',
  name: 'Bafles Sony',
  sku: 'REF-1',
  brand: 'Sony',
  category: 'Audio y Sonido',
  price: 250,
  stock: 5,
  is_active: true,
  photo_url: 'https://cdn.example.com/bafles.jpg',
  bonus: 'Instalación gratis',
  valid_until: daysFromNow(30),
  equivalence_group: 'audio',
  ...overrides,
});

const requestItem = (overrides = {}) => ({
  product: 'Bafles',
  reference: 'REF-1',
  brand: 'Sony',
  category: 'Audio y Sonido',
  ...overrides,
});

describe('vigencia del inventario', () => {
  it('marca vencido, por vencer y vigente según la fecha límite', () => {
    expect(getFreshness({ valid_until: daysFromNow(-1) }, NOW).status).toBe('expired');
    expect(getFreshness({ valid_until: daysFromNow(4) }, NOW).status).toBe('expiring');
    expect(getFreshness({ valid_until: daysFromNow(30) }, NOW).status).toBe('current');
  });

  it('avisa cuando no hay vigencia o el inventario está desactualizado', () => {
    expect(getFreshness({}, NOW)).toMatchObject({
      status: 'unknown',
      label: 'Sin vigencia registrada',
    });
    expect(getFreshness({ updated_at: daysFromNow(-120) }, NOW)).toMatchObject({
      status: 'expiring',
      label: 'Inventario desactualizado',
    });
  });
});

describe('cruce entre solicitudes e inventario', () => {
  it('puntúa más alto una referencia exacta que una coincidencia parcial', () => {
    const exact = matchScore(requestItem(), inventoryItem());
    const partial = matchScore(
      requestItem({ reference: '', brand: '', category: '' }),
      inventoryItem()
    );

    expect(exact).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(0);
  });

  it('descarta inventario sin relación y ordena por puntaje', () => {
    const unrelated = inventoryItem({ id: 'inv-x', name: 'Filtro de aceite', sku: 'X', brand: 'Fram', category: 'Motor' });
    const matches = findInventoryMatches(requestItem(), [
      unrelated,
      inventoryItem({ id: 'inv-2', name: 'Bafles Pioneer', brand: 'Pioneer', sku: 'P-1' }),
      inventoryItem(),
    ]);

    expect(matches[0].id).toBe('inv-1');
    expect(matches.some((item) => item.id === 'inv-x')).toBe(false);
  });

  it('clasifica listo, parcial y manual', () => {
    expect(classifyRequest(requestItem(), [inventoryItem()], NOW)).toMatchObject({
      status: 'ready',
      label: 'Listo para enviar',
    });
    expect(
      classifyRequest(requestItem(), [inventoryItem({ stock: 0 })], NOW)
    ).toMatchObject({ status: 'partial', label: 'Coincidencia parcial' });
    expect(
      classifyRequest(requestItem(), [inventoryItem({ valid_until: daysFromNow(-2) })], NOW)
    ).toMatchObject({ status: 'partial' });
    expect(classifyRequest(requestItem(), [])).toMatchObject({
      status: 'manual',
      label: 'Cotización manual',
    });
  });

  it('solo marca la tarjeta lista cuando todos los productos lo están', () => {
    const ready = getOpportunityReadiness(
      [requestItem(), requestItem({ product: 'Bafles' })],
      [inventoryItem()],
      NOW
    );
    expect(ready.status).toBe('ready');

    expect(
      getOpportunityReadiness(
        [requestItem(), requestItem()],
        [inventoryItem({ stock: 0 })],
        NOW
      ).status
    ).toBe('partial');

    expect(
      getOpportunityReadiness([{ product: 'Llanta' }], [inventoryItem()], NOW).status
    ).toBe('manual');
  });
});

describe('autocompletado de la cotización', () => {
  it('propone precio, notas, foto, bono y alternativas del inventario', () => {
    const alternate = inventoryItem({
      id: 'inv-2',
      name: 'Bafles Pioneer',
      brand: 'Pioneer',
      sku: 'P-1',
      price: 240,
      stock: 2,
      photo_url: 'https://cdn.example.com/pioneer.jpg',
      valid_until: daysFromNow(10),
    });

    const suggestion = autocompleteOfferItem(
      requestItem(),
      [inventoryItem(), alternate],
      NOW
    );

    expect(suggestion.readiness.status).toBe('ready');
    expect(suggestion.price).toBe('250');
    expect(suggestion.bonus).toBe('Instalación gratis');
    expect(suggestion.photo).toBe('https://cdn.example.com/bafles.jpg');
    expect(suggestion.freshness.status).toBe('current');
    expect(suggestion.notes).toContain('SKU REF-1');
    expect(suggestion.notes).toContain('5 disponibles');
    expect(suggestion.notes).toContain('vigente hasta');
    expect(suggestion.alternatives).toHaveLength(1);
    expect(suggestion.alternatives[0]).toMatchObject({
      brand: 'Pioneer',
      price: '240',
      photo: 'https://cdn.example.com/pioneer.jpg',
      available: true,
    });
  });

  it('no inventa datos cuando no hay coincidencias', () => {
    const suggestion = autocompleteOfferItem(requestItem(), [], NOW);

    expect(suggestion).toMatchObject({
      price: '',
      notes: '',
      photo: null,
      bonus: '',
      freshness: null,
      alternatives: [],
      match: null,
    });
    expect(suggestion.readiness.status).toBe('manual');
  });

  it('arma notas legibles con SKU, stock y vigencia', () => {
    const notes = buildInventoryNotes(inventoryItem());

    expect(notes).toContain('SKU REF-1');
    expect(notes).toContain('5 disponibles');
  });
});
