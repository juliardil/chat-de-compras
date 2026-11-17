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
    expect(await screen.findByText(/propuesta enviada/i)).toBeInTheDocument();
  });

  it('abre el mismo chat de la oferta desde Mis propuestas', async () => {
    const user = userEvent.setup();
    renderWithRouter(<WorkshopJobsPanel />);

    const chatButtons = await screen.findAllByRole('button', { name: /^chat$/i });
    await user.click(chatButtons[0]);

    await waitFor(() => {
      expect(openWorkshopOfferChat).toHaveBeenCalledWith('offer-1');
    });
    expect(await screen.findByText('Chat abierto')).toBeInTheDocument();
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
