import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OfferResponsesPage from './OfferResponsesPage';

const { fetchMyOfferResponses } = vi.hoisted(() => ({ fetchMyOfferResponses: vi.fn() }));

vi.mock('../../data/offerResponses', () => ({ fetchMyOfferResponses }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/workshop-jobs/responses']}>
      <Routes>
        <Route path="/workshop-jobs/responses" element={<OfferResponsesPage />} />
        <Route path="/workshop-jobs" element={<h1>Panel de Trabajos</h1>} />
        <Route
          path="/workshop-jobs/responses/:offerId"
          element={<h1>Negociación abierta</h1>}
        />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchMyOfferResponses.mockResolvedValue({ items: [], error: null, notice: null });
});

describe('Respuestas de mis ofertas', () => {
  it('muestra un estado vacío cuando no hay respuestas', async () => {
    renderPage();

    expect(await screen.findByText('Todavía no hay respuestas')).toBeInTheDocument();
  });

  it('muestra las ofertas del proveedor y abre su negociación', async () => {
    const user = userEvent.setup();
    fetchMyOfferResponses.mockResolvedValue({
      items: [
        {
          offer_id: 'offer-1',
          request_id: 'request-1',
          request_title: 'Cambio de frenos',
          client_name: 'Ana López',
          total_amount: 1500,
          currency: 'MXN',
          offer_status: 'sent',
          confirmation_status: 'open',
          last_message: '¿Incluye mano de obra?',
          created_at: '2026-11-17T12:00:00Z',
          owner_type: 'workshop',
        },
      ],
      error: null,
      notice: null,
    });

    renderPage();

    expect(await screen.findByText('Cambio de frenos')).toBeInTheDocument();
    expect(screen.getByText(/Ana López/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /abrir negociación/i }));
    expect(await screen.findByRole('heading', { name: 'Negociación abierta' })).toBeInTheDocument();
  });
});
