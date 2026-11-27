import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// InsForge conectado de verdad (modo demostración neutralizado en el setup):
// las RPCs y el archivado se ejecutan contra un cliente simulado para probar el
// contrato de datos sin red. Los datos del historial siempre vienen de la RPC.
const harness = vi.hoisted(() => ({
  rpc: vi.fn(),
  writes: [],
  writeError: null,
}));

vi.mock('../lib/insforge', () => ({
  isInsforgeConfigured: true,
  avatarsBucket: 'avatars',
  get insforge() {
    return {
      database: {
        rpc: harness.rpc,
        from(table) {
          const state = { operation: null, payload: null, filters: {} };
          const query = {
            update(patch) {
              state.operation = 'update';
              state.payload = patch;
              return query;
            },
            eq(column, value) {
              state.filters[column] = value;
              return query;
            },
            then(resolve, reject) {
              if (state.operation === 'update') {
                harness.writes.push({ table, operation: state.operation, payload: state.payload, filters: state.filters });
              }
              const response = harness.writeError
                ? { data: null, error: { message: harness.writeError } }
                : { data: [{ id: state.filters.id, ...state.payload }], error: null };
              return Promise.resolve(response).then(resolve, reject);
            },
          };
          return query;
        },
      },
    };
  },
}));

import {
  archiveChatThreadForDelivery,
  fetchBuyerHistory,
  fetchChatStageBoard,
  fetchDeliveredPurchaseHistory,
  mapDeliveryHistoryItem,
  mapPurchaseHistory,
} from './appData';

const deliveredRow = (overrides = {}) => ({
  chat_id: 'chat-ent-1',
  subject: 'Bafles para Corolla',
  order_id: 'order-1',
  order_number: 'GO-100',
  total_amount: 1250.5,
  currency: 'MXN',
  order_status: 'delivered',
  delivered_at: '2026-11-20T10:00:00Z',
  delivery_confirmed_at: '2026-11-20T09:58:00Z',
  placed_at: '2026-11-18T10:00:00Z',
  last_message_at: '2026-11-20T09:50:00Z',
  commerce_id: 'commerce-1',
  commerce_name: 'Taller Real',
  buyer_id: 'buyer-1',
  seller_id: 'seller-1',
  seller_name: 'Ana Torres',
  sales_stage: 'delivered',
  lifecycle_state: 'ENTREGA_CONFIRMADA',
  rating: 5,
  review_comment: 'Llegó en tiempo y forma',
  delivered_on_time: true,
  recent_messages: [
    {
      sender_type: 'system',
      sender_name: 'Sistema',
      body: 'Entrega confirmada',
      created_at: '2026-11-20T09:58:00Z',
    },
  ],
  reviews: [
    {
      id: 'review-1',
      rating: 5,
      comment: 'Excelente servicio',
      status: 'approved',
      created_at: '2026-11-20T10:30:00Z',
    },
  ],
  ...overrides,
});

const readMigration = (name) =>
  readFileSync(join(process.cwd(), 'migrations', name), 'utf8');

beforeEach(() => {
  harness.rpc.mockReset();
  harness.writes.length = 0;
  harness.writeError = null;
});

describe('tablero de etapas con backend real', () => {
  it('usa el contador de entregados de la RPC, incluidos los hilos archivados', async () => {
    harness.rpc.mockResolvedValue({
      data: [{
        counts: { negotiating: '3', pending: '1', delivered: '2' },
        stages: { 'chat-activo-1': 'negotiating', 'chat-activo-2': 'pending' },
        deliveredIds: ['chat-ent-1', 'chat-ent-2', 42],
      }],
      error: null,
    });

    const board = await fetchChatStageBoard();

    expect(harness.rpc).toHaveBeenCalledWith('app_chat_stage_board', {});
    expect(board.counts).toEqual({ negotiating: 3, pending: 1, delivered: 2 });
    expect(board.stages).toEqual({ 'chat-activo-1': 'negotiating', 'chat-activo-2': 'pending' });
    expect(board.deliveredIds).toEqual(['chat-ent-1', 'chat-ent-2']);
    expect(board.error).toBeNull();
  });

  it('mantiene ceros explícitos si la RPC falla', async () => {
    harness.rpc.mockRejectedValue(new Error('sin acceso al tablero'));

    const board = await fetchChatStageBoard();

    expect(board.counts).toEqual({ negotiating: 0, pending: 0, delivered: 0 });
    expect(board.stages).toEqual({});
    expect(board.deliveredIds).toEqual([]);
    expect(board.error).toBeTruthy();
  });
});

