import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createInsforgeRepository } from '../insforgeRepository.js';

const rpc = vi.fn();
const repository = createInsforgeRepository({ database: { rpc } });

describe('createInsforgeRepository admin sellers', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('lists sellers via the admin RPC', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          membership_id: 'm-1',
          user_id: 'u-1',
          full_name: 'Vendedor Uno',
          email: 'uno@example.com',
          commerce_id: 'c-1',
          commerce_name: 'Comercio Uno',
          avatar_url: null,
          is_active: true,
          role: 'seller',
          offers_sent: 2,
          sales_closed: 1,
          sales_amount: 150.5,
          rating: 4.5,
          chat_count: 3,
          message_count: 5,
          joined_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const result = await repository.listAdminSellers({ search: 'Comercio Uno' });
    expect(rpc).toHaveBeenCalledWith('admin_list_sellers', { p_search: 'Comercio Uno' });
    expect(result[0]).toMatchObject({
      id: 'm-1',
      userId: 'u-1',
      fullName: 'Vendedor Uno',
      email: 'uno@example.com',
      commerceName: 'Comercio Uno',
      salesClosed: 1,
      chatCount: 3,
      isActive: true,
    });
  });

  it('fetches seller detail with sales and chats', async () => {
    rpc.mockResolvedValue({
      data: {
        seller: { membership_id: 'm-2', full_name: 'Vendedor Dos' },
        sales: [{ order_id: 'o-1', total_amount: 99 }],
        chats: [{ chat_id: 'ch-1', buyer_name: 'Compradora' }],
      },
      error: null,
    });

    const result = await repository.getAdminSellerDetail({ sellerId: 'm-2' });
    expect(rpc).toHaveBeenCalledWith('admin_get_seller_detail', { p_membership_id: 'm-2' });
    expect(result.sales[0].orderId).toBe('o-1');
    expect(result.chats[0].buyerName).toBe('Compradora');
  });

  it('sets seller active state via the audited RPC', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await repository.setSellerActive({ sellerId: 'm-3', isActive: false });
    expect(rpc).toHaveBeenCalledWith('admin_set_seller_active', {
      p_membership_id: 'm-3',
      p_is_active: false,
      p_reason: null,
      p_reason_code: null,
    });
  });

  it('throws RPC errors with a readable message', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sin permisos' } });

    await expect(repository.listAdminSellers()).rejects.toThrow('sin permisos');
  });
});
