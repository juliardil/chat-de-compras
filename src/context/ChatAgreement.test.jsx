import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatProvider } from './ChatContext';
import { useChat } from './chat-context';

const harness = vi.hoisted(() => ({
  thread: null,
  order: null,
}));

vi.mock('../lib/insforge', () => ({
  isInsforgeConfigured: true,
  insforge: { database: {} },
}));

vi.mock('./auth-context', () => ({
  useAuth: () => ({ user: { id: 'buyer-1', role: 'user' } }),
}));

vi.mock('../data/appData', () => ({
  createOrderForChat: vi.fn(),
  fetchChatMessages: vi.fn(),
  fetchChatCounterpart: vi.fn(),
  fetchChatThread: vi.fn(),
  fetchOrderById: vi.fn(),
  mapChatMessage: vi.fn((row) => row),
  sendChatMessage: vi.fn(),
  updateOrderStatusForChat: vi.fn(),
}));

import {
  fetchChatCounterpart,
  fetchChatMessages,
  fetchChatThread,
  fetchOrderById,
} from '../data/appData';

function AgreementProbe() {
  const { openChat, orderInfo } = useChat();

  useEffect(() => {
    openChat('thread-1');
  }, [openChat]);

  return (
    <div>
      <span data-testid="agreement-brand">{orderInfo.brand}</span>
      <span data-testid="agreement-note">{orderInfo.optionNote}</span>
      <span data-testid="agreement-total">{String(orderInfo.total)}</span>
    </div>
  );
}

const renderAgreement = () =>
  render(
    <ChatProvider>
      <AgreementProbe />
    </ChatProvider>
  );

describe('acuerdo inicial del chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    harness.thread = {
      id: 'thread-1',
      buyer_id: 'buyer-1',
      commerce_id: 'commerce-1',
      order_id: null,
      selected_offer_option: {
        id: 'mobil',
        brand: 'Mobil',
        price: 480,
        note: 'Entrega inmediata',
      },
    };
    harness.order = null;

    fetchChatThread.mockImplementation(async () => ({
      item: harness.thread,
      error: null,
      notice: null,
    }));
    fetchChatMessages.mockResolvedValue({ items: [], error: null, notice: null });
    fetchChatCounterpart.mockResolvedValue({
      id: 'commerce-1',
      name: 'Taller Real',
      avatarUrl: null,
    });
    fetchOrderById.mockImplementation(async () => ({
      item: harness.order,
      error: null,
      notice: null,
    }));
  });

  it('muestra la marca elegida como acuerdo antes de existir el pedido', async () => {
    renderAgreement();

    expect(await screen.findByTestId('agreement-brand')).toHaveTextContent('Mobil');
    expect(screen.getByTestId('agreement-note')).toHaveTextContent('Entrega inmediata');
    expect(screen.getByTestId('agreement-total')).toHaveTextContent('480');
  });

  it('conserva la marca acordada cuando el hilo ya tiene pedido', async () => {
    harness.thread.order_id = 'order-1';
    harness.order = {
      id: 'order-1',
      order_number: 'ORD-1',
      total_amount: 450,
      currency: 'MXN',
      status: 'pending',
      snapshot: {
        product: 'Pastillas de freno',
        brand: 'Mobil',
        selectedOption: { note: 'Entrega inmediata' },
      },
    };

    renderAgreement();

    expect(await screen.findByTestId('agreement-brand')).toHaveTextContent('Mobil');
    expect(screen.getByTestId('agreement-note')).toHaveTextContent('Entrega inmediata');
    expect(screen.getByTestId('agreement-total')).toHaveTextContent('450');
  });
});
