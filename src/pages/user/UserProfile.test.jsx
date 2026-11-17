import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

    expect(screen.getByRole('button', { name: /mostrar ajustes de cuenta/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
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

    expect(screen.getByRole('button', { name: /información personal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mis direcciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ocultar ajustes de cuenta/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});