describe('historial real de entregas', () => {
  it('traduce columnas reales sin inventar importes ni calificaciones', () => {
    const item = mapDeliveryHistoryItem(deliveredRow());
    expect(item).toMatchObject({
      chatId: 'chat-ent-1',
      orderNumber: 'GO-100',
      total: 1250.5,
      currency: 'MXN',
      status: 'delivered',
      deliveredAt: '2026-11-20T10:00:00Z',
      store: 'Taller Real',
      seller: 'Ana Torres',
      sellerId: 'seller-1',
      rating: 5,
      lifecycleState: 'ENTREGA_CONFIRMADA',
      deliveredOnTime: true,
    });
    expect(item.messages[0]).toMatchObject({ sender: 'system', text: 'Entrega confirmada' });
    expect(item.reviews[0]).toMatchObject({ stars: 5, comment: 'Excelente servicio' });

    const withoutNumbers = mapDeliveryHistoryItem({
      chat_id: 'chat-ent-2',
      total_amount: null,
      rating: 'no-numero',
      reviews: [{ rating: null, comment: 'sin estrellas' }],
    });
    expect(withoutNumbers.total).toBeNull();
    expect(withoutNumbers.rating).toBeNull();
    expect(withoutNumbers.reviews).toEqual([]);
    expect(mapDeliveryHistoryItem(null)).toBeNull();
  });

  it('consulta la RPC con límite para comprador, comercio y vendedor por igual', async () => {
    harness.rpc.mockResolvedValue({
      data: {
        items: [
          deliveredRow(),
          deliveredRow({
            chat_id: 'chat-ent-2',
            order_id: 'order-2',
            commerce_name: 'Taller Norte',
            seller_name: 'Luis Pérez',
            buyer_id: 'buyer-2',
            rating: 4,
            reviews: [{ id: 'review-2', rating: 4, comment: 'Buen precio' }],
          }),
        ],
        total: 2,
      },
      error: null,
    });

    const history = await fetchDeliveredPurchaseHistory(7);
    const buyerHistory = await fetchBuyerHistory();

    // El alcance por rol se resuelve en SQL; el cliente no envía ni el usuario
    // ni el comercio: las tres partes consumen exactamente la misma RPC.
    expect(harness.rpc).toHaveBeenCalledWith('app_delivered_purchase_history', { p_limit: 7 });
    expect(harness.rpc).toHaveBeenCalledWith('app_delivered_purchase_history', { p_limit: 50 });
    expect(history.total).toBe(2);
    expect(history.items).toHaveLength(2);
    expect(history.items[0].seller).toBe('Ana Torres');
    expect(history.items[1]).toMatchObject({ store: 'Taller Norte', seller: 'Luis Pérez' });
    expect(buyerHistory.item.totalPurchases).toBe(2);
    expect(buyerHistory.item.reviews).toHaveLength(2);
    expect(buyerHistory.item.rating).toBe(4.5);
    expect(buyerHistory.item.reviews[0].seller).toBe('Taller Real');
    expect(buyerHistory.item.reviews[1].seller).toBe('Taller Norte');
    expect(buyerHistory.item.purchases[1]).toMatchObject({
      id: 'order-2',
      product: 'Bafles para Corolla',
      store: 'Taller Norte',
      seller: 'Luis Pérez',
    });
  });

  it('devuelve vacío explícito cuando el backend rechaza la consulta', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: { message: 'permiso denegado' } });

    const history = await fetchDeliveredPurchaseHistory();
    const buyerHistory = await fetchBuyerHistory();

    expect(history.items).toEqual([]);
    expect(history.error).toBeTruthy();
    expect(history.notice).toBeTruthy();
    expect(buyerHistory.item).toBeNull();
  });

  it('no calcula un promedio con reseñas sin estrellas', () => {
    const history = mapPurchaseHistory({
      items: [deliveredRow({ rating: null, reviews: [{ rating: null, comment: 'sin calificar' }] })],
    });
    expect(history.rating).toBeNull();
    expect(history.totalPurchases).toBe(1);
  });
});

