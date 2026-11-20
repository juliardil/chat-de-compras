import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkshopJobsPanel from './WorkshopJobsPanel';
import WorkshopPlateHistory from './WorkshopPlateHistory';

vi.mock('../../data/workshop', () => ({
  fetchAvailableServiceJobs: vi.fn(),
  fetchMyServiceProposals: vi.fn(),
  createServiceProposal: vi.fn(),
  openWorkshopOfferChat: vi.fn(),
  fetchWorkshopPlateHistory: vi.fn(),
}));

const {
  fetchOfferNegotiation,
  sendOfferNegotiationMessage,
  subscribeOfferNegotiation,
} = vi.hoisted(() => ({
  fetchOfferNegotiation: vi.fn(),
  sendOfferNegotiationMessage: vi.fn(),
  subscribeOfferNegotiation: vi.fn(),
}));

vi.mock('../../data/offerResponses', () => ({
  fetchOfferNegotiation,
  sendOfferNegotiationMessage,
  subscribeOfferNegotiation,
}));

import {
  fetchAvailableServiceJobs,
  fetchMyServiceProposals,
  createServiceProposal,
  openWorkshopOfferChat,
  fetchWorkshopPlateHistory,
} from '../../data/workshop';

const renderWithRouter = (ui) =>
  render(
    <MemoryRouter initialEntries={['/taller']}>
      <Routes>
        <Route path="/taller" element={ui} />
        <Route path="/chat/:id" element={<div>Chat abierto</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchAvailableServiceJobs.mockResolvedValue({
    items: [
      {
        id: 'job-1',
        title: 'Cambio de pastillas',
        description: 'Ruido al frenar',
        vehicle_plate: 'ABC123',
        service_zone: 'Centro',
        specialty: 'Frenos',
        client_name: 'Camila',
        client_is_club_member: true,
      },
    ],
    error: null,
    notice: null,
  });
  fetchMyServiceProposals.mockResolvedValue({
    items: [
      {
        id: 'offer-1',
        request_title: 'Cambio de pastillas',
        labor_amount: 850,
        estimated_days: 2,
        status: 'active',
      },
    ],
    error: null,
    notice: null,
  });
  createServiceProposal.mockResolvedValue({ ok: true, error: null });
  openWorkshopOfferChat.mockResolvedValue({ items: [{ id: 'thread-1' }], error: null });
  fetchOfferNegotiation.mockResolvedValue({
    items: [
      {
        id: 'm-1',
        senderType: 'buyer',
        senderName: 'juliana',
        body: '¿Incluye instalación?',
        createdAt: '2026-11-17T12:00:00Z',
        isMine: false,
      },
    ],
    extra: {
      offerId: 'offer-1',
      requestTitle: 'Cambio de pastillas',
      clientName: 'juliana',
    },
    error: null,
  });
  sendOfferNegotiationMessage.mockResolvedValue({ ok: true, data: [], error: null });
  subscribeOfferNegotiation.mockReturnValue(() => {});
  fetchWorkshopPlateHistory.mockResolvedValue({
    items: [{ id: 'req-1', title: 'Cambio de pastillas', vehicle_plate: 'ABC123', request_type: 'service', status: 'open', offer_count: 1 }],
    error: null,
    notice: null,
  });
});

describe('bandeja de trabajos del taller verificado', () => {
  it('muestra la solicitud, la insignia de club y permite enviar una propuesta', async () => {
    const user = userEvent.setup();
    renderWithRouter(<WorkshopJobsPanel />);

    expect((await screen.findAllByText(/cambio de pastillas/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/cliente de club/i)).toBeInTheDocument();
    expect(screen.getByText(/abc123/i)).toBeInTheDocument();
    expect(screen.getByText('Frenos')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enviar propuesta/i }));
    await user.type(screen.getByLabelText(/precio de mano de obra/i), '850');
    await user.type(screen.getByLabelText(/tiempo estimado/i), '2');
    await user.type(screen.getByLabelText(/notas para el cliente/i), 'Incluye pastillas delanteras');
    await user.click(document.querySelector('form button[type="submit"]'));

    await waitFor(() => {
      expect(createServiceProposal).toHaveBeenCalledWith({
        requestId: 'job-1',
        laborAmount: 850,
        estimatedDays: 2,
        notes: 'Incluye pastillas delanteras',
      });
    });
    const banner = await screen.findByText(
      'Propuesta enviada. El cliente la verá junto a sus ofertas'
    );
    expect(banner.closest('[role="note"]')).toHaveClass('bg-[#0197AF]/10');
  });

  it('abre un chat flotante compacto desde Mis propuestas sin salir del panel', async () => {
    const user = userEvent.setup();
    renderWithRouter(<WorkshopJobsPanel />);

    const chatButtons = await screen.findAllByRole('button', { name: /^chat$/i });
    await user.click(chatButtons[0]);

    await waitFor(() => {
      expect(openWorkshopOfferChat).toHaveBeenCalledWith('offer-1');
    });
    expect(await screen.findByRole('dialog', { name: 'Chat con juliana' })).toBeInTheDocument();
    expect(await screen.findByText('¿Incluye instalación?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escribe un mensaje...')).toBeInTheDocument();
    expect(screen.queryByText('Chat abierto')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar chat' }));

    expect(screen.queryByRole('dialog', { name: 'Chat con juliana' })).not.toBeInTheDocument();
  });

  it('muestra solo la pestaña elegida cuando se usa dentro del Panel de Trabajos', async () => {
    renderWithRouter(<WorkshopJobsPanel activeTab="proposals" embedded />);

    expect(await screen.findByText(/cambio de pastillas/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar propuesta/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Mis propuestas enviadas')).not.toBeInTheDocument();
  });
});

describe('historial por placa del taller', () => {
  it('busca por placa y muestra el resultado', async () => {
    const user = userEvent.setup();
    renderWithRouter(<WorkshopPlateHistory />);

    await user.type(screen.getByRole('searchbox', { name: /buscar por placa/i }), 'abc123');
    await user.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => {
      expect(fetchWorkshopPlateHistory).toHaveBeenCalledWith('ABC123');
    });
    expect(await screen.findByText(/1 resultado para «ABC123»/i)).toBeInTheDocument();
    expect(screen.getByText(/1 cotización/)).toBeInTheDocument();
  });
});
