import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Responses from './Responses';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBuyerOffers: vi.fn(),
    openChatForOffer: vi.fn(),
    selectOfferItemBrands: vi.fn(),
    selectOfferOption: vi.fn(),
  };
});

import {
  fetchBuyerOffers,
  openChatForOffer,
  selectOfferItemBrands,
  selectOfferOption,
} from '../../data/appData';

const renderResponses = (user = { id: 'buyer-1', role: 'user' }) =>
  render(
    <AuthContext.Provider value={{ user }}>
      <MemoryRouter
        initialEntries={[{ pathname: '/responses', state: { requestId: 'req-1' } }]}
      >
        <Routes>
          <Route path="/responses" element={<Responses />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('detalle de ofertas recibidas', () => {
  beforeEach(() => {
    fetchBuyerOffers.mockReset();
    openChatForOffer.mockReset();
    selectOfferItemBrands.mockReset();
    selectOfferItemBrands.mockResolvedValue({ ok: true, data: null, error: null });
    selectOfferOption.mockReset();
    selectOfferOption.mockResolvedValue({ ok: true, data: null, error: null });
  });

  it('muestra el desglose por producto con precios y productos no disponibles', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          id: 'offer-1',
          request_id: 'req-1',
          commerce_name: 'Comercio A',
          total_amount: 300,
          currency: 'MXN',
          delivery_days: 2,
          conditions: 'Pago contra entrega',
          status: 'active',
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

    renderResponses();

    expect(await screen.findByRole('heading', { name: 'Comercio A' })).toBeInTheDocument();
    expect(screen.getByText('Pastillas × 2')).toBeInTheDocument();
    expect(screen.getByText(/\$200/)).toBeInTheDocument();
    expect(screen.getByText('Discos × 1')).toBeInTheDocument();
    expect(screen.getByText('No disponible')).toBeInTheDocument();
    expect(screen.getByText('2 unidades cotizadas')).toBeInTheDocument();
  });

  it('muestra la distancia real y la calificación del comercio', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          id: 'offer-geo',
          request_id: 'req-1',
          commerce_name: 'Comercio Cercano',
          total_amount: 500,
          currency: 'MXN',
          delivery_days: 2,
          commerce_latitude: 19.4576,
          commerce_longitude: -99.1332,
          commerce_rating: 4.5,
          commerce_rating_count: 12,
          status: 'sent',
          items: [],
        },
      ],
      error: null,
      notice: null,
    });

    renderResponses({
      id: 'buyer-1',
      role: 'user',
      location: { latitude: 19.4326, longitude: -99.1332 },
    });

    expect(await screen.findByText('2.8 km')).toBeInTheDocument();
    expect(screen.getByText('4.5 (12 reseñas)')).toBeInTheDocument();
  });

  it('no inventa distancia ni calificación cuando faltan los datos', async () => {
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          id: 'offer-unknown',
          request_id: 'req-1',
          commerce_name: 'Comercio Sin Datos',
          total_amount: 500,
          currency: 'MXN',
          status: 'sent',
          items: [],
        },
      ],
      error: null,
      notice: null,
    });

    renderResponses();

    expect(await screen.findByText('Sin ubicación')).toBeInTheDocument();
    expect(screen.getByText('Sin calificación')).toBeInTheDocument();
  });

  it('muestra y guarda las opciones de marca antes de abrir el chat', async () => {
    openChatForOffer.mockResolvedValue({
      item: { id: 'thread-brand' },
      error: null,
      notice: null,
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          id: 'offer-brand',
          request_id: 'req-1',
          commerce_name: 'Comercio Multi',
          total_amount: 500,
          currency: 'MXN',
          status: 'active',
          items: [],
          brand_options: [
            {
              id: 'mobil',
              brand: 'Mobil',
              price: 500,
              available: true,
              is_recommended: true,
              note: 'Entrega inmediata',
            },
            {
              id: 'lubrax',
              brand: 'Lubrax',
              price: 450,
              available: true,
              is_recommended: false,
              note: 'Precio especial',
            },
          ],
        },
      ],
      error: null,
      notice: null,
    });

    renderResponses();

    expect(await screen.findByText('Opciones de marca')).toBeInTheDocument();
    expect(screen.getByText('Entrega inmediata')).toBeInTheDocument();
    expect(screen.getByText('Precio especial')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Mobil/ }));

    expect(selectOfferOption).toHaveBeenCalledWith({
      offerId: 'offer-brand',
      optionId: 'mobil',
    });

    const chatButton = await screen.findByRole('button', { name: /chatear · mobil/i });
    await userEvent.click(chatButton);

    expect(openChatForOffer).toHaveBeenCalledWith({
      userId: 'buyer-1',
      offer: expect.objectContaining({ id: 'offer-brand' }),
      subject: 'Comercio Multi',
      selectedOption: {
        id: 'mobil',
        brand: 'Mobil',
        price: 500,
        available: true,
        is_recommended: true,
        note: 'Entrega inmediata',
      },
    });
  });

  it('selecciona la marca de cada producto y la envía como acuerdo al chat', async () => {
    openChatForOffer.mockResolvedValue({
      item: { id: 'thread-items' },
      error: null,
      notice: null,
    });
    fetchBuyerOffers.mockResolvedValue({
      items: [
        {
          id: 'offer-items',
          request_id: 'req-1',
          commerce_name: 'Comercio Multi',
          total_amount: 600,
          currency: 'MXN',
          status: 'active',
          items: [
            {
              key: 'item-1',
              name: 'Bafles',
              quantity: 2,
              available: true,
              unitPrice: 250,
              totalPrice: 500,
              brand_options: [
                { id: 'sony', brand: 'Sony', price: 220, available: true, note: 'Garantía' },
              ],
            },
            {
              key: 'item-2',
              name: 'GPS',
              quantity: 1,
              available: true,
              unitPrice: 100,
              totalPrice: 100,
              brand_options: [{ id: 'garmin', brand: 'Garmin', price: 110, available: true }],
            },
          ],
        },
      ],
      error: null,
      notice: null,
    });

    renderResponses();

    expect(await screen.findByText('Marcas para Bafles')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Sony/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Garmin/ }));

    expect(selectOfferItemBrands).toHaveBeenCalledWith({
      offerId: 'offer-items',
      selections: { 'item-1': 'sony', 'item-2': 'garmin' },
    });

    const chatButton = await screen.findByRole('button', { name: /chatear · 2 marcas/i });
    await userEvent.click(chatButton);

    expect(openChatForOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-1',
        selectedItemOptions: [
          expect.objectContaining({ item_key: 'item-1', brand: 'Sony', price: 220 }),
          expect.objectContaining({ item_key: 'item-2', brand: 'Garmin', price: 110 }),
        ],
      })
    );
  });
});
