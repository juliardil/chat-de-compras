import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Offers from './Offers';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBuyerOffers: vi.fn(),
    fetchBuyerRequests: vi.fn(),
    openChatForOffer: vi.fn(),
  };
});

import { fetchBuyerOffers, fetchBuyerRequests, openChatForOffer } from '../../data/appData';

const offer = (id, requestId, store, amount) => ({
  id,
  request_id: requestId,
  commerce_id: `commerce-${id}`,
  commerce_name: store,
  total_amount: amount,
  currency: 'MXN',
  delivery_days: 2,
  conditions: 'Pago contra entrega',
  status: 'sent',
  items: [{ name: 'Pastillas', available: true }],
});

const request = (id, title) => ({
  id,
  title,
  description: 'Repuesto solicitado',
  status: 'open',
  currency: 'MXN',
  created_at: new Date().toISOString(),
  items: [{ item: title }],
});

const renderOffers = (user = { id: 'buyer-1', role: 'user' }) =>
  render(
    <AuthContext.Provider value={{ user }}>
      <MemoryRouter initialEntries={['/offers']}>
        <Routes>
          <Route path="/offers" element={<Offers />} />
          <Route path="/chat/:id" element={<ChatProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

function ChatProbe() {
  const { id } = useParams();
  return <div>Conversación abierta: {id}</div>;
}

describe('sección Ofertas del comprador', () => {
  beforeEach(() => {
    fetchBuyerOffers.mockReset();
    fetchBuyerRequests.mockReset();
    openChatForOffer.mockReset();
  });

  it('agrupa las ofertas por producto y conserva el comercio de cada oferta', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        offer('offer-a', 'req-1', 'Comercio A', 900),
        offer('offer-b', 'req-1', 'Comercio B', 950),
        offer('offer-c', 'req-2', 'Comercio C', 400),
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno'), request('req-2', 'Filtro de aceite')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByRole('heading', { name: 'Ofertas' })).toBeInTheDocument();
    expect(await screen.findByText('3 ofertas recibidas')).toBeInTheDocument();

    const brakes = screen.getByRole('heading', { name: 'Pastillas de freno' }).closest('section');
    const filter = screen.getByRole('heading', { name: 'Filtro de aceite' }).closest('section');

    expect(within(brakes).getByText('Comercio A')).toBeInTheDocument();
    expect(within(brakes).getByText('Comercio B')).toBeInTheDocument();
    expect(within(brakes).queryByText('Comercio C')).not.toBeInTheDocument();

    expect(within(filter).getByText('Comercio C')).toBeInTheDocument();
    expect(within(filter).queryByText('Comercio A')).not.toBeInTheDocument();
  });

  it('muestra el precio cotizado y los productos no disponibles en cada oferta', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-a', 'req-1', 'Comercio A', 300),
          items: [
            {
              name: 'Pastillas',
              quantity: 2,
              available: true,
              unitPrice: 100,
              totalPrice: 200,
            },
            { name: 'Discos', quantity: 1, available: false },
          ],
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByText(/Pastillas × 2 · \$200/)).toBeInTheDocument();
    expect(screen.getByText(/Discos × 1 \(no disponible\)/)).toBeInTheDocument();
  });

  it('abre la conversación existente asociada a la oferta y al comercio', async () => {
    openChatForOffer.mockResolvedValue({
      item: { id: 'thread-1' },
      error: null,
      notice: null,
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [offer('offer-a', 'req-1', 'Comercio A', 900)],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();
    const buttons = await screen.findAllByRole('button', { name: /mensajes/i });
    await userEvent.click(buttons[0]);

    expect(openChatForOffer).toHaveBeenCalledWith({
      userId: 'buyer-1',
      offer: expect.objectContaining({
        id: 'offer-a',
        commerceId: 'commerce-offer-a',
        store: 'Comercio A',
      }),
      subject: 'Comercio A',
    });
    expect(await screen.findByText('Conversación abierta: thread-1')).toBeInTheDocument();
  });

  it('muestra un aviso si no se puede abrir la conversación', async () => {
    openChatForOffer.mockResolvedValue({
      item: null,
      error: 'El backend rechazó la operación por permisos.',
      notice: null,
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [offer('offer-a', 'req-1', 'Comercio A', 900)],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();
    const buttons = await screen.findAllByRole('button', { name: /mensajes/i });
    await userEvent.click(buttons[0]);

    expect(
      await screen.findByText('El backend rechazó la operación por permisos.')
    ).toBeInTheDocument();
  });

  it('muestra el estado vacío real cuando no hay ofertas', async () => {
    fetchBuyerOffers.mockResolvedValue({ items: [], error: null, notice: null });
    fetchBuyerRequests.mockResolvedValue({ items: [], error: null, notice: null });

    renderOffers();

    expect(await screen.findByText('Sin ofertas recibidas')).toBeInTheDocument();
  });
});
