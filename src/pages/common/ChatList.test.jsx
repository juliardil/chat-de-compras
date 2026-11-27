import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatList from './ChatList';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchChatThreads: vi.fn(),
    fetchChatStageBoard: vi.fn(),
    fetchDeliveredPurchaseHistory: vi.fn(),
  };
});

import { fetchChatStageBoard, fetchChatThreads, fetchDeliveredPurchaseHistory } from '../../data/appData';

const threads = [
  {
    id: 'chat-neg-1',
    subject: 'Consulta de precio',
    counterpart_name: 'Taller Uno',
    status: 'active',
    sales_stage: 'negotiating',
    last_message_at: new Date().toISOString(),
  },
  {
    id: 'chat-neg-2',
    subject: 'Bafles',
    counterpart_name: 'Taller Dos',
    status: 'active',
    sales_stage: 'negotiating',
    last_message_at: new Date().toISOString(),
  },
  {
    id: 'chat-pend',
    subject: 'Aceite',
    counterpart_name: 'Taller Tres',
    status: 'active',
    sales_stage: 'pending',
    last_message_at: new Date().toISOString(),
  },
  {
    id: 'chat-ent',
    subject: 'Pastillas',
    counterpart_name: 'Taller Cuatro',
    status: 'archived',
    sales_stage: 'delivered',
    last_message_at: new Date().toISOString(),
  },
];

const stageBoard = {
  // El contador viene de la RPC: dos entregas reales aunque la bandeja activa
  // solo traiga un hilo archivado en este fixture.
  counts: { negotiating: 2, pending: 1, delivered: 2 },
  stages: Object.fromEntries(
    threads.filter((thread) => thread.status !== 'archived').map((thread) => [thread.id, thread.sales_stage])
  ),
  deliveredIds: ['chat-ent-1', 'chat-ent-2'],
  error: null,
};

const deliveryHistory = [
  {
    chatId: 'chat-ent-1',
    orderId: 'order-1',
    subject: 'Pastillas',
    orderNumber: 'GO-100',
    total: 450,
    currency: 'MXN',
    deliveredAt: new Date().toISOString(),
    store: 'Taller Cuatro',
    seller: 'Ana Torres',
  },
];

function LocationProbe() {
  const { pathname } = useLocation();
  return <span>Ruta actual: {pathname}</span>;
}

const renderChatList = (user, sellerMembership = null) =>
  render(
    <AuthContext.Provider value={{ user, sellerMembership }}>
      <MemoryRouter initialEntries={['/chat-list']}>
        <LocationProbe />
        <ChatList />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('bandeja de mensajes con etapas', () => {
  beforeEach(() => {
    fetchChatThreads.mockReset().mockResolvedValue({ items: threads, error: null, notice: null });
    fetchChatStageBoard.mockReset().mockResolvedValue(stageBoard);
    fetchDeliveredPurchaseHistory.mockReset().mockResolvedValue({
      items: deliveryHistory,
      total: 1,
      error: null,
      notice: null,
    });
  });

  it('muestra tres píldoras y deja fuera de la bandeja los chats entregados', async () => {
    renderChatList({ id: 'user-1', role: 'commerce' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Negociando (2)' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Pendientes (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entregados (2)' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Etapas de conversación' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Negociando (2)' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Abrir conversación Consulta de precio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir conversación Bafles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir conversación Aceite' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir conversación Pastillas' })).not.toBeInTheDocument();
  });

  it('muestra las píldoras a un dueño detectado por su membresía activa', async () => {
    renderChatList(
      { id: 'user-1', role: 'user' },
      { role: 'owner', is_active: true }
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Negociando (2)' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Pendientes (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entregados (2)' })).toBeInTheDocument();
    expect(fetchChatThreads).toHaveBeenCalledWith({ userId: 'user-1', role: 'commerce' });
  });

  it('filtra por etapa, resalta la píldora activa y permite volver a ver todas', async () => {
    const user = userEvent.setup();
    renderChatList({ id: 'user-1', role: 'seller', sellerCommerceName: 'Taller Real' });

    const pending = await screen.findByRole('button', { name: 'Pendientes (1)' });
    await user.click(pending);

    expect(pending).toHaveAttribute('aria-pressed', 'true');
    expect(pending).toHaveClass('bg-[#00EED0]');
    expect(screen.getByRole('button', { name: 'Abrir conversación Aceite' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir conversación Bafles' })).not.toBeInTheDocument();

    await user.click(pending);
    expect(pending).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Abrir conversación Bafles' })).toBeInTheDocument();
  });

  it('abre exactamente el chat actual al tocar una conversación filtrada', async () => {
    const user = userEvent.setup();
    renderChatList({ id: 'user-1', role: 'commerce' });

    await user.click(await screen.findByRole('button', { name: 'Negociando (2)' }));
    await user.click(screen.getByRole('button', { name: 'Abrir conversación Bafles' }));

    expect(screen.getByText('Ruta actual: /chat/chat-neg-2')).toBeInTheDocument();
  });

  it('conserva la vista del comprador sin píldoras de etapas', async () => {
    renderChatList(
      { id: 'buyer-1', role: 'buyer' },
      { role: 'seller', is_active: false }
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir conversación Aceite' })).toBeInTheDocument());
    expect(screen.queryByRole('group', { name: 'Etapas de conversación' })).not.toBeInTheDocument();
    expect(fetchChatThreads).toHaveBeenCalledWith({ userId: 'buyer-1', role: 'buyer' });
    expect(fetchChatStageBoard).not.toHaveBeenCalled();
  });

  it('muestra el contador real de entregados y abre el historial desde la píldora', async () => {
    const user = userEvent.setup();
    renderChatList({ id: 'user-1', role: 'seller', sellerCommerceName: 'Taller Real' });

    await user.click(await screen.findByRole('button', { name: 'Entregados (2)' }));

    expect(fetchDeliveredPurchaseHistory).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Abrir historial Pastillas' })).toBeInTheDocument();
    expect(screen.getByText('Taller Cuatro')).toBeInTheDocument();
    expect(screen.getByText('Entregado')).toBeInTheDocument();
    expect(screen.getByText(/450/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir conversación Bafles' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir historial Pastillas' }));
    expect(screen.getByText('Ruta actual: /chat/chat-ent-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver conversaciones' }));
    expect(screen.getByRole('button', { name: 'Abrir conversación Bafles' })).toBeInTheDocument();
  });

  it('da al comprador acceso al historial sin mostrar píldoras de ventas', async () => {
    const user = userEvent.setup();
    renderChatList({ id: 'buyer-1', role: 'buyer' });

    await user.click(await screen.findByRole('button', { name: 'Ver historial de entregas' }));

    expect(await screen.findByRole('button', { name: 'Abrir historial Pastillas' })).toBeInTheDocument();
    expect(fetchDeliveredPurchaseHistory).toHaveBeenCalledTimes(1);
    expect(fetchChatStageBoard).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Etapas de conversación' })).not.toBeInTheDocument();
  });

  it('muestra un estado vacío explícito cuando no hay entregas', async () => {
    const user = userEvent.setup();
    fetchDeliveredPurchaseHistory.mockReset().mockResolvedValue({
      items: [],
      total: 0,
      error: null,
      notice: null,
    });
    renderChatList({ id: 'user-1', role: 'commerce' });

    await user.click(await screen.findByRole('button', { name: 'Entregados (2)' }));

    expect(await screen.findByText('Sin entregas todavía')).toBeInTheDocument();
  });
});
