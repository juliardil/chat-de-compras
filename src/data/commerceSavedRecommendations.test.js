import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simula un backend conectado para comprobar que la biblioteca del comercio
// solo lee sus propias ofertas, reutiliza la URL de Storage ya guardada y
// clasifica las tarjetas antiguas desde la solicitud original.
const harness = vi.hoisted(() => ({
  db: null,
  calls: [],
  offers: [],
  requests: [],
  fail: null,
  requestFail: null,
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
    in(column, values) {
      call.filters.push(['in', column, values]);
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
      const failed = table === 'purchase_requests' ? harness.requestFail : harness.fail;
      const rows = table === 'purchase_requests' ? harness.requests : harness.offers;
      const response = failed
        ? { data: null, error: { message: failed } }
        : { data: rows, error: null };
      return Promise.resolve(response).then(resolve, reject);
    },
  };
  return query;
};

describe('biblioteca privada de tarjetas del comercio', () => {
  beforeEach(() => {
    harness.calls = [];
    harness.fail = null;
    harness.requestFail = null;
    harness.offers = [
      {
        id: 'offer-old',
        request_id: 'req-casco',
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
        request_id: 'req-bateria',
        created_at: '2026-02-01T00:00:00Z',
        recommended_options: [
          {
            id: 'casco-reciente',
            title: 'Casco integral',
            price: 480,
            image_url: 'https://cdn.insforge.app/avatars/offers/recommendations/user-1/casco.jpg',
            category_group: 'cascos',
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
    harness.requests = [
      {
        id: 'req-casco',
        title: 'Casco para moto',
        items: [{ item: 'Casco integral' }],
      },
      {
        id: 'req-bateria',
        title: 'Batería para moto',
        items: [{ part_name: 'Batería YTX9-BS' }],
      },
    ];
    harness.db = {
      from(table) {
        return createQuery(table);
      },
    };
  });

  it('consulta solo las ofertas del comercio, reutiliza la foto y clasifica por grupo', async () => {
    const result = await fetchCommerceSavedRecommendations('commerce-1');

    expect(result.error).toBeNull();
    expect(result.notice).toBeNull();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: 'Casco integral',
      price: 480,
      image_url: 'https://cdn.insforge.app/avatars/offers/recommendations/user-1/casco.jpg',
      category_group: 'Cascos',
      gift_promo: 'Guantes gratis',
      warranty: '1 año',
    });
    expect(result.items[1]).toMatchObject({
      title: 'Batería YTX9-BS',
      price: 1200,
      category_group: 'Baterías',
    });

    expect(harness.calls).toHaveLength(2);
    const offersCall = harness.calls[0];
    expect(offersCall.table).toBe('purchase_offers');
    expect(offersCall.select).toContain('request_id');
    expect(offersCall.select).toContain('recommended_options');
    expect(offersCall.filters).toEqual([
      ['eq', 'commerce_id', 'commerce-1'],
      ['not', 'recommended_options', 'is', null],
    ]);
    expect(offersCall.order).toEqual(['created_at', { ascending: false }]);
    expect(offersCall.limit).toBe(100);

    const requestsCall = harness.calls[1];
    expect(requestsCall.table).toBe('purchase_requests');
    expect(requestsCall.select).toBe('id,title,items');
    expect(requestsCall.filters).toEqual([
      ['in', 'id', ['req-casco', 'req-bateria']],
    ]);
    expect(requestsCall.limit).toBe(100);
  });

  it('devuelve el error de permisos sin inventar tarjetas', async () => {
    harness.fail = 'permission denied';

    const result = await fetchCommerceSavedRecommendations('commerce-1');

    expect(result.items).toEqual([]);
    expect(result.error).toMatch(/permisos/i);
    expect(harness.calls).toHaveLength(1);
  });

  it('clasifica por el título si la solicitud original ya no es legible', async () => {
    harness.requestFail = 'permission denied';

    const result = await fetchCommerceSavedRecommendations('commerce-1');

    expect(result.error).toBeNull();
    expect(result.notice).toBeNull();
    expect(result.items.map((card) => card.category_group)).toEqual(['Cascos', 'Baterías']);
    expect(harness.calls).toHaveLength(2);
  });

  it('no consulta el backend si no se identifica el comercio', async () => {
    const result = await fetchCommerceSavedRecommendations(null);

    expect(harness.calls).toHaveLength(0);
    expect(result.items).toEqual([]);
    expect(result.notice).toBe(NOTICES.commerceMetrics);
    expect(result.error).toMatch(/identificar tu comercio/i);
  });
});
