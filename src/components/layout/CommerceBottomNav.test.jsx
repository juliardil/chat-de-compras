import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CommerceBottomNav from './CommerceBottomNav';

const PathProbe = () => {
  const { pathname } = useLocation();
  return <span>Ruta actual: {pathname}</span>;
};

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CommerceBottomNav />
      <PathProbe />
    </MemoryRouter>
  );

describe('Barra inferior del comercio', () => {
  it('mantiene solo las pestañas Panel, Chat y Perfil', () => {
    renderAt('/dashboard');

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.textContent)).toEqual(['Panel', 'Chat', 'Perfil']);
    expect(screen.queryByRole('button', { name: /inventario/i })).not.toBeInTheDocument();
  });

  it('resalta la pestaña de la ruta activa y navega a Chat', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');

    const panelButton = screen.getByRole('button', { name: 'Panel' });
    expect(panelButton).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: /chat/i }));

    expect(screen.getByText('Ruta actual: /chat-list')).toBeInTheDocument();
  });

  it('acepta rutas propias para el Panel de Trabajos del taller', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/workshop-jobs']}>
        <CommerceBottomNav panelPath="/workshop-jobs" profilePath="/profile-user" />
        <PathProbe />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Panel' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Perfil' }));

    expect(screen.getByText('Ruta actual: /profile-user')).toBeInTheDocument();
  });
});
