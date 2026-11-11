import { describe, expect, it } from 'vitest';
import {
  describeError,
  fetchBuyerOrders,
  fetchBuyerRequests,
  fetchNotifications,
  createPurchaseRequest,
  mapChatThread,
  mapOffer,
  mapOrder,
  mapRequest,
  splitOrders,
  NOTICES,
} from './appData';

// La suite corre sin InsForge (src/test/setup.js), así que todas las lecturas
// deben resolver a listas vacías con un aviso explícito, nunca a datos de ejemplo.
describe('capa de datos de la app', () => {
  it('devuelve listas vacías con aviso en modo demostración', async () => {
    const requests = await fetchBuyerRequests('user-1');
    expect(requests.items).toEqual([]);
    expect(requests.notice).toBe(NOTICES.demo);

    const orders = await fetchBuyerOrders('user-1');
    expect(orders.items).toEqual([]);
    expect(orders.notice).toBe(NOTICES.demo);

    const notifications = await fetchNotifications();
    expect(notifications.items).toEqual([]);
    expect(notifications.notice).toBe(NOTICES.notifications);
  });

  it('no simula éxito al escribir sin backend', async () => {
    const result = await createPurchaseRequest({ title: 'Prueba' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No se guardó nada');
  });

  it('traduce errores de permisos y de red', () => {
    expect(describeError({ statusCode: 403 })).toMatch(/permisos/i);
    expect(describeError({ message: 'new row violates row-level security policy' })).toMatch(
      /permisos/i
    );
    expect(describeError({ message: 'Failed to fetch' })).toMatch(/conectar/i);
    expect(describeError(null, 'Respaldo')).toBe('Respaldo');
  });

  it('mapea solicitudes con los estados reales del backend', () => {
    const request = mapRequest({
      id: 'req-1',
      title: 'Frenos delanteros',
      description: 'Pastillas para Corolla',
      status: 'open',
      currency: 'MXN',
      budget_amount: 1500,
      created_at: new Date().toISOString(),
    });

    expect(request.statusLabel).toBe('Recibiendo ofertas');
    expect(request.budget).toContain('1,500');
    expect(request.offers).toBeNull();
  });

  it('mapea ofertas y pedidos usando las columnas snake_case', () => {
    const offer = mapOffer({
      id: 'offer-1',
      request_id: 'req-1',
      commerce_name: 'Taller Real',
      total_amount: 900,
      currency: 'MXN',
      delivery_days: 2,
      conditions: 'Pago contra entrega',
      items: [{ name: 'Pastillas', available: true }],
    });

    expect(offer.store).toBe('Taller Real');
    expect(offer.found).toBe(1);
    expect(offer.total).toBe(1);

    const order = mapOrder({
      id: 'order-12345678',
      order_number: 'ORD-1',
      status: 'preparing',
      total_amount: 1200,
      currency: 'MXN',
      snapshot: { product: 'Bujías', store: 'Auto Real' },
      placed_at: new Date().toISOString(),
    });

    expect(order.number).toBe('ORD-1');
    expect(order.statusLabel).toBe('En preparación');
    expect(order.product).toBe('Bujías');
    expect(order.active).toBe(true);

    const { active, completed } = splitOrders([
      mapOrder({ id: 'a', status: 'preparing', order_number: 'A' }),
      mapOrder({ id: 'b', status: 'completed', order_number: 'B' }),
    ]);
    expect(active).toHaveLength(1);
    expect(completed).toHaveLength(1);
  });

  it('mapea conversaciones con las columnas reales de chat_threads', () => {
    const thread = mapChatThread({
      id: 'thread-1',
      subject: 'Consulta de precio',
      status: 'active',
      last_message_at: new Date().toISOString(),
    });

    expect(thread.subject).toBe('Consulta de precio');
    expect(thread.status).toBe('active');
    expect(thread.unread).toBe(0);
  });
});
