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
  default: ({ activeTab }) => <div>Bandeja de trabajos ({activeTab})</div>,
}));

vi.mock('../../components/workshop/WorkshopPlateHistory', () => ({
  default: () => <div>Contenido del historial por placa</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/workshop-jobs']}>
      <Routes>
        <Route path="/workshop-jobs" element={<WorkshopJobsPage />} />
        <Route path="/workshop-jobs/responses" element={<h1>Respuestas de mis ofertas</h1>} />
        <Route path="/inventory" element={<h1>Mi Inventario</h1>} />
        <Route path="/edit-user-profile" element={<h1>Ajustes del taller</h1>} />
        <Route path="/chat-list" element={<h1>Bandeja de chat</h1>} />
        <Route path="/categories" element={<h1>Vista de Compras</h1>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Panel de Trabajos del Taller Verificado', () => {
  it('mantiene el encabezado y la pestaña inicial sin barra inferior', () => {
    renderPage();

    expect(screen.getByText('Bandeja de trabajos (jobs)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Panel de Trabajos' })).toBeInTheDocument();
    expect(screen.getByText('Taller Verificado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /panel de trabajo/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(setViewMode).toHaveBeenCalledWith('business');

    expect(screen.queryByRole('button', { name: 'Panel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^chat$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Perfil' })).not.toBeInTheDocument();
    expect(screen.queryByText('Contenido del historial por placa')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /respuestas de mis ofertas/i })).not.toBeInTheDocument();
  });

  it('cambia entre pestañas tipo píldora sin apilar los bloques', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('tab', { name: 'Trabajos disponibles' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await user.click(screen.getByRole('tab', { name: 'Mis propuestas' }));

    expect(screen.getByText('Bandeja de trabajos (proposals)')).toBeInTheDocument();
    expect(screen.queryByText('Bandeja de trabajos (jobs)')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Mis propuestas' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('abre el menú hamburguesa y consulta el historial por placa en un diálogo', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

    expect(screen.getByRole('menuitem', { name: 'Mi Inventario' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Historial por placa' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Respuestas de mis ofertas' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Historial por placa' }));

    expect(await screen.findByRole('dialog', { name: 'Historial por placa' })).toBeInTheDocument();
    expect(screen.getByText('Contenido del historial por placa')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar historial por placa' }));

    expect(screen.queryByRole('dialog', { name: 'Historial por placa' })).not.toBeInTheDocument();
  });

  it('accede a Mi Inventario desde el menú', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mi Inventario' }));

    expect(await screen.findByRole('heading', { name: 'Mi Inventario' })).toBeInTheDocument();
  });

  it('accede a Ajustes del usuario con taller verificado', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ajustes' }));

    expect(await screen.findByRole('heading', { name: 'Ajustes del taller' })).toBeInTheDocument();
  });

  it('conserva el acceso a respuestas de mis ofertas desde el menú', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    await user.click(screen.getByRole('menuitem', { name: 'Respuestas de mis ofertas' }));

    expect(await screen.findByRole('heading', { name: 'Respuestas de mis ofertas' })).toBeInTheDocument();
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
