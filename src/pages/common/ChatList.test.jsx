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
  };
});

import { fetchChatStageBoard, fetchChatThreads } from '../../data/appData';

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
  counts: { negotiating: 2, pending: 1, delivered: 0 },
  stages: Object.fromEntries(
    threads.filter((thread) => thread.status !== 'archived').map((thread) => [thread.id, thread.sales_stage])
  ),
  error: null,
};

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
  });

  it('muestra tres píldoras y deja fuera de la bandeja los chats entregados', async () => {
    renderChatList({ id: 'user-1', role: 'commerce' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Negociando (2)' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Pendientes (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entregados (0)' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Entregados (0)' })).toBeInTheDocument();
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
});
