import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import UserProfile from './UserProfile';

vi.mock('../../context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u-1', name: 'Julia', email: 'julia@example.com' },
    logout: vi.fn(),
    updateProfile: vi.fn(),
  }),
}));

vi.mock('../../components/community/CommunityPanel', () => ({
  default: () => <div>Panel de comunidad</div>,
}));

vi.mock('../../components/layout/UserBottomNav', () => ({
  default: () => <div>Navegación inferior</div>,
}));

vi.mock('../../components/workshop/WorkshopPanel', () => ({
  default: () => <div>Tarjeta suelta del taller</div>,
}));

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={['/profile-user']}>
      <UserProfile />
    </MemoryRouter>
  );

describe('Perfil principal', () => {
  it('mantiene los ajustes contraídos y sin botones de cambio de modo', () => {
    renderProfile();

    const header = screen.getByRole('banner', { name: /encabezado del perfil/i });
    expect(
      within(header).getByRole('button', { name: /mostrar ajustes de cuenta/i })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('button', { name: /mostrar ajustes de cuenta/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /información personal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mis direcciones/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compras/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /panel de trabajo/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Tarjeta suelta del taller')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    expect(screen.getByText('Panel de comunidad')).toBeInTheDocument();
  });

  it('despliega las opciones de ajustes al pulsar la hamburguesa', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: /mostrar ajustes de cuenta/i }));

    const header = screen.getByRole('banner', { name: /encabezado del perfil/i });
    expect(within(header).getByRole('button', { name: /información personal/i })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /mis direcciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ocultar ajustes de cuenta/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('navega a la opción elegida desde el menú superior', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/profile-user']}>
        <Routes>
          <Route path="/profile-user" element={<UserProfile />} />
          <Route path="/edit-user-profile" element={<div>Destino de información personal</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /mostrar ajustes de cuenta/i }));
    await user.click(screen.getByRole('button', { name: /información personal/i }));

    expect(await screen.findByText('Destino de información personal')).toBeInTheDocument();
  });
});