describe('regresión de confirmación de entrega', () => {
  it('archiva solo el chat confirmado y deja mensajes y pedido intactos', async () => {
    const result = await archiveChatThreadForDelivery('chat-ent-1');

    expect(result.ok).toBe(true);
    expect(harness.writes).toHaveLength(1);
    expect(harness.writes[0]).toMatchObject({
      table: 'chat_threads',
      operation: 'update',
      filters: { id: 'chat-ent-1' },
    });
    expect(harness.writes[0].payload).toMatchObject({ status: 'archived' });
    expect(harness.writes[0].payload.delivery_confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(harness.writes[0].payload.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('propaga el error de archivado y exige un chat', async () => {
    harness.writeError = 'no se pudo archivar';
    await expect(archiveChatThreadForDelivery('chat-ent-1')).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('no se pudo archivar'),
    });
    await expect(archiveChatThreadForDelivery(null)).resolves.toMatchObject({
      ok: false,
      error: /conversación/,
    });
  });

  it('conserva el contrato SQL de ENTREGA_CONFIRMADA y su trazabilidad', () => {
    const lifecycle = readMigration('20261124034428_offer-lifecycle-reputation.sql');
    const archive = readMigration('20261124194500_archive-confirmed-deliveries.sql');

    expect(lifecycle).toContain('create or replace function public.app_confirm_lifecycle_delivery(p_chat_id uuid)');
    expect(lifecycle).toMatch(/set lifecycle_state = 'ENTREGA_CONFIRMADA'/);
    expect(lifecycle).toContain('delivery_confirmed_at = now()');
    expect(lifecycle).toContain('perform public.app_lifecycle_system_message(');
    expect(lifecycle).toContain('El comprador confirmó que llegó el pedido.');

    // El trigger sigue siendo BEFORE INSERT/UPDATE y el historial no se toca.
    expect(archive).toContain('before insert or update on public.chat_threads');
    expect(archive).toContain("NEW.status := 'archived'");
    expect(archive).toContain("where ct.sales_stage = 'delivered'");
  });

  it('mantiene la migración nueva idempotente y con alcance por rol', () => {
    const sql = readMigration('20261127155638_delivered-history-access.sql');

    expect(sql).toContain('create or replace function public.app_chat_stage_board()');
    expect(sql).toContain('create or replace function public.app_delivered_purchase_history');
    expect(sql).toContain('create index if not exists chat_threads_buyer_sales_stage_idx');
    expect(sql).toContain("jsonb_set(v_counts, '{delivered}', to_jsonb(v_delivered_count))");
    expect(sql).toContain('public.app_lifecycle_current_commerce_id()');
    expect(sql).toContain('public.app_lifecycle_current_buyer_id()');
    expect(sql).toContain("public.admin_has_permission('chats.access_content')");
    expect(sql).not.toMatch(/drop\s+function\s+public\.app_confirm_lifecycle_delivery/i);
    expect(sql).toContain("grant execute on function public.app_chat_stage_board() to authenticated");
  });
});
