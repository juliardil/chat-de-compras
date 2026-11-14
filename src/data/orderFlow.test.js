import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simula InsForge conectado para probar el flujo real de pedidos sin tocar la
// base. Cada consulta del SDK se resuelve según la tabla y la operación.
const harness = vi.hoisted(() => ({
  db: null,
  writes: [],
}));

vi.mock('../lib/insforge', () => ({
  isInsforgeConfigured: true,
  get insforge() {
    return { database: harness.db };
  },
}));

const { createOrderForChat, updateOrderStatusForChat } = await import('./appData');

const createQuery = (table, state) => {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    in() {
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    insert(rows) {
      state.operation = 'insert';
      state.payload = rows;
      return query;
    },
    update(patch) {
      state.operation = 'update';
      state.payload = patch;
      return query;
    },
    then(resolve, reject) {
      if (state.fail) {
        return Promise.resolve({ data: null, error: { message: state.fail } }).then(
          resolve,
          reject
        );
      }

      if (state.operation === 'insert' || state.operation === 'update') {
        harness.writes.push({
          table,
          operation: state.operation,
          payload: state.payload,
        });
      }

      let data = [];

      if (table === 'chat_threads') {
        const thread = harness.threads[0];
        data = thread
          ? [{ ...thread, ...(state.operation === 'update' ? state.payload : {}) }]
          : [];
      } else if (table === 'purchase_offers') {
        data = harness.offer ? [harness.offer] : [];
      } else if (table === 'purchase_requests') {
        data = harness.requests || [];
      } else if (table === 'commerce_profiles') {
        data = harness.commerce ? [harness.commerce] : [];
      } else if (table === 'purchase_orders') {
        if (state.operation === 'insert') {
          data = state.payload.map((row, index) => ({
            id: `order-${index + 1}`,
            ...row,
          }));
        } else {
          data = harness.orders;
        }
      }

      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };

  return query;
};

const createDb = () =>
  ({
    from(table) {
      return createQuery(table, { operation: 'select', payload: null, fail: null });
    },
  });

const shipping = {
  name: 'Luis',
  phone: '55 1234 5678',
  street: 'Av. Reforma 10',
  interior: '',
  neighborhood: 'Centro',
  city: 'CDMX',
  references: 'Portón negro',
};

describe('pedido creado desde el chat', () => {
  beforeEach(() => {
    harness.writes = [];
    harness.threads = [
      {
        id: 'thread-1',
        buyer_id: 'buyer-1',
        commerce_id: 'commerce-1',
        offer_id: 'offer-1',
        order_id: null,
      },
    ];
    harness.offer = {
      id: 'offer-1',
      request_id: 'request-1',
      commerce_id: 'commerce-1',
      total_amount: 500,
      currency: 'MXN',
      items: [
        { name: 'Bafles', quantity: 2, available: true, unitPrice: 250, totalPrice: 500 },
      ],
    };
    harness.commerce = { id: 'commerce-1', trade_name: 'go.go' };
    harness.requests = [];
    harness.orders = [];
    harness.db = createDb();
  });

  it('registra el pedido con la oferta real y lo vincula al hilo', async () => {
    const result = await createOrderForChat({ chatId: 'thread-1', shipping });

    expect(result).toMatchObject({ ok: true, orderId: 'order-1', commerceId: 'commerce-1' });

    const insert = harness.writes.find(
      (write) => write.table === 'purchase_orders' && write.operation === 'insert'
    );
    expect(insert).toBeTruthy();

    const order = insert.payload[0];
    expect(order).toMatchObject({
      offer_id: 'offer-1',
      request_id: 'request-1',
      buyer_id: 'buyer-1',
      commerce_id: 'commerce-1',
      status: 'pending',
      total_amount: 500,
      currency: 'MXN',
    });
    expect(order.order_number).toMatch(/^ORD-\d{8}-[A-Z0-9]{6}$/);
    expect(order.snapshot).toMatchObject({
      product: 'Bafles',
      store: 'go.go',
      address: 'Av. Reforma 10, Centro, CDMX',
      shipping: { name: 'Luis', phone: '55 1234 5678' },
    });
    expect(order.items).toHaveLength(1);

    const link = harness.writes.find(
      (write) => write.table === 'chat_threads' && write.operation === 'update'
    );
    expect(link.payload).toEqual({ order_id: 'order-1', offer_id: 'offer-1' });
  });

  it('reutiliza el pedido existente en lugar de crear otro', async () => {
    harness.threads[0].order_id = 'order-existente';

    const result = await createOrderForChat({ chatId: 'thread-1', shipping });

    expect(result).toMatchObject({ ok: true, existing: true, orderId: 'order-existente' });
    expect(
      harness.writes.some((write) => write.table === 'purchase_orders')
    ).toBe(false);
  });

  it('registra una compra nueva si el hilo se abrió desde otra oferta', async () => {
    harness.threads[0].order_id = 'order-1';
    harness.threads[0].offer_id = 'offer-2';
    harness.orders = [{ id: 'order-1', offer_id: 'offer-1' }];
    harness.offer = {
      id: 'offer-2',
      request_id: 'request-2',
      commerce_id: 'commerce-1',
      total_amount: 25,
      currency: 'MXN',
      items: [],
    };

    const result = await createOrderForChat({ chatId: 'thread-1', shipping });

    expect(result.ok).toBe(true);
    expect(result.existing).toBeUndefined();

    const insert = harness.writes.find(
      (write) => write.table === 'purchase_orders' && write.operation === 'insert'
    );
    expect(insert.payload[0].offer_id).toBe('offer-2');
    expect(insert.payload[0].total_amount).toBe(25);
  });

  it('no inventa un pedido si la conversación no tiene oferta', async () => {
    harness.threads[0].offer_id = null;

    const result = await createOrderForChat({ chatId: 'thread-1', shipping });

    expect(result).toMatchObject({ ok: true, skipped: true, orderId: null });
    expect(harness.writes).toHaveLength(0);
  });

  it('recupera la oferta real más reciente si el hilo no la tiene', async () => {
    harness.threads[0].offer_id = null;
    harness.requests = [{ id: 'request-1' }];

    const result = await createOrderForChat({ chatId: 'thread-1', shipping });

    expect(result.ok).toBe(true);

    const insert = harness.writes.find(
      (write) => write.table === 'purchase_orders' && write.operation === 'insert'
    );
    expect(insert.payload[0]).toMatchObject({
      offer_id: 'offer-1',
      request_id: 'request-1',
    });

    const link = harness.writes.find(
      (write) => write.table === 'chat_threads' && write.operation === 'update'
    );
    expect(link.payload).toEqual({ order_id: 'order-1', offer_id: 'offer-1' });
  });

  it('propaga el error si el backend rechaza el pedido', async () => {
    harness.db = {
      from(table) {
        return createQuery(table, {
          operation: 'select',
          payload: null,
          fail: table === 'purchase_orders' ? 'new row violates row-level security policy' : null,
        });
      },
    };

    const result = await createOrderForChat({ chatId: 'thread-1', shipping });

    expect(result.ok).toBe(false);
    expect(result.orderId).toBeNull();
    expect(result.error).toMatch(/permisos/i);
  });

  it('actualiza el estado del pedido vinculado a la conversación', async () => {
    harness.threads[0].order_id = 'order-1';

    const result = await updateOrderStatusForChat({
      chatId: 'thread-1',
      status: 'delivered',
      patch: { delivered_at: '2026-11-14T20:00:00.000Z' },
    });

    expect(result).toMatchObject({ ok: true, orderId: 'order-1' });

    const update = harness.writes.find(
      (write) => write.table === 'purchase_orders' && write.operation === 'update'
    );
    expect(update.payload).toEqual({
      status: 'delivered',
      delivered_at: '2026-11-14T20:00:00.000Z',
    });
  });

  it('no actualiza nada si la conversación aún no tiene pedido', async () => {
    const result = await updateOrderStatusForChat({ chatId: 'thread-1', status: 'shipped' });

    expect(result).toMatchObject({ ok: true, skipped: true });
    expect(harness.writes).toHaveLength(0);
  });
});
