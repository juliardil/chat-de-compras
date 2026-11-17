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
    selectOfferOption: vi.fn(),
  };
});

import {
  fetchBuyerOffers,
  fetchBuyerRequests,
  openChatForOffer,
  selectOfferOption,
} from '../../data/appData';

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

const multiBrandOffer = () => ({
  ...offer('offer-multi', 'req-1', 'Comercio Multi', 500),
  brand_options: [
    {
      id: 'mobil',
      brand: 'Mobil',
      price: 500,
      available: true,
      is_recommended: true,
      note: 'Mejor rendimiento',
    },
    {
      id: 'lubrax',
      brand: 'Lubrax',
      price: 450,
      available: true,
      is_recommended: false,
      note: 'Opción económica',
    },
  ],
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
    selectOfferOption.mockReset();
    selectOfferOption.mockResolvedValue({ ok: true, data: null, error: null });
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
      selectedOption: null,
    });
    expect(await screen.findByText('Conversación abierta: thread-1')).toBeInTheDocument();
  });

  it('lista las marcas, guarda la elegida y la fija como acuerdo del chat', async () => {
    openChatForOffer.mockResolvedValue({
      item: { id: 'thread-multi' },
      error: null,
      notice: null,
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [multiBrandOffer()],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByText('Opciones de marca')).toBeInTheDocument();
    expect(screen.getByText('Recomendada')).toBeInTheDocument();
    expect(screen.getByText('Mejor rendimiento')).toBeInTheDocument();
    expect(screen.getByText('Opción económica')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Lubrax/ }));

    expect(selectOfferOption).toHaveBeenCalledWith({
      offerId: 'offer-multi',
      optionId: 'lubrax',
    });
    expect(screen.getAllByText('$450.00').length).toBeGreaterThan(0);

    const chatButton = await screen.findByRole('button', { name: /mensajes · lubrax/i });
    await userEvent.click(chatButton);

    expect(openChatForOffer).toHaveBeenCalledWith({
      userId: 'buyer-1',
      offer: expect.objectContaining({ id: 'offer-multi' }),
      subject: 'Comercio Multi',
      selectedOption: {
        id: 'lubrax',
        brand: 'Lubrax',
        price: 450,
        available: true,
        is_recommended: false,
        note: 'Opción económica',
      },
    });
    expect(await screen.findByText('Conversación abierta: thread-multi')).toBeInTheDocument();
  });

  it('revierte la elección si el backend no puede guardarla', async () => {
    selectOfferOption.mockResolvedValue({
      ok: false,
      error: 'No tienes permiso para elegir esta opción.',
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [multiBrandOffer()],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'Pastillas de freno')],
      error: null,
      notice: null,
    });

    renderOffers();

    const lubrax = await screen.findByRole('radio', { name: /Lubrax/ });
    await userEvent.click(lubrax);

    expect(
      await screen.findByText('No tienes permiso para elegir esta opción.')
    ).toBeInTheDocument();
    expect(lubrax).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Mensajes' })).toBeInTheDocument();
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

  it('muestra el nombre del producto una sola vez aunque la solicitud lo repita', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-a', 'req-1', 'Comercio A', 500),
          items: [],
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [
        {
          ...request('req-1', 'ACEITE'),
          description: 'ACEITE',
          items: [{ item: 'ACEITE' }],
        },
      ],
      error: null,
      notice: null,
    });

    renderOffers();

    expect(await screen.findByRole('heading', { name: 'ACEITE' })).toBeInTheDocument();
    // Título, descripción y chip repetían el mismo texto: ahora solo el título.
    expect(screen.getAllByText('ACEITE')).toHaveLength(1);
    expect(screen.queryByText('ACEITE × 1')).not.toBeInTheDocument();
  });

  it('muestra la distancia real en km y la confiabilidad de cada comercio', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-a', 'req-1', 'Comercio Cercano', 500),
          commerce_latitude: 19.4576,
          commerce_longitude: -99.1332,
          commerce_rating: 4.5,
          commerce_rating_count: 12,
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

    renderOffers({
      id: 'buyer-1',
      role: 'user',
      location: { latitude: 19.4326, longitude: -99.1332 },
    });

    expect(await screen.findByText('2.8 km')).toBeInTheDocument();
    expect(screen.getByText('4.5 (12)')).toBeInTheDocument();
  });

  it('ordena las ofertas del producto por precio y por confiabilidad', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-a', 'req-1', 'Comercio A', 900),
          commerce_rating: 4.9,
          commerce_rating_count: 5,
        },
        {
          ...offer('offer-b', 'req-1', 'Comercio B', 300),
          commerce_rating: 3.1,
          commerce_rating_count: 20,
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
    const section = (await screen.findByRole('heading', { name: 'Pastillas de freno' })).closest(
      'section'
    );
    const storeOrder = () =>
      within(section)
        .getAllByText(/^Comercio [AB]$/)
        .map((node) => node.textContent);

    expect(storeOrder()).toEqual(['Comercio A', 'Comercio B']);

    await userEvent.click(screen.getByRole('button', { name: 'Menor precio' }));
    expect(storeOrder()).toEqual(['Comercio B', 'Comercio A']);

    await userEvent.click(screen.getByRole('button', { name: 'Mayor precio' }));
    expect(storeOrder()).toEqual(['Comercio A', 'Comercio B']);

    await userEvent.click(screen.getByRole('button', { name: 'Confiabilidad' }));
    expect(storeOrder()).toEqual(['Comercio A', 'Comercio B']);
  });

  it('ordena los productos por su mejor oferta aunque haya una oferta por producto', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        offer('offer-a', 'req-1', 'Comercio A', 900),
        offer('offer-b', 'req-2', 'Comercio B', 300),
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'ACEITE'), request('req-2', 'pastillas')],
      error: null,
      notice: null,
    });

    renderOffers();
    await screen.findByRole('heading', { name: 'ACEITE' });

    const productOrder = () =>
      screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);

    expect(productOrder()).toEqual(['ACEITE', 'pastillas']);

    await userEvent.click(screen.getByRole('button', { name: 'Menor precio' }));
    expect(productOrder()).toEqual(['pastillas', 'ACEITE']);

    await userEvent.click(screen.getByRole('button', { name: 'Mayor precio' }));
    expect(productOrder()).toEqual(['ACEITE', 'pastillas']);
  });

  it('ordena por kilómetros de forma predeterminada, del más cercano al más lejano', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          ...offer('offer-lejos', 'req-1', 'Comercio Lejos', 900),
          commerce_latitude: 19.5326,
          commerce_longitude: -99.1332,
        },
        {
          ...offer('offer-cerca', 'req-2', 'Comercio Cerca', 300),
          commerce_latitude: 19.4576,
          commerce_longitude: -99.1332,
        },
      ],
      error: null,
      notice: null,
    });
    fetchBuyerRequests.mockResolvedValue({
      items: [request('req-1', 'ACEITE'), request('req-2', 'pastillas')],
      error: null,
      notice: null,
    });

    renderOffers({
      id: 'buyer-1',
      role: 'user',
      location: { latitude: 19.4326, longitude: -99.1332 },
    });
    await screen.findByRole('heading', { name: 'ACEITE' });

    // Aunque ACEITE se cargó primero, el más cercano (2.8 km) va primero.
    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      'pastillas',
      'ACEITE',
    ]);
    expect(screen.getByText('2.8 km')).toBeInTheDocument();
    expect(screen.getByText('11 km')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menor distancia' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
