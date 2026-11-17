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
        <Route path="/categories" element={<h1>Vista de Compras</h1>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Panel de Trabajos del Taller Verificado', () => {
  it('muestra la bandeja de trabajos y resalta el panel en el switcher', async () => {
    renderPage();

    expect(await screen.findByText('Bandeja de trabajos')).toBeInTheDocument();
    expect(screen.getByText('Historial por placa')).toBeInTheDocument();
    expect(setViewMode).toHaveBeenCalledWith('business');
    expect(screen.getByRole('button', { name: /panel de trabajo/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('vuelve al modo comprador desde el switcher sin accesos duplicados', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /compras/i }));

    expect(setViewMode).toHaveBeenCalledWith('buyer');
    expect(await screen.findByRole('heading', { name: 'Vista de Compras' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comprar repuestos/i })).not.toBeInTheDocument();
  });
});
