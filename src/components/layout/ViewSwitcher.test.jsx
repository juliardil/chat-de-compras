import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ViewSwitcher from './ViewSwitcher';

const { setViewMode } = vi.hoisted(() => ({ setViewMode: vi.fn() }));

vi.mock('../../context/auth-context', () => ({
  useAuth: () => ({ setViewMode }),
}));

const PathProbe = () => {
  const { pathname } = useLocation();
  return <span>Ruta actual: {pathname}</span>;
};

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ViewSwitcher />
      <PathProbe />
    </MemoryRouter>
  );

const comprasButton = () => screen.getByRole('button', { name: /compras/i });
const panelButton = () => screen.getByRole('button', { name: /panel de trabajo/i });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Switcher superior de vistas', () => {
  it('resalta Compras cuando la vista activa no es el panel', () => {
    renderAt('/categories');

    expect(comprasButton()).toHaveAttribute('aria-current', 'page');
    expect(panelButton()).not.toHaveAttribute('aria-current');
  });

  it('resalta Panel de Trabajo cuando la ruta activa es /workshop-jobs', () => {
    renderAt('/workshop-jobs');

    expect(panelButton()).toHaveAttribute('aria-current', 'page');
    expect(comprasButton()).not.toHaveAttribute('aria-current');
  });

  it('activa la vista de comprador y vuelve a /categories', async () => {
    const user = userEvent.setup();
    renderAt('/workshop-jobs');

    await user.click(comprasButton());

    expect(setViewMode).toHaveBeenCalledWith('buyer');
    expect(screen.getByText('Ruta actual: /categories')).toBeInTheDocument();
  });

  it('abre /workshop-jobs en modo empresa', async () => {
    const user = userEvent.setup();
    renderAt('/profile-user');

    await user.click(panelButton());

    expect(setViewMode).toHaveBeenCalledWith('business');
    expect(screen.getByText('Ruta actual: /workshop-jobs')).toBeInTheDocument();
  });
});
