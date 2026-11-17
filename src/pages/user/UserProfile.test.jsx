import React from 'react';
import { render, screen } from '@testing-library/react';
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

vi.mock('../../components/layout/ViewSwitcher', () => ({
  default: () => <nav aria-label="Cambiar de vista" />,
}));

vi.mock('../../components/layout/UserBottomNav', () => ({
  default: () => <div>Navegación inferior</div>,
}));

vi.mock('../../components/workshop/WorkshopPanel', () => ({
  default: () => <div>Tarjeta suelta del taller</div>,
}));

describe('Perfil principal', () => {
  it('muestra los accesos de cuenta sin la tarjeta suelta del taller', () => {
    render(
      <MemoryRouter initialEntries={['/profile-user']}>
        <UserProfile />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /información personal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mis direcciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    expect(screen.getByText('Panel de comunidad')).toBeInTheDocument();
    expect(screen.queryByText('Tarjeta suelta del taller')).not.toBeInTheDocument();
  });
});
