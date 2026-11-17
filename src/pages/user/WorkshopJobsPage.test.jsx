import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkshopJobsPage from './WorkshopJobsPage';

const { setViewMode } = vi.hoisted(() => ({ setViewMode: vi.fn() }));

vi.mock('../../context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u-1', role: 'user' },
    workshopVerified: true,
    viewMode: 'business',
    setViewMode,
  }),
}));

vi.mock('../../components/workshop/WorkshopJobsPanel', () => ({
  default: () => <div>Bandeja de trabajos</div>,
}));

vi.mock('../../components/workshop/WorkshopPlateHistory', () => ({
  default: () => <div>Historial por placa</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/workshop-jobs']}>
      <Routes>
        <Route path="/workshop-jobs" element={<WorkshopJobsPage />} />
        <Route path="/categories" element={<h1>Categorías</h1>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Panel de Trabajos del Taller Verificado', () => {
  it('muestra la bandeja de trabajos y el historial en modo empresa', async () => {
    renderPage();

    expect(await screen.findByText('Bandeja de trabajos')).toBeInTheDocument();
    expect(screen.getByText('Historial por placa')).toBeInTheDocument();
    expect(setViewMode).toHaveBeenCalledWith('business');
  });

  it('vuelve al modo comprador B2B para comprar repuestos', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: /comprar repuestos \(modo taller b2b\)/i })
    );

    expect(setViewMode).toHaveBeenCalledWith('buyer');
    expect(await screen.findByRole('heading', { name: 'Categorías' })).toBeInTheDocument();
  });
});
