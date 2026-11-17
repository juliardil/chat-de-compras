import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditUserProfile from './EditUserProfile';

const { updateProfile } = vi.hoisted(() => ({ updateProfile: vi.fn() }));

vi.mock('../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'u-1',
      name: 'Julia',
      email: 'julia@example.com',
      phone: '5551234',
      birthDate: '1990-05-10',
    },
    updateProfile,
    mode: 'demo',
  }),
}));

vi.mock('../../data/workshop', () => ({
  fetchMyWorkshop: vi.fn(),
  saveWorkshop: vi.fn(),
  WORKSHOP_SPECIALTIES: ['Mecánica general', 'Motos', 'Electricidad', 'Latonería'],
}));

import { fetchMyWorkshop } from '../../data/workshop';

const verifiedWorkshop = {
  id: 'w-1',
  user_id: 'u-1',
  workshop_name: 'motorcossio',
  nit_or_id: 'NIT-123',
  address: 'Calle 1 #2',
  phone: '5559876',
  specialties: ['Mecánica general', 'Motos'],
  is_verified: true,
  created_at: new Date().toISOString(),
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/edit-user-profile']}>
      <EditUserProfile />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchMyWorkshop.mockResolvedValue({ items: [], error: null, notice: null });
});

describe('Información Personal', () => {
  it('muestra los datos del usuario y la tarjeta del taller en la misma vista', async () => {
    fetchMyWorkshop.mockResolvedValue({ items: [verifiedWorkshop], error: null, notice: null });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Información Personal' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Julia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('julia@example.com')).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', { name: /soy un taller mecánico \/ negocio/i })
    ).toBeInTheDocument();
    expect(screen.getByText('motorcossio')).toBeInTheDocument();
    expect(screen.getByText('Taller Verificado')).toBeInTheDocument();
    expect(screen.getByText('NIT-123')).toBeInTheDocument();
    expect(screen.getByText('5559876')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar datos del taller/i })).toBeInTheDocument();
  });
});
