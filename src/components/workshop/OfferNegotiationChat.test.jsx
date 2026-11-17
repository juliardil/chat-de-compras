import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OfferNegotiationChat from './OfferNegotiationChat';

const {
  fetchOfferNegotiation,
  sendOfferNegotiationMessage,
  saveOfferNegotiationNotes,
  confirmOfferService,
  subscribeOfferNegotiation,
} = vi.hoisted(() => ({
  fetchOfferNegotiation: vi.fn(),
  sendOfferNegotiationMessage: vi.fn(),
  saveOfferNegotiationNotes: vi.fn(),
  confirmOfferService: vi.fn(),
  subscribeOfferNegotiation: vi.fn(),
}));

vi.mock('../../data/offerResponses', () => ({
  fetchOfferNegotiation,
  sendOfferNegotiationMessage,
  saveOfferNegotiationNotes,
  confirmOfferService,
  subscribeOfferNegotiation,
}));

const offer = {
  offerId: 'offer-1',
  requestId: 'request-1',
  requestTitle: 'Cambio de frenos',
  clientName: 'Ana López',
  totalAmount: 1500,
  currency: 'MXN',
  offerStatus: 'sent',
  confirmationStatus: 'open',
  notes: 'Incluye garantía',
  ownerType: 'workshop',
};

const messages = [
  {
    id: 'm-1',
    senderType: 'buyer',
    senderName: 'Ana López',
    body: '¿Incluye instalación?',
    createdAt: '2026-11-17T12:00:00Z',
    isMine: false,
  },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/workshop-jobs/responses/offer-1']}>
      <Routes>
        <Route path="/workshop-jobs/responses/:offerId" element={<OfferNegotiationChat />} />
        <Route path="/workshop-jobs/responses" element={<h1>Respuestas</h1>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchOfferNegotiation.mockResolvedValue({
    items: messages,
    extra: offer,
    error: null,
    notice: null,
  });
  subscribeOfferNegotiation.mockReturnValue(() => {});
  sendOfferNegotiationMessage.mockResolvedValue({
    ok: true,
    data: [
      {
        id: 'm-2',
        senderType: 'commerce',
        senderName: 'Taller',
        body: 'Sí, incluye instalación.',
        createdAt: '2026-11-17T12:05:00Z',
        isMine: true,
      },
    ],
    error: null,
  });
  saveOfferNegotiationNotes.mockResolvedValue({ ok: true, data: [{}], error: null });
  confirmOfferService.mockResolvedValue({
    ok: true,
    data: [{ offerId: 'offer-1', confirmationStatus: 'confirmed', confirmedAt: '2026-11-17T12:10:00Z' }],
    error: null,
  });
});

describe('Chat de negociación de ofertas', () => {
  it('carga la oferta y los mensajes autorizados', async () => {
    renderPage();

    expect(await screen.findByText('¿Incluye instalación?')).toBeInTheDocument();
    expect(screen.getByText('Cambio de frenos')).toBeInTheDocument();
    expect(screen.getAllByText('Ana López').length).toBeGreaterThan(0);
    expect(subscribeOfferNegotiation).toHaveBeenCalledWith('offer-1', expect.any(Object));
  });

  it('envía un mensaje y lo muestra en la conversación', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('¿Incluye instalación?');
    await user.type(screen.getByLabelText('Mensaje de negociación'), 'Sí, incluye instalación.');
    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    await waitFor(() =>
      expect(sendOfferNegotiationMessage).toHaveBeenCalledWith('offer-1', 'Sí, incluye instalación.')
    );
    expect(await screen.findByText('Sí, incluye instalación.')).toBeInTheDocument();
  });

  it('guarda los detalles y confirma el servicio', async () => {
    const user = userEvent.setup();
    renderPage();

    const notes = await screen.findByLabelText(/detalles del repuesto/i);
    await user.clear(notes);
    await user.type(notes, 'Garantía de 12 meses');
    await user.click(screen.getByRole('button', { name: /guardar detalles/i }));
    await waitFor(() =>
      expect(saveOfferNegotiationNotes).toHaveBeenCalledWith('offer-1', 'Garantía de 12 meses')
    );

    await user.click(screen.getByRole('button', { name: /confirmar servicio/i }));
    await waitFor(() => expect(confirmOfferService).toHaveBeenCalledWith('offer-1'));
    expect(await screen.findByText('Servicio / Reserva Confirmada')).toBeInTheDocument();
  });
});
