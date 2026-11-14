import { describe, expect, it } from 'vitest';
import {
  calculateDistanceKm,
  describeError,
  fetchBuyerOrders,
  formatDistance,
  fetchBuyerRequests,
  fetchNotifications,
  createOrderForChat,
  createPurchaseRequest,
  mapChatMessage,
  mapChatThread,
  mapOffer,
  mapOpportunity,
  mapOrder,
  mapRequest,
  mapRequestItem,
  splitOrders,
  updateOrderStatusForChat,
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

  it('no registra pedidos sin backend', async () => {
    const order = await createOrderForChat({
      chatId: 'thread-1',
      shipping: { name: 'Luis' },
    });
    expect(order).toMatchObject({ ok: false, skipped: true, orderId: null });

    const update = await updateOrderStatusForChat({
      chatId: 'thread-1',
      status: 'shipped',
    });
    expect(update).toMatchObject({ ok: false, skipped: true });
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

  it('normaliza los campos técnicos y la cantidad de cada ítem', () => {
    const item = mapRequestItem({
      id: 7,
      category: 'Frenos',
      item: 'Pastillas de freno',
      vehicleType: 'Auto',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Corolla',
      yearFrom: 2015,
      yearTo: 2020,
      reference: '04465-02060',
      brand: 'Bosch',
      condition: 'Nuevo',
      quantity: '4',
      notes: 'Delanteras',
      images: ['data:image/jpeg;base64,AAA'],
    });

    expect(item).toMatchObject({
      key: 7,
      category: 'Frenos',
      product: 'Pastillas de freno',
      vehicleType: 'Auto',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Corolla',
      yearFrom: 2015,
      yearTo: 2020,
      reference: '04465-02060',
      brand: 'Bosch',
      condition: 'Nuevo',
      quantity: 4,
      notes: 'Delanteras',
      images: ['data:image/jpeg;base64,AAA'],
    });
  });

  it('acepta claves antiguas y conserva la cantidad como texto', () => {
    const item = mapRequestItem({
      name: 'Bujes',
      cantidad: '3',
      vehicle_brand: 'Ford',
      vehicle_model: 'Fiesta',
      part_number: 'BUJ-1',
    });

    expect(item.product).toBe('Bujes');
    expect(item.quantity).toBe(3);
    expect(item.vehicleBrand).toBe('Ford');
    expect(item.vehicleModel).toBe('Fiesta');
    expect(item.reference).toBe('BUJ-1');
    // Sin cantidad guardada se asume 1 unidad (nunca 0 ni NaN).
    expect(mapRequestItem({ item: 'Filtro' }).quantity).toBe(1);
    expect(mapRequestItem({ item: 'Filtro', quantity: '0' }).quantity).toBe(1);
  });

  it('expone la cantidad y las imágenes en la oportunidad del comercio', () => {
    const row = {
      id: 'req-2',
      title: 'Bafles',
      description: 'Bafles traseros',
      budget_amount: 2000,
      currency: 'MXN',
      created_at: new Date().toISOString(),
      items: [
        {
          id: 1,
          category: 'Audio y Sonido',
          item: 'Bafles',
          vehicleBrand: 'Toyota',
          vehicleModel: 'Corolla',
          quantity: '2',
          images: ['data:image/jpeg;base64,AAA'],
        },
        { id: 2, item: 'Amplificador', cantidad: 3 },
      ],
    };

    const request = mapRequest(row);
    expect(request.items.map((item) => item.quantity)).toEqual([2, 3]);

    const opportunity = mapOpportunity(row);
    expect(opportunity.items).toHaveLength(2);
    expect(opportunity.items[0]).toMatchObject({
      product: 'Bafles',
      category: 'Audio y Sonido',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Corolla',
      quantity: 2,
      images: ['data:image/jpeg;base64,AAA'],
    });
    expect(opportunity.items[1]).toMatchObject({ product: 'Amplificador', quantity: 3 });
    expect(opportunity.quantityTotal).toBe(5);
    expect(opportunity.image).toBe('data:image/jpeg;base64,AAA');
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
      items: [
        {
          name: 'Pastillas',
          quantity: 2,
          available: true,
          unitPrice: 150,
          totalPrice: 300,
          notes: 'Delanteras',
        },
        { name: 'Discos', cantidad: '1', available: false },
      ],
    });

    expect(offer.store).toBe('Taller Real');
    expect(offer.commerceId).toBeNull();
    expect(offer.found).toBe(1);
    expect(offer.total).toBe(2);
    expect(offer.quantityTotal).toBe(2);
    expect(offer.items[0]).toMatchObject({
      name: 'Pastillas',
      quantity: 2,
      status: 'available',
      unitPrice: 150,
      totalPrice: 300,
      notes: 'Delanteras',
    });
    expect(offer.items[0].priceLabel).toContain('300');
    expect(offer.items[1]).toMatchObject({
      name: 'Discos',
      quantity: 1,
      status: 'missing',
      unitPrice: 0,
      totalPrice: 0,
      priceLabel: '',
      notes: '',
    });

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

  it('traduce los mensajes del backend a burbujas de comprador y comercio', () => {
    const createdAt = new Date().toISOString();

    expect(
      mapChatMessage({
        id: 'm1',
        sender_type: 'buyer',
        sender_name: 'Juliana',
        body: '¿Está disponible?',
        created_at: createdAt,
      })
    ).toMatchObject({ text: '¿Está disponible?', sender: 'buyer', senderName: 'Juliana' });

    expect(
      mapChatMessage({
        id: 'm2',
        sender_type: 'commerce',
        body: 'Sí, lo tengo',
        created_at: createdAt,
      })
    ).toMatchObject({ text: 'Sí, lo tengo', sender: 'seller' });

    expect(
      mapChatMessage({ id: 'm3', sender_type: 'system', body: 'Aviso', created_at: createdAt })
    ).toMatchObject({ text: 'Aviso', sender: 'system' });
  });

  it('calcula la distancia real con Haversine y no inventa valores', () => {
    // CDMX → Guadalajara: la distancia en línea recta ronda los 460 km.
    const cdmxToGuadalajara = calculateDistanceKm(19.4326, -99.1332, 20.6597, -103.3496);
    expect(cdmxToGuadalajara).toBeGreaterThan(450);
    expect(cdmxToGuadalajara).toBeLessThan(475);

    // Sin coordenadas, con valores inválidos o fuera de rango, no hay distancia.
    expect(calculateDistanceKm(null, null, 19.4326, -99.1332)).toBeNull();
    expect(calculateDistanceKm(19.4326, -99.1332, undefined, undefined)).toBeNull();
    expect(calculateDistanceKm(19.4326, -99.1332, 'no-es-numero', -99.1332)).toBeNull();
    expect(calculateDistanceKm(120, -99.1332, 19.4326, -99.1332)).toBeNull();
    expect(calculateDistanceKm(19.4326, 250, 19.4326, -99.1332)).toBeNull();
  });

  it('formatea la distancia en metros o kilómetros', () => {
    expect(formatDistance(0.2)).toBe('200 m');
    expect(formatDistance(0.024)).toBe('50 m');
    expect(formatDistance(2.7799)).toBe('2.8 km');
    expect(formatDistance(12.4)).toBe('12 km');
    expect(formatDistance(null)).toBe('');
    expect(formatDistance(-3)).toBe('');
  });

  it('mapea la distancia y la confiabilidad reales de cada oferta', () => {
    const nearby = mapOffer(
      {
        id: 'offer-geo',
        request_id: 'req-1',
        commerce_name: 'Taller Cercano',
        total_amount: 500,
        currency: 'MXN',
        commerce_latitude: 19.4576,
        commerce_longitude: -99.1332,
        commerce_rating: 4.5,
        commerce_rating_count: 12,
        items: [],
      },
      { latitude: 19.4326, longitude: -99.1332 }
    );

    expect(nearby.amount).toBe(500);
    expect(nearby.distanceKm).toBeCloseTo(2.78, 1);
    expect(nearby.distanceLabel).toBe('2.8 km');
    expect(nearby.rating).toBe(4.5);
    expect(nearby.ratingCount).toBe(12);

    // Comercio sin coordenadas ni reseñas: no se muestra distancia ni nota,
    // aunque el comprador sí tenga ubicación (null no debe convertirse en 0,0).
    const unknown = mapOffer(
      {
        id: 'offer-unknown',
        total_amount: 100,
        commerce_latitude: null,
        commerce_longitude: null,
        items: [],
      },
      { latitude: 19.4326, longitude: -99.1332 }
    );
    expect(unknown.distanceKm).toBeNull();
    expect(unknown.distanceLabel).toBe('');
    expect(unknown.rating).toBeNull();
    expect(unknown.ratingCount).toBe(0);
  });
});
