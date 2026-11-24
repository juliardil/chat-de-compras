import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simula un backend conectado para comprobar que la biblioteca del comercio
// solo lee sus propias ofertas y reutiliza la URL de Storage ya guardada.
const harness = vi.hoisted(() => ({
  db: null,
  calls: [],
  offers: [],
  fail: null,
}));

vi.mock('../lib/insforge', () => ({
  isInsforgeConfigured: true,
  get insforge() {
    return { database: harness.db };
  },
}));

const { fetchCommerceSavedRecommendations, NOTICES } = await import('./appData');

const createQuery = (table) => {
  const call = { table, select: '', filters: [], order: null, limit: null };
  const query = {
    select(columns) {
      call.select = columns;
      return query;
    },
    eq(column, value) {
      call.filters.push(['eq', column, value]);
      return query;
    },
    not(column, operator, value) {
      call.filters.push(['not', column, operator, value]);
      return query;
    },
    order(column, options) {
      call.order = [column, options];
      return query;
    },
    limit(value) {
      call.limit = value;
      return query;
    },
    then(resolve, reject) {
      harness.calls.push(call);
      const response = harness.fail
        ? { data: null, error: { message: harness.fail } }
        : { data: harness.offers, error: null };
      return Promise.resolve(response).then(resolve, reject);
    },
  };
  return query;
};

describe('biblioteca privada de tarjetas del comercio', () => {
  beforeEach(() => {
    harness.calls = [];
    harness.fail = null;
    harness.offers = [
      {
        id: 'offer-old',
        created_at: '2026-01-01T00:00:00Z',
        recommended_options: [
          {
            id: 'casco',
            title: 'Casco integral',
            price: 400,
            image_url: 'https://cdn.insforge.app/avatars/offers/recommendations/user-1/casco.jpg',
          },
        ],
      },
      {
        id: 'offer-new',
        created_at: '2026-02-01T00:00:00Z',
        recommended_options: [
          {
            id: 'casco-reciente',
            title: 'Casco integral',
            price: 480,
            image_url: 'https://cdn.insforge.app/avatars/offers/recommendations/user-1/casco.jpg',
            gift_promo: 'Guantes gratis',
            warranty: '1 año',
          },
          {
            id: 'bateria',
            title: 'Batería YTX9-BS',
            price: 1200,
            image_url: 'https://cdn.insforge.app/avatars/offers/recommendations/user-1/bateria.jpg',
          },
        ],
      },
    ];
    harness.db = {
      from(table) {
        return createQuery(table);
      },
    };
  });

  it('consulta solo las ofertas del comercio actual y reutiliza la foto guardada', async () => {
    const result = await fetchCommerceSavedRecommendations('commerce-1');

    expect(result.error).toBeNull();
    expect(result.notice).toBeNull();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: 'Casco integral',
      price: 480,
      image_url: 'https://cdn.insforge.app/avatars/offers/recommendations/user-1/casco.jpg',
      gift_promo: 'Guantes gratis',
      warranty: '1 año',
    });

    expect(harness.calls).toHaveLength(1);
    const call = harness.calls[0];
    expect(call.table).toBe('purchase_offers');
    expect(call.select).toContain('recommended_options');
    expect(call.filters).toEqual([
      ['eq', 'commerce_id', 'commerce-1'],
      ['not', 'recommended_options', 'is', null],
    ]);
    expect(call.order).toEqual(['created_at', { ascending: false }]);
    expect(call.limit).toBe(100);
  });

  it('devuelve el error de permisos sin inventar tarjetas', async () => {
    harness.fail = 'permission denied';

    const result = await fetchCommerceSavedRecommendations('commerce-1');

    expect(result.items).toEqual([]);
    expect(result.error).toMatch(/permisos/i);
  });

  it('no consulta el backend si no se identifica el comercio', async () => {
    const result = await fetchCommerceSavedRecommendations(null);

    expect(harness.calls).toHaveLength(0);
    expect(result.items).toEqual([]);
    expect(result.notice).toBe(NOTICES.commerceMetrics);
    expect(result.error).toMatch(/identificar tu comercio/i);
  });
});
