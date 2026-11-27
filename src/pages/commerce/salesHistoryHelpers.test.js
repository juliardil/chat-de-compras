import { describe, expect, it } from 'vitest';
import {
  SALES_FILTERS,
  buildSalesCsv,
  buildSalesJson,
  filterSales,
  filterSalesLabel,
  normalizeSale,
  saleDate,
} from './salesHistoryHelpers';

const NOW = new Date('2026-11-27T12:00:00.000Z');

const sale = (overrides) => ({
  id: overrides.id,
  order_number: overrides.order_number || overrides.id,
  status: overrides.status,
  total_amount: overrides.total_amount ?? 100,
  currency: 'MXN',
  created_at: overrides.created_at,
  completed_at: overrides.completed_at || null,
  delivered_at: overrides.delivered_at || null,
  placed_at: overrides.placed_at || null,
  confirmed_at: overrides.confirmed_at || null,
  snapshot: overrides.snapshot || { product: overrides.product },
  items: overrides.items || [],
  sold_by_name: overrides.sold_by_name || '',
});

const transactions = [
  sale({
    id: 'order-1',
    product: 'Bafles',
    status: 'completed',
    total_amount: 1000,
    created_at: '2026-11-27T09:00:00.000Z',
    sold_by_name: 'Sofía',
  }),
  sale({
    id: 'order-2',
    product: 'Amplificador',
    status: 'delivered',
    total_amount: 2000,
    created_at: '2026-11-17T09:00:00.000Z',
  }),
  sale({
    id: 'order-3',
    product: 'Luces',
    status: 'pending',
    total_amount: 500,
    created_at: '2026-11-26T09:00:00.000Z',
  }),
  sale({
    id: 'order-4',
    product: 'Neumático',
    status: 'shipped',
    total_amount: 700,
    created_at: '2026-11-07T09:00:00.000Z',
  }),
  sale({
    id: 'order-5',
    product: 'Cancelado',
    status: 'cancelled',
    total_amount: 300,
    created_at: '2026-11-25T09:00:00.000Z',
  }),
].map(normalizeSale);

describe('helpers del historial de ventas', () => {
  it('normaliza pedidos reales sin inventar datos ausentes', () => {
    expect(saleDate({ created_at: '2026-11-27T09:00:00Z' })).toBe('2026-11-27T09:00:00Z');

    const [first] = transactions;
    expect(first).toMatchObject({
      id: 'order-1',
      orderNumber: 'order-1',
      product: 'Bafles',
      statusKey: 'completed',
      statusLabel: 'Completado',
      amount: 1000,
      currency: 'MXN',
      seller: 'Sofía',
      dateIso: '2026-11-27T09:00:00.000Z',
    });
    expect(first.amountLabel).toContain('1,000');

    const withoutData = normalizeSale({ id: 'order-x', order_number: 'order-x', status: 'unknown' });
    expect(withoutData).toMatchObject({
      product: 'order-x',
      statusLabel: 'unknown',
      amount: 0,
      seller: '',
      dateIso: null,
    });
    expect(withoutData.items).toEqual([]);
  });

  it('filtra por estado y fecha sobre los datos visibles', () => {
    expect(filterSales(transactions, 'all', NOW)).toHaveLength(5);
    expect(filterSales(transactions, 'done', NOW).map((tx) => tx.id)).toEqual([
      'order-1',
      'order-2',
    ]);
    expect(filterSales(transactions, 'pending', NOW).map((tx) => tx.id)).toEqual([
      'order-3',
      'order-4',
    ]);
    expect(filterSales(transactions, 'today', NOW).map((tx) => tx.id)).toEqual(['order-1']);
    expect(filterSales(transactions, 'last7', NOW).map((tx) => tx.id)).toEqual([
      'order-1',
      'order-3',
      'order-5',
    ]);
    expect(filterSales(transactions, 'last30', NOW)).toHaveLength(5);
    expect(filterSales(transactions, 'unknown', NOW)).toHaveLength(5);
  });

  it('exporta CSV y JSON solo con las transacciones filtradas', () => {
    const filtered = filterSales(transactions, 'done', NOW);
    const csv = buildSalesCsv(filtered, 'done');

    expect(csv).toContain('# Filtro: Entregadas y confirmadas');
    expect(csv).toContain('Pedido,Producto,Fecha,Estado,Monto,Moneda,Vendedor,Artículos');
    expect(csv).toContain('Bafles');
    expect(csv).toContain('Amplificador');
    expect(csv).not.toContain('Luces');
    expect(csv).not.toContain('Cancelado');

    const parsed = JSON.parse(buildSalesJson(filtered, 'done'));
    expect(parsed).toMatchObject({
      filtro: 'Entregadas y confirmadas',
      total: 2,
    });
    expect(parsed.transacciones.map((row) => row.producto)).toEqual([
      'Bafles',
      'Amplificador',
    ]);
    expect(parsed.transacciones[0].vendedor).toBe('Sofía');
  });

  it('expone etiquetas estables para todas las opciones del menú', () => {
    expect(SALES_FILTERS.map((filter) => filter.key)).toEqual([
      'all',
      'done',
      'pending',
      'today',
      'last7',
      'last30',
    ]);
    expect(filterSalesLabel('last30')).toBe('Últimos 30 días');
    expect(filterSalesLabel('desconocido')).toBe('Todas las transacciones');
  });
});
