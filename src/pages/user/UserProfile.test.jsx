import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserProfile from './UserProfile';

const { mockLogout } = vi.hoisted(() => ({
  mockLogout: vi.fn(),
}));

vi.mock('../../context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u-1', name: 'Julia', email: 'julia@example.com' },
    logout: mockLogout,
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="ruta-actual">{location.pathname}</div>;
}

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={['/profile-user']}>
      <UserProfile />
    </MemoryRouter>
  );

const renderProfileWithLocation = () =>
  render(
    <MemoryRouter initialEntries={['/profile-user']}>
      <LocationProbe />
      <UserProfile />
    </MemoryRouter>
  );

const getMenuButton = () =>
  within(screen.getByRole('banner', { name: /encabezado del perfil/i })).getByRole('button', {
    name: 'Menú',
  });

describe('Perfil principal', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  it('muestra solo el icono de hamburguesa en la esquina superior del encabezado', () => {
    renderProfile();

    const menuButton = getMenuButton();
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', 'account-settings-menu');
    expect(menuButton.textContent).toBe('');
    expect(menuButton.querySelectorAll('svg')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Menú' })).toHaveLength(1);
    expect(screen.queryByText(/ajustes de cuenta/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /información personal/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Tarjeta suelta del taller')).not.toBeInTheDocument();
    expect(screen.getByText('Panel de comunidad')).toBeInTheDocument();
  });

  it('abre un menú solo con las opciones de cuenta y cierre de sesión', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(getMenuButton());

    const header = screen.getByRole('banner', { name: /encabezado del perfil/i });
    expect(within(header).getByRole('button', { name: /información personal/i })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /mis direcciones/i })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /notificaciones/i })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /historial/i })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /seguridad/i })).toBeInTheDocument();
    expect(screen.queryByText(/cambiar de vista/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compras/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /panel de trabajo/i })).not.toBeInTheDocument();
    expect(getMenuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('button', { name: /cerrar sesión/i })).toHaveLength(1);
  });

  it('navega a la opción de cuenta elegida y cierra el menú', async () => {
    const user = userEvent.setup();
    renderProfileWithLocation();

    await user.click(getMenuButton());
    await user.click(screen.getByRole('button', { name: /información personal/i }));

    expect(screen.getByTestId('ruta-actual')).toHaveTextContent('/edit-user-profile');
    expect(getMenuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('cierra sesión desde el menú sin dejar un botón inferior duplicado', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(getMenuButton());
    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(getMenuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });
});
