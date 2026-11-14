import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Responses from './Responses';
import { AuthContext } from '../../context/auth-context';

vi.mock('../../data/appData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBuyerOffers: vi.fn(),
  };
});

import { fetchBuyerOffers } from '../../data/appData';

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
});
